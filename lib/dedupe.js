// Deduplicate Amazon order-history items against bank/card charges.
//
// Rule: if ANY Amazon order-history file is loaded, drop EVERY Amazon-looking
// charge on every card statement. The order history is the source of truth
// (it has product detail), so the card-side rows are pure noise once we have
// it. This avoids fragile date/amount matching of multi-item orders, split
// shipments, gift cards, Subscribe & Save, etc.
//
// What counts as an "Amazon-looking charge": description matches AMZN /
// AMAZON / AMZN MKTP / AMZN.COM / AMAZON.COM/BILL / AMAZON PRIME / etc.
// Refunds (negative amounts) are kept so the books still reconcile.

function isAmazonCardCharge(desc) {
  const d = (desc || "").toLowerCase();
  return /\bamzn\b|\bamazon\b|amzn mktp|amzn\.com|amazon\.com\/bill|amazon mktplace|amazon prime|amazon mark|prime video|kindle/.test(d);
}

function dedupeAmazon(transactions) {
  const hasAmazonHistory = transactions.some((tx) => tx.source === "Amazon");
  if (!hasAmazonHistory) {
    return { transactions, removed: 0, matched: 0 };
  }

  let removed = 0;
  const kept = [];
  for (const tx of transactions) {
    if (
      tx.source !== "Amazon" &&
      tx.amount > 0 &&
      isAmazonCardCharge(tx.description)
    ) {
      removed++;
      continue;
    }
    kept.push(tx);
  }
  return { transactions: kept, removed, matched: removed };
}

module.exports = { dedupeAmazon };
