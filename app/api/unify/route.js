import { NextResponse } from "next/server";
import { parseFile } from "../../../lib/parsers/index.js";
import { classify } from "../../../lib/classify.js";
import { buildWorkbook } from "../../../lib/excel.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const form = await req.formData();
    const files = form.getAll("files");
    if (!files.length) return new NextResponse("No files uploaded", { status: 400 });

    const allTx = [];
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const parsed = await parseFile(f.name, buf);
      for (const tx of parsed) allTx.push(tx);
    }

    for (const tx of allTx) {
      const c = classify(tx);
      tx.category = c.category;
      tx.deductible = c.deductible;
      tx.confidence = c.confidence;
      tx.reason = c.reason;
    }

    allTx.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const xlsx = await buildWorkbook(allTx);
    const dedCount = allTx.filter((t) => t.deductible === "Yes" || t.deductible === "Review").length;

    return new NextResponse(xlsx, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="realtax-unified.xlsx"',
        "X-Tx-Count": String(allTx.length),
        "X-Deductible-Count": String(dedCount),
      },
    });
  } catch (err) {
    console.error(err);
    return new NextResponse("Error: " + err.message, { status: 500 });
  }
}
