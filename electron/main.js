const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { parseFile } = require("../lib/parsers");
const { classify } = require("../lib/classify");
const { buildWorkbook } = require("../lib/excel");
const { dedupeAmazon } = require("../lib/dedupe");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("unify", async (_event, files) => {
  // files: [{ name, data: Uint8Array }]
  let allTx = [];
  for (const f of files) {
    const buf = Buffer.from(f.data);
    const parsed = await parseFile(f.name, buf);
    for (const tx of parsed) allTx.push(tx);
  }

  // Dedupe Amazon order-history rows against matching card charges.
  const dedupeResult = dedupeAmazon(allTx);
  allTx = dedupeResult.transactions;

  for (const tx of allTx) {
    const c = classify(tx);
    tx.category = c.category;
    tx.deductible = c.deductible;
    tx.confidence = c.confidence;
    tx.reason = c.reason;
  }
  allTx.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const xlsx = await buildWorkbook(allTx);
  const dedYes = allTx.filter((t) => t.deductible === "Yes").length;
  const dedReview = allTx.filter((t) => t.deductible === "Review").length;

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save unified workbook",
    defaultPath: "realtax-unified.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, xlsx);
  return {
    canceled: false,
    filePath,
    total: allTx.length,
    dedYes,
    dedReview,
    amazonMatched: dedupeResult.matched,
    amazonRemoved: dedupeResult.removed,
  };
});
