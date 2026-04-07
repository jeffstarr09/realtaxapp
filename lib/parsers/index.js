const { parseCsv } = require("./csv");
const { parsePdf } = require("./pdf");
const { parseXlsx } = require("./xlsx");

async function parseFile(filename, buffer) {
  const lower = filename.toLowerCase();
  const source = detectSource(filename);
  if (lower.endsWith(".csv")) return parseCsv(buffer, source, filename);
  if (lower.endsWith(".pdf")) return parsePdf(buffer, source, filename);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseXlsx(buffer, source, filename);
  return [];
}

function detectSource(name) {
  const n = name.toLowerCase();
  if (
    n.includes("amazon") ||
    n.includes("orderhistory") ||
    n.includes("order_history") ||
    n.includes("retail.order") ||
    n.includes("retailorder") ||
    n.includes("your orders") ||
    n.includes("your_orders")
  ) return "Amazon";
  if (n.includes("chase")) return "Chase";
  if (n.includes("bofa") || n.includes("bankofamerica") || n.includes("boa")) return "Bank of America";
  if (n.includes("amex") || n.includes("americanexpress")) return "American Express";
  if (n.includes("wells") || n.includes("wf")) return "Wells Fargo";
  if (n.includes("citi")) return "Citi";
  if (n.includes("discover")) return "Discover";
  return "Unknown";
}

module.exports = { parseFile };
