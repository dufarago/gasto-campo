import type { ExpenseCategory, OcrResult } from "./types";

function toNumber(raw: string): number | null {
  let cleaned = raw.trim().replace(/[^\d.,\s]/g, "");
  // "49 96" ou "49  96" → decimal BR
  cleaned = cleaned.replace(/^(\d+)\s+(\d{2})$/, "$1,$2");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".").replace(/\s/g, "")
    : cleaned.replace(",", ".").replace(/\s/g, "");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value) || value <= 0 || value >= 1_000_000) return null;
  return value;
}

function formatDateParts(
  day: string,
  month: string,
  yearRaw: string,
): string | null {
  let year = yearRaw;
  if (year.length === 2) year = `20${year}`;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function normalizeOcrText(text: string): string {
  let out = text.replace(/\u00a0/g, " ");
  // NFC-e distorcido: WEC-e, MEC-e, ECA, NEC-e, etc.
  out = out.replace(/\b[WNMH][FEPCMAE][CEGOA][\s.-]*e?\b/gi, "NFCE");
  out = out.replace(/\b(?:MEC|ECA|NEC|WEC)[\s.-]*(?:e|nd|ne|ni)?\b/gi, "NFCE");
  out = out.replace(/\bNFC[\s-]*e\b/gi, "NFCE");
  out = out.replace(/\bNF[\s-]*e\b/gi, "NFE");
  out = out.replace(/\bN[º°]\b/gi, "No");
  out = out.replace(/\bN[oO0]\.(?=\s|\d)/g, "No ");
  out = out.replace(/\b(?:ni|n1|nl|nd|ne)\s+(?=\d{3,})/gi, "No ");
  out = out.replace(/\bS[eé]rie\b/gi, "Serie");
  out = out.replace(/\bS[eo0]\b(?=\s*\d)/gi, "Serie"); // "Serie So 55" / "Serie So"
  out = out.replace(/\bCNPJ[\s.:-]*/gi, "CNPJ ");
  out = out.replace(/\bVALOR\s*TOTAI\b/gi, "VALOR TOTAL");
  out = out.replace(/\bTOTAI\b/gi, "TOTAL");
  // total com espaço no centavo: "49 96" → "49,96"
  out = out.replace(
    /(valor\s*total\s*r?\$?\s*)(\d{1,5})\s+(\d{2})\b/gi,
    "$1$2,$3",
  );
  out = out.replace(/\b(\d{1,2})\s+(\d{1,2})[\/\-.](\d{2,4})\b/g, (_, d, m, y) => {
    return formatDateParts(d, m, y) ?? `${d}/${m}/${y}`;
  });
  out = out.replace(
    /\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\b/g,
    (_, d, m, y) => formatDateParts(d, m, y) ?? `${d}/${m}/${y}`,
  );
  out = out.replace(/[ \t]+/g, " ");
  return out.trim();
}

export function parseBrazilianAmount(text: string): number | null {
  const scored: Array<{ value: number; score: number }> = [];
  const push = (raw: string | undefined, score: number) => {
    if (!raw) return;
    const value = toNumber(raw);
    if (value == null) return;
    // ignora valores tipicos de item unitário muito baixos se houver total maior
    scored.push({ value, score });
  };

  const money =
    "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2}|\\d{1,5}\\s+\\d{2}|\\d+\\.\\d{2})";

  for (const match of text.matchAll(
    new RegExp(`valor\\s*total\\s*[:=]*\\s*r?\\$?\\s*${money}`, "gi"),
  )) {
    push(match[1], 100);
  }
  for (const match of text.matchAll(
    new RegExp(
      `(?:total\\s*a\\s*pagar|total\\s*geral|total\\s*da\\s*nota|valor\\s*pago)\\s*[:=]?\\s*r?\\$?\\s*${money}`,
      "gi",
    ),
  )) {
    push(match[1], 92);
  }
  for (const match of text.matchAll(new RegExp(`r\\$\\s*${money}`, "gi"))) {
    push(match[1], 70);
  }

  if (scored.length === 0) return null;
  // entre "valor total", prefere o maior (evita item 10,99)
  const totals = scored.filter((s) => s.score >= 92);
  const pool = totals.length > 0 ? totals : scored;
  pool.sort((a, b) => b.score - a.score || b.value - a.value);
  return pool[0].value;
}

function cleanInvoiceCandidate(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/[^\w./-]/g, "")
    .toUpperCase();
  if (!cleaned) return null;
  if (/^\d{44}$/.test(cleaned)) return null;
  if (/^\d{11}$/.test(cleaned) || /^\d{14}$/.test(cleaned)) return null;
  if (/^\d{5}-?\d{3}$/.test(cleaned)) return null;
  if (!/\d/.test(cleaned)) return null;
  if (cleaned.length < 3 || cleaned.length > 20) return null;
  if (/^0+\d{0,2}$/.test(cleaned) && cleaned.length <= 3) return null;
  return cleaned;
}

export function parseInvoiceNumber(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates: Array<{ value: string; score: number }> = [];

  const push = (raw: string | undefined, score: number) => {
    if (!raw) return;
    const cleaned = cleanInvoiceCandidate(raw);
    if (!cleaned) return;
    if (/^\d{44}$/.test(cleaned)) return;
    candidates.push({ value: cleaned, score });
  };

  const accessKeyMatch = text.match(/(?:^|\D)(\d{44})(?:\D|$)/);
  if (accessKeyMatch) {
    const key = accessKeyMatch[1];
    const nNF = key.slice(25, 34).replace(/^0+/, "") || key.slice(25, 34);
    const serie =
      key.slice(22, 25).replace(/^0+/, "") || key.slice(22, 25);
    push(nNF, 70);
    if (serie && Number(serie) > 0) push(`${nNF}-${serie}`, 72);
  }

  const nfceBlock =
    /(?:NFCE|NFE)\s*(?:No)?\s*[:=#-]?\s*(\d{4,12})(?:\s+Serie\s*[:=]?\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(nfceBlock)) {
    if (match[2]) push(`${match[1]}-${match[2]}`, 98);
    push(match[1], 96);
  }

  const noSerie =
    /\bNo\s*[:=#-]?\s*(\d{4,12})\s+Serie\s*[:=]?\s*(\d{1,4})\b/gi;
  for (const match of text.matchAll(noSerie)) {
    push(`${match[1]}-${match[2]}`, 94);
    push(match[1], 92);
  }

  const dirtyNfce =
    /(?:[WNMH][FEPCMAE][CEGOA][\s.-]*e?|nfc[\s-]*e|nfce?|mec|eca)\s*(?:ni|n1|nl|nd|ne|no\.?)?\s*[:=#\-/]?\s*(\d{3,12})(?:\s+s[eéo0]rie\s*[:=]?\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(dirtyNfce)) {
    if (match[1].length > 12) continue;
    // "363/38" → tenta juntar como 363738 se OCR partiu
    const num = match[1].replace("/", "");
    if (match[2]) push(`${num}-${match[2]}`, 97);
    push(num, 95);
  }

  // "363/38 Serie" padrão da Callfarma com barra no meio
  for (const match of text.matchAll(
    /\b(\d{3})\/(\d{2,3})\s+Serie\s*[:=]?\s*(\d{1,4})/gi,
  )) {
    push(`${match[1]}${match[2]}-${match[3]}`, 96);
    push(`${match[1]}${match[2]}`, 94);
  }

  for (const match of text.matchAll(
    /(?:numero|n[uú]mero|no\.?)\s*(?:da\s+)?(?:nota|nf|nfce?|cupom|doc(?:umento)?|fatura)?\s*[:=#-]?\s*([0-9]{4,12})/gi,
  )) {
    if (match[1].length <= 12) push(match[1], 90);
  }

  for (const match of text.matchAll(
    /(?:coo|extrato|cupom)\s*(?:no\.?)?\s*[:=#-]?\s*([0-9]{4,12})/gi,
  )) {
    if (match[1].length <= 12) push(match[1], 80);
  }

  for (const line of lines) {
    const lower = line.toLowerCase();
    const looksLikeInvoice =
      /nf|wec|nec|nota|cupom|coo|danfe|serie|extrato|consumidor/.test(lower) &&
      !/total|valor|r\$|cnpj|cpf|tribut|chave|consulta/.test(lower);
    if (!looksLikeInvoice) continue;
    const near = line.match(
      /(?:no|ni|n1|nl)\s*[:=#-]?\s*(\d{4,12})(?:\s+serie\s*[:=]?\s*(\d{1,4}))?/i,
    );
    if (near) {
      if (near[2]) push(`${near[1]}-${near[2]}`, 93);
      push(near[1], 91);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const aLen = a.value.replace(/\D/g, "").length;
    const bLen = b.value.replace(/\D/g, "").length;
    const aNice = aLen >= 4 && aLen <= 9 ? 1 : 0;
    const bNice = bLen >= 4 && bLen <= 9 ? 1 : 0;
    if (aNice !== bNice) return bNice - aNice;
    return aLen - bLen;
  });
  return candidates[0].value;
}

export function parseExpenseDate(text: string): string | null {
  const scored: Array<{ iso: string; score: number }> = [];
  const consider = (
    day: string,
    month: string,
    yearRaw: string,
    score: number,
  ) => {
    const formatted = formatDateParts(day, month, yearRaw);
    if (!formatted) return;
    const [dd, mm, yyyy] = formatted.split("/");
    const iso = `${yyyy}-${mm}-${dd}`;
    const date = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const max = Date.now() + 2 * 24 * 60 * 60 * 1000;
    if (date.getTime() > max) return;
    scored.push({ iso, score });
  };

  for (const match of text.matchAll(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\s+\d{1,2}[:hH]\d{2}(?::\d{2})?\b/g,
  )) {
    consider(match[1], match[2], match[3], 95);
  }
  for (const match of text.matchAll(
    /Serie\s*\d{1,4}\s+(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/gi,
  )) {
    consider(match[1], match[2], match[3], 94);
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})\s+(\d{1,2})\/(\d{2,4})\s+\d{1,2}[:hH]\d{2}/g,
  )) {
    consider(match[1], match[2], match[3], 93);
  }
  for (const match of text.matchAll(
    /(?:data|emiss[aã]o|emitid[ao]|dt\.?)\s*[:=]?\s*(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/gi,
  )) {
    consider(match[1], match[2], match[3], 90);
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g,
  )) {
    consider(match[1], match[2], match[3], 60);
  }
  for (const match of text.matchAll(/\b(\d{1,2})\s+(\d{1,2})\/(\d{2,4})\b/g)) {
    consider(match[1], match[2], match[3], 85);
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].iso;
}

export function parseMerchantName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4);
  const skip =
    /cnpj|cpf|ie\b|im\b|documento|auxiliar|nota fiscal|consumidor|endereco|endereço|rua|av\.|telefone|total|valor|r\$|forma|pagamento|cartao|cartão|serie|nfce|chave|protocolo|tribut|qtd|item|descricao|descrição/i;

  for (const line of lines.slice(0, 8)) {
    if (skip.test(line)) continue;
    if (/^[\d\s./-]+$/.test(line)) continue;
    if (line.length < 5 || line.length > 60) continue;
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(line)) continue;
    return line.replace(/\s+/g, " ").slice(0, 80);
  }
  return null;
}

export function suggestCategory(text: string): ExpenseCategory | null {
  const t = text.toLowerCase();
  if (/posto|combust|gasolina|etanol|diesel|shell|ipiranga|petrobras/.test(t)) {
    return "combustivel";
  }
  if (/hotel|pousada|hosped|motel|booking/.test(t)) return "hotel";
  if (
    /restaur|lanch|padaria|cafe|café|bar |pizza|burger|mcdonald|ifood|refei/.test(
      t,
    )
  ) {
    return "refeicao";
  }
  if (/pedagio|pedágio|sem parar|conectcar|toll/.test(t)) return "pedagio";
  if (/farma|drogaria|mercado|supermerc|atacad|loja|magazine/.test(t)) {
    return "outros";
  }
  return null;
}

export type OcrExpenseResult = OcrResult & {
  date: string | null;
  merchant: string | null;
  category: ExpenseCategory | null;
  provider?: "google-vision" | "tesseract";
};

export function parseExpenseFields(text: string): OcrExpenseResult {
  const normalized = normalizeOcrText(text);
  const amount =
    parseBrazilianAmount(normalized) ?? parseBrazilianAmount(text);
  const invoiceNumber =
    parseInvoiceNumber(normalized) ?? parseInvoiceNumber(text);
  const date = parseExpenseDate(normalized) ?? parseExpenseDate(text);
  const merchant = parseMerchantName(normalized) ?? parseMerchantName(text);
  const category = suggestCategory(normalized) ?? suggestCategory(text);
  const filled =
    Number(amount != null) +
    Number(Boolean(invoiceNumber)) +
    Number(Boolean(date));

  return {
    amount,
    invoiceNumber,
    date,
    merchant,
    category,
    rawText: normalized || text,
    confidence: Math.min(0.95, 0.55 + filled * 0.12),
  };
}
