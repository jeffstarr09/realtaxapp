const Papa = require("papaparse");

// Each bank uses different headers. We normalize into:
// { date, description, amount, source, account, type }
// Convention for amount: positive = money OUT (charge/debit), negative = money IN (payment/credit/refund).

const HEADER_MAP = {
  date: ["transaction date", "trans date", "post date", "posting date", "date"],
  description: ["description", "details", "memo", "merchant", "payee", "name"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "withdrawals", "withdrawal"],
  credit: ["credit", "deposits", "deposit"],
  type: ["type", "transaction type"],
};

function pick(row, keys) {
  for (const k of keys) {
    for (const h of Object.keys(row)) {
      if (h && h.trim().toLowerCase() === k) return row[h];
    }
  }
  return undefined;
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[$,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeAmount(row, source) {
  const amt = toNumber(pick(row, HEADER_MAP.amount));
  if (amt != null) {
    // Chase/Amex/Discover: charges negative, payments positive in some exports; flip so charges positive.
    // Heuristic: if "type" exists, use it.
    const t = (pick(row, HEADER_MAP.type) || "").toString().toLowerCase();
    if (t.includes("payment") || t.includes("credit") || t.includes("refund") || t.includes("return")) {
      return -Math.abs(amt);
    }
    if (t.includes("sale") || t.includes("debit") || t.includes("purchase") || t.includes("charge")) {
      return Math.abs(amt);
    }
    // Default sign convention by issuer:
    if (source === "American Express" || source === "Discover" || source === "Citi") {
      // exports usually show charges as positive
      return amt;
    }
    // Chase / BoA / Wells often show charges as negative
    return -amt;
  }
  const debit = toNumber(pick(row, HEADER_MAP.debit));
  const credit = toNumber(pick(row, HEADER_MAP.credit));
  if (debit != null && debit !== 0) return Math.abs(debit);
  if (credit != null && credit !== 0) return -Math.abs(credit);
  return null;
}

function normalizeDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return s;
}

function parseCsv(buffer, source, filename) {
  const text = buffer.toString("utf8");
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  const out = [];
  for (const row of res.data) {
    const date = normalizeDate(pick(row, HEADER_MAP.date));
    const description = (pick(row, HEADER_MAP.description) || "").toString().trim();
    const amount = normalizeAmount(row, source);
    if (!description || amount == null) continue;
    out.push({
      date,
      description,
      amount,
      source,
      account: filename,
      raw: JSON.stringify(row),
    });
  }
  return out;
}

module.exports = { parseCsv };
