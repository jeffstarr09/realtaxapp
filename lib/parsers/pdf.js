import pdfParse from "pdf-parse";

// Generic best-effort PDF transaction extractor.
// Bank PDFs vary widely; we use line-based regex heuristics that work for the
// common text-based statements from Chase, BoA, Amex, Wells, Citi, Discover.
// Image-only/scanned PDFs will not parse here (would need OCR).

const MONEY = String.raw`-?\$?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?`;
const DATE_MD = String.raw`\d{1,2}\/\d{1,2}(?:\/\d{2,4})?`;

// Match: <date> [<date>] <description> <amount>
const LINE_RE = new RegExp(
  `^(${DATE_MD})\\s+(?:(${DATE_MD})\\s+)?(.+?)\\s+(${MONEY})\\s*$`
);

function parseMoney(s) {
  let neg = false;
  s = s.trim();
  if (s.startsWith("(") && s.endsWith(")")) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  s = s.replace(/[$,]/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function inferYear(text) {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? m[1] : String(new Date().getFullYear());
}

function normalizeDate(d, yearHint) {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return d;
  let [, mo, day, y] = m;
  if (!y) y = yearHint;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function parsePdf(buffer, source, filename) {
  const data = await pdfParse(buffer);
  const text = data.text || "";
  const yearHint = inferYear(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const out = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const date = normalizeDate(m[1], yearHint);
    const description = m[3].replace(/\s{2,}/g, " ").trim();
    const amount = parseMoney(m[4]);
    if (amount == null) continue;
    // Skip obvious noise lines
    if (/^(beginning|ending|previous|new) balance/i.test(description)) continue;
    if (/^total\b/i.test(description)) continue;

    // For credit card statements, charges are usually positive, payments negative.
    // For bank statement detail tables, debits often have parens. Our parser already handled signs.
    let amt = amount;
    if (/payment.*thank/i.test(description) || /^payment\b/i.test(description)) {
      amt = -Math.abs(amt);
    }
    out.push({
      date,
      description,
      amount: amt,
      source,
      account: filename,
      raw: line,
    });
  }
  return out;
}
