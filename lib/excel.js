import ExcelJS from "exceljs";

export async function buildWorkbook(transactions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RealTax";
  wb.created = new Date();

  const all = wb.addWorksheet("All Transactions");
  const ded = wb.addWorksheet("Likely Deductible");
  const review = wb.addWorksheet("Needs Review");
  const summary = wb.addWorksheet("Summary");

  const cols = [
    { header: "Date", key: "date", width: 12 },
    { header: "Source", key: "source", width: 18 },
    { header: "Account / File", key: "account", width: 28 },
    { header: "Description", key: "description", width: 48 },
    { header: "Amount", key: "amount", width: 12, style: { numFmt: '"$"#,##0.00;[Red]("$"#,##0.00)' } },
    { header: "Category", key: "category", width: 28 },
    { header: "Deductible", key: "deductible", width: 12 },
    { header: "Confidence", key: "confidence", width: 12, style: { numFmt: "0%" } },
    { header: "Reason", key: "reason", width: 50 },
  ];

  for (const ws of [all, ded, review]) {
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A48" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  const totals = {};
  for (const tx of transactions) {
    const row = {
      date: tx.date,
      source: tx.source,
      account: tx.account,
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      deductible: tx.deductible,
      confidence: tx.confidence,
      reason: tx.reason,
    };
    all.addRow(row);
    if (tx.deductible === "Yes") ded.addRow(row);
    if (tx.deductible === "Review") review.addRow(row);

    if (tx.deductible === "Yes" || tx.deductible === "Review") {
      const key = tx.category || "Uncategorized";
      totals[key] = totals[key] || { yes: 0, review: 0 };
      if (tx.deductible === "Yes") totals[key].yes += tx.amount;
      else totals[key].review += tx.amount;
    }
  }

  // Color code Deductible column on All sheet
  all.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.getCell(7).value;
    let argb = null;
    if (v === "Yes") argb = "FF1B5E20";
    else if (v === "Review") argb = "FF8D6E00";
    else if (v === "No") argb = "FF424242";
    if (argb) {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      row.getCell(7).font = { color: { argb: "FFFFFFFF" }, bold: true };
    }
  });

  // Summary
  summary.columns = [
    { header: "Category", key: "cat", width: 32 },
    { header: "Confirmed Deductible ($)", key: "yes", width: 24, style: { numFmt: '"$"#,##0.00' } },
    { header: "Needs Review ($)", key: "review", width: 24, style: { numFmt: '"$"#,##0.00' } },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A48" } };

  let totalYes = 0, totalReview = 0;
  for (const [cat, v] of Object.entries(totals).sort()) {
    summary.addRow({ cat, yes: v.yes, review: v.review });
    totalYes += v.yes; totalReview += v.review;
  }
  summary.addRow({});
  const totalRow = summary.addRow({ cat: "TOTAL", yes: totalYes, review: totalReview });
  totalRow.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
