// Deduplicate Amazon order-history items against bank/card charges.
//
// When you import Amazon's "Request My Data" export AND the credit card
// statement that paid for those orders, every order shows up twice:
//   1. As a line item from Amazon (descriptive: "Amazon: DEWALT 20V Drill")
//   2. As a charge on the card ("AMZN MKTP US*A12B3 Amzn.com/bill WA")
//
// We keep the Amazon row (because it has the product detail the classifier
// needs) and drop the matching card charge. Matching rules:
//   - card charge description normalizes to contain "amzn" or "amazon"
//   - same absolute amount (within $0.01)
//   - card charge date is within ±5 days of the Amazon order date
//     (Amazon often charges on ship date, not order date)
//
// We tag the surviving Amazon row's `account` with the matched card so you
// can see which card paid for it in the final spreadsheet.

function isAmazonCardCharge(desc) {
  const d = (desc || "").toLowerCase();
  return /\bamzn\b|\bamazon\b|amzn mktp|amzn\.com|amazon\.com\/bill|amazon mktplace|amazon prime|amazon mark/.test(d);
}

function dedupeAmazon(transactions) {
  const amazonRows = [];
  const cardAmazonCharges = [];
  const others = [];

  for (const tx of transactions) {
    if (tx.source === "Amazon") amazonRows.push(tx);
    else if (isAmazonCardCharge(tx.description) && tx.amount > 0) cardAmazonCharges.push(tx);
    else others.push(tx);
  }

  if (amazonRows.length === 0) {
    // No Amazon order history loaded — nothing to dedupe.
    return { transactions, removed: 0, matched: 0 };
  }

  // For each card charge, find a matching Amazon row.
  // Greedy match: each card charge can consume one Amazon row.
  const usedAmazon = new Set();
  const droppedCardCharges = new Set();
  let matched = 0;

  for (let i = 0; i < cardAmazonCharges.length; i++) {
    const charge = cardAmazonCharges[i];
    const chargeDate = parseDate(charge.date);
    const target = Math.abs(charge.amount);
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let j = 0; j < amazonRows.length; j++) {
      if (usedAmazon.has(j)) continue;
      const a = amazonRows[j];
      if (Math.abs(a.amount - target) > 0.01) continue;
      const aDate = parseDate(a.date);
      if (!chargeDate || !aDate) continue;
      const delta = Math.abs((chargeDate - aDate) / 86400000);
      if (delta > 5) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      usedAmazon.add(bestIdx);
      droppedCardCharges.add(i);
      // Tag the Amazon row with the card it was paid on.
      const a = amazonRows[bestIdx];
      a.paidWith = charge.source;
      a.account = `${a.account} (paid via ${charge.source})`;
      matched++;
    }
  }

  const survivingCardCharges = cardAmazonCharges.filter((_, i) => !droppedCardCharges.has(i));
  const merged = [...others, ...amazonRows, ...survivingCardCharges];
  return { transactions: merged, removed: droppedCardCharges.size, matched };
}

function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

module.exports = { dedupeAmazon };
