// Standalone script: take an existing unified spreadsheet, filter out rows
// whose Date is in a year other than 2025 (keeping blank dates), re-run
// classification, and write a new spreadsheet.
//
// Usage:
//   node scripts/reclassify.js <input.xlsx> [output.xlsx]
//
// The input file is expected to have a sheet whose first row contains
// headers including at least "Date", "Description", and "Amount". Other
// columns (Source, Account, etc.) are preserved. Category / Deductible /
// Confidence / Reason are overwritten with fresh classification.

const path = require("path");
const ExcelJS = require("exceljs");
const { classify } = require("../lib/classify");

const TAX_YEAR = "2025";

async function main() {
  const [, , inPath, outPathArg] = process.argv;
  if (!inPath) {
    console.error("Usage: node scripts/reclassify.js <input.xlsx> [output.xlsx]");
    process.exit(1);
  }
  const outPath =
    outPathArg ||
    path.join(
      path.dirname(inPath),
      path.basename(inPath, path.extname(inPath)) + "-2025.xlsx"
    );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inPath);

  // Find the sheet that looks like the transaction list — the one with a
  // Description and Amount column. Prefer "All Transactions" if present.
  let sheet =
    wb.getWorksheet("All Transactions") ||
    wb.getWorksheet("Transactions") ||
    wb.worksheets[0];
  if (!sheet) {
    console.error("No worksheets found in", inPath);
    process.exit(1);
  }

  // Read headers (first non-empty row).
  let headerRowIdx = -1;
  let headers = [];
  for (let i = 1; i <= sheet.rowCount; i++) {
    const vals = sheet.getRow(i).values.slice(1).map((v) => cellText(v));
    if (vals.filter((v) => v !== "").length >= 2) {
      headerRowIdx = i;
      headers = vals.map((v) => String(v || "").trim());
      break;
    }
  }
  if (headerRowIdx < 0) {
    console.error("No header row found in sheet", sheet.name);
    process.exit(1);
  }

  const hi = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const dateCol = hi("Date");
  const descCol = hi("Description");
  const amountCol = hi("Amount");
  if (descCol < 0 || amountCol < 0) {
    console.error(
      "Sheet must contain at least Description and Amount columns. Found headers:",
      headers
    );
    process.exit(1);
  }

  // Collect rows into plain objects.
  const rows = [];
  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const raw = sheet.getRow(i).values.slice(1);
    if (raw.every((v) => v == null || v === "")) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      obj[h] = cellText(raw[c]);
    }
    rows.push(obj);
  }
  console.log(`Read ${rows.length} rows from "${sheet.name}"`);

  // Filter: keep rows in 2025 OR with blank date.
  const filtered = rows.filter((r) => {
    const d = (r["Date"] || "").toString().trim();
    if (d === "") return true;
    const yr = extractYear(d);
    return yr === null || yr === TAX_YEAR;
  });
  console.log(
    `Kept ${filtered.length} (filtered out ${rows.length - filtered.length} non-2025 rows with a date)`
  );

  // Re-classify every row.
  for (const r of filtered) {
    const tx = {
      description: r["Description"] || "",
      amount: parseAmount(r["Amount"]),
    };
    const c = classify(tx);
    r["Category"] = c.category;
    r["Deductible"] = c.deductible;
    r["Confidence"] = c.confidence;
    r["Reason"] = c.reason;
  }

  // Write output workbook.
  const outWb = new ExcelJS.Workbook();
  const outSheet = outWb.addWorksheet("All Transactions");
  const outHeaders = Array.from(
    new Set([...headers, "Category", "Deductible", "Confidence", "Reason"])
  );
  outSheet.columns = outHeaders.map((h) => ({
    header: h,
    key: h,
    width: columnWidth(h),
    style: columnStyle(h),
  }));
  outSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  outSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2A48" },
  };
  outSheet.views = [{ state: "frozen", ySplit: 1 }];
  outSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: outHeaders.length },
  };

  for (const r of filtered) {
    const row = {};
    for (const h of outHeaders) row[h] = r[h] ?? "";
    if (typeof row["Amount"] === "string") row["Amount"] = parseAmount(row["Amount"]);
    if (typeof row["Confidence"] === "string" && row["Confidence"].endsWith("%")) {
      row["Confidence"] = parseFloat(row["Confidence"]) / 100;
    }
    outSheet.addRow(row);
  }

  // Color-code the Deductible column.
  const dedColIdx = outHeaders.indexOf("Deductible") + 1;
  if (dedColIdx > 0) {
    outSheet.eachRow((row, i) => {
      if (i === 1) return;
      const v = row.getCell(dedColIdx).value;
      let argb = null;
      if (v === "Yes") argb = "FF1B5E20";
      else if (v === "Review") argb = "FF8D6E00";
      else if (v === "No") argb = "FF424242";
      if (argb) {
        row.getCell(dedColIdx).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb },
        };
        row.getCell(dedColIdx).font = { color: { argb: "FFFFFFFF" }, bold: true };
      }
    });
  }

  // Summary sheet by category.
  const summary = outWb.addWorksheet("Summary");
  summary.columns = [
    { header: "Category", key: "cat", width: 36 },
    {
      header: "Confirmed Deductible ($)",
      key: "yes",
      width: 24,
      style: { numFmt: '"$"#,##0.00' },
    },
    {
      header: "Needs Review ($)",
      key: "review",
      width: 24,
      style: { numFmt: '"$"#,##0.00' },
    },
    { header: "Count", key: "count", width: 10 },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2A48" },
  };

  const totals = {};
  for (const r of filtered) {
    const cat = r["Category"] || "Uncategorized";
    const amt = parseAmount(r["Amount"]) || 0;
    totals[cat] = totals[cat] || { yes: 0, review: 0, count: 0 };
    totals[cat].count++;
    if (r["Deductible"] === "Yes") totals[cat].yes += amt;
    else if (r["Deductible"] === "Review") totals[cat].review += amt;
  }
  let totalYes = 0;
  let totalReview = 0;
  for (const [cat, v] of Object.entries(totals).sort(
    (a, b) => b[1].yes + b[1].review - (a[1].yes + a[1].review)
  )) {
    summary.addRow({ cat, yes: v.yes, review: v.review, count: v.count });
    totalYes += v.yes;
    totalReview += v.review;
  }
  summary.addRow({});
  const totalRow = summary.addRow({
    cat: "TOTAL",
    yes: totalYes,
    review: totalReview,
  });
  totalRow.font = { bold: true };

  await outWb.xlsx.writeFile(outPath);
  console.log(`Wrote ${outPath}`);
  const yes = filtered.filter((r) => r["Deductible"] === "Yes").length;
  const review = filtered.filter((r) => r["Deductible"] === "Review").length;
  console.log(`  ${yes} flagged Yes, ${review} flagged Review`);
}

function extractYear(s) {
  const m = String(s).match(/(\d{4})/);
  return m ? m[1] : null;
}

function parseAmount(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/[$,\s]/g, "")
    .replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v);
}

function columnWidth(h) {
  const w = {
    Date: 12,
    Source: 18,
    "Account / File": 28,
    Account: 28,
    Description: 48,
    Amount: 12,
    Category: 28,
    Deductible: 12,
    Confidence: 12,
    Reason: 50,
  };
  return w[h] || 18;
}

function columnStyle(h) {
  if (h === "Amount") return { numFmt: '"$"#,##0.00;[Red]("$"#,##0.00)' };
  if (h === "Confidence") return { numFmt: "0%" };
  return undefined;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
