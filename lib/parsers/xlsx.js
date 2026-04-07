const ExcelJS = require("exceljs");
const { rowsToTransactions } = require("./csv");

// Parse a .xlsx workbook. Each worksheet's first row is treated as headers,
// and rows are converted to plain objects, then handed off to the same
// row-normalization used for CSVs (so bank/Amazon detection just works).

async function parseXlsx(buffer, source, filename) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const all = [];
  wb.eachSheet((sheet) => {
    const rows = sheetToObjects(sheet);
    if (!rows.length) return;
    const tx = rowsToTransactions(rows, source, `${filename} :: ${sheet.name}`);
    for (const t of tx) all.push(t);
  });
  return all;
}

function sheetToObjects(sheet) {
  // Find the first non-empty row and treat it as headers. This tolerates
  // bank exports that put a couple of summary rows above the table.
  let headerRowIdx = -1;
  let headers = [];
  for (let i = 1; i <= sheet.rowCount; i++) {
    const r = sheet.getRow(i);
    const vals = r.values.slice(1).map((v) => cellText(v));
    const nonEmpty = vals.filter((v) => v !== "").length;
    if (nonEmpty >= 2) {
      headerRowIdx = i;
      headers = vals.map((v) => String(v || "").trim());
      break;
    }
  }
  if (headerRowIdx < 0) return [];

  const out = [];
  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const r = sheet.getRow(i);
    const vals = r.values.slice(1);
    if (vals.every((v) => v == null || v === "")) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      obj[h] = cellText(vals[c]);
    }
    out.push(obj);
  }
  return out;
}

function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v);
}

module.exports = { parseXlsx };
