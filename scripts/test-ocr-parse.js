function normalizeOcrText(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\b[WNMH][FEPC][CEOG][\s-]*e\b/gi, 'NFCE')
    .replace(/\bNFCE\b/gi, 'NFCE')
    .replace(/\bNFE\b/gi, 'NFE')
    .replace(/\bN[º°]\b/gi, 'No')
    .replace(/\bN[oO0]\.(?=\s|\d)/g, 'No ')
    .replace(/\b(?:ni|n1|nl|n!|n\|)\s*(?=\d{4,})/gi, 'No ')
    .replace(/\bS[eé]rie\b/gi, 'Serie')
    .replace(/(\d)\s*[.,]\s*(\d{2})\b/g, ',')
    .replace(/\b(\d{1,2})\s+(\d{1,2})[\/\-.](\d{2,4})\b/g, (_, d, m, y) => d.padStart(2,'0')+'/'+m.padStart(2,'0')+'/'+y)
    .replace(/(\d{2})\s*[\/\-.\s|]\s*(\d{2})\s*[\/\-.\s|]\s*(\d{2,4})/g, '//')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
function cleanInvoiceCandidate(raw) {
  const cleaned = raw.replace(/\s+/g,'').replace(/[^\w./-]/g,'').toUpperCase();
  if (!cleaned) return null;
  if (/^\d{11}$/.test(cleaned) || /^\d{14}$/.test(cleaned)) return null;
  if (!/\d/.test(cleaned)) return null;
  if (cleaned.length < 3 || cleaned.length > 44) return null;
  if (/^0+\d{0,2}$/.test(cleaned) && cleaned.length <= 3) return null;
  return cleaned;
}
function parseInvoiceNumber(text) {
  const candidates = [];
  const push = (raw, score) => {
    const cleaned = cleanInvoiceCandidate(raw);
    if (!cleaned) return;
    candidates.push({ value: cleaned, score });
  };
  const nfceBlock = /(?:NFCE|NFE|NFC[\s-]?E|[WNMH][FEPC][CEOG][\s-]*e)\s*(?:No|N[oO0º°.]|ni|n1|nl)?\s*[:=#-]?\s*(\d{4,12})(?:\s+Serie\s*[:=]?\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(nfceBlock)) {
    if (match[2]) push(match[1]+'-'+match[2], 98);
    push(match[1], 96);
  }
  const noSerie = /\bNo\s*[:=#-]?\s*(\d{4,12})\s+Serie\s*[:=]?\s*(\d{1,4})\b/gi;
  for (const match of text.matchAll(noSerie)) {
    push(match[1]+'-'+match[2], 94);
    push(match[1], 92);
  }
  candidates.sort((a,b)=>b.score-a.score||b.value.length-a.value.length);
  return candidates[0]?.value ?? null;
}
function parseExpenseDate(text) {
  const scored = [];
  const consider = (day, month, yearRaw, score) => {
    let year = yearRaw.length===2 ? '20'+yearRaw : yearRaw;
    const d=+day,m=+month,y=+year;
    if (d<1||d>31||m<1||m>12||y<2000||y>2100) return;
    const iso = y.toString().padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    scored.push({iso, score});
  };
  for (const match of text.matchAll(/\b(\d{1,2})[\/\-.\s]+(\d{1,2})[\/\-.](\d{2,4})\s+\d{1,2}[:hH]\d{2}(?::\d{2})?\b/g)) consider(match[1],match[2],match[3],95);
  for (const match of text.matchAll(/Serie\s*\d{1,4}\s+(\d{1,2})[\/\-.\s]+(\d{1,2})[\/\-.](\d{2,4})/gi)) consider(match[1],match[2],match[3],92);
  for (const match of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)) consider(match[1],match[2],match[3],60);
  for (const match of text.matchAll(/\b(\d{1,2})\s+(\d{1,2})\/(\d{2,4})\b/g)) consider(match[1],match[2],match[3],85);
  scored.sort((a,b)=>b.score-a.score);
  return scored[0]?.iso ?? null;
}
function parseAmount(text) {
  const m = [...text.matchAll(/r\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi)].map(x=>x[1]);
  return m[m.length-1] ?? null;
}
const sample = 'VALOR TOTAL R$ 49,96\n1 WEC-e ni 363736 Série 55 13 7/2026 12:53:26';
const n = normalizeOcrText(sample);
console.log('normalized:', n);
console.log('amount:', parseAmount(n));
console.log('invoice:', parseInvoiceNumber(n));
console.log('date:', parseExpenseDate(n));
