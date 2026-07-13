function formatDateParts(day, month, yearRaw) {
  let year = yearRaw;
  if (year.length === 2) year = `20${year}`;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function normalizeOcrText(text) {
  let out = text.replace(/\u00a0/g, " ");
  out = out.replace(/\b[WNMH][FEPC][CEOG][\s-]*e\b/gi, "NFCE");
  out = out.replace(/\bNFC[\s-]*e\b/gi, "NFCE");
  out = out.replace(/\b(?:ni|n1|nl)\s+(?=\d{4,})/gi, "No ");
  out = out.replace(/\bS[eé]rie\b/gi, "Serie");
  out = out.replace(/\b(\d{1,2})\s+(\d{1,2})[\/\-.](\d{2,4})\b/g, (_, d, m, y) => {
    return formatDateParts(d, m, y) ?? `${d}/${m}/${y}`;
  });
  out = out.replace(/[ \t]+/g, " ");
  return out.trim();
}

function cleanInvoiceCandidate(raw) {
  const cleaned = raw.replace(/\s+/g, "").replace(/[^\w./-]/g, "").toUpperCase();
  if (!cleaned) return null;
  if (/^\d{44}$/.test(cleaned)) return null;
  if (cleaned.length < 3 || cleaned.length > 20) return null;
  if (/^\d{11}$/.test(cleaned) || /^\d{14}$/.test(cleaned)) return null;
  return cleaned;
}

function parseInvoiceNumber(text) {
  const candidates = [];
  const push = (raw, score) => {
    const cleaned = cleanInvoiceCandidate(raw);
    if (!cleaned) return;
    if (/^\d{44}$/.test(cleaned)) return;
    candidates.push({ value: cleaned, score });
  };

  const accessKeyMatch = text.match(/(?:^|\D)(\d{44})(?:\D|$)/);
  if (accessKeyMatch) {
    const key = accessKeyMatch[1];
    const nNF = key.slice(25, 34).replace(/^0+/, "") || key.slice(25, 34);
    push(nNF, 70);
  }

  for (const match of text.matchAll(
    /(?:NFCE|NFE)\s*(?:No)?\s*[:=#-]?\s*(\d{4,12})(?:\s+Serie\s*[:=]?\s*(\d{1,4}))?/gi,
  )) {
    if (match[2]) push(`${match[1]}-${match[2]}`, 98);
    push(match[1], 96);
  }

  for (const match of text.matchAll(
    /(?:[WNMH][FEPC][CEOG][\s-]*e|nfc[\s-]*e|nfce?)\s*(?:ni|n1|nl|no\.?)?\s*[:=#-]?\s*(\d{4,12})(?:\s+s[eé]rie\s*[:=]?\s*(\d{1,4}))?/gi,
  )) {
    if (match[1].length > 12) continue;
    if (match[2]) push(`${match[1]}-${match[2]}`, 97);
    push(match[1], 95);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value ?? null;
}

const sample = `VALOR TOTAL R$ 49,96
1 WEC-e ni 363736 Série 55 13 7/2026 12:53:26
80119037207001923569503802169969109900449961`;

const n = normalizeOcrText(sample);
console.log("normalized snippet ok");
console.log("invoice:", parseInvoiceNumber(n) || parseInvoiceNumber(sample));
