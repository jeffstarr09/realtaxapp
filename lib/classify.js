// Rule-based classifier tuned for a real-estate-agent S-corp.
// Convention: tx.amount > 0 = money out (charge); < 0 = money in (payment/credit/refund).
// Output: { category, deductible: "Yes" | "Review" | "No", confidence: 0..1, reason }

const RULES = [
  // ---- Strong-business categories (high confidence Yes) ----
  {
    category: "MLS / Dues / Licensing",
    keywords: [
      "mls", "nar ", "national assoc of realtors", "national association of realtors",
      "realtor", "car ", "california assoc", "association of realtors", "supra",
      "lockbox", "ekey", "dre ", "department of real estate", "license renew",
    ],
    deductible: "Yes",
    confidence: 0.95,
    reason: "Real estate licensing / association dues",
  },
  {
    category: "E&O / Business Insurance",
    keywords: ["e&o insurance", "errors and omissions", "victor o schinnerer", "rice insurance", "pearl insurance"],
    deductible: "Yes", confidence: 0.95, reason: "Errors & omissions insurance",
  },
  {
    category: "Marketing / Advertising",
    keywords: [
      "vistaprint", "moo.com", "canva", "constant contact", "mailchimp", "facebook ads",
      "fb ads", "meta platforms", "google ads", "googleads", "yelp", "zillow premier",
      "realtor.com", "homes.com", "ylopo", "boomtown", "kvcore", "lofty",
      "sign", "yard sign", "open house", "brochure", "flyer", "postcard",
    ],
    deductible: "Yes", confidence: 0.9, reason: "Marketing / advertising for listings",
  },
  {
    category: "Photography / Staging / Listing Prep",
    keywords: ["photograph", "matterport", "drone", "aerial", "staging", "stager", "virtuance", "hommati", "tourfactory"],
    deductible: "Yes", confidence: 0.9, reason: "Listing photography / staging",
  },
  {
    category: "Software / Subscriptions",
    keywords: [
      "docusign", "dotloop", "skyslope", "ziplogix", "ziform", "zipforms", "transactiondesk",
      "dropbox", "google workspace", "google *gsuite", "microsoft 365", "office 365",
      "adobe", "notion", "calendly", "hubspot", "salesforce", "follow up boss", "followupboss",
      "wise agent", "top producer", "chime", "lionsbase",
    ],
    deductible: "Yes", confidence: 0.9, reason: "Business software / SaaS",
  },
  {
    category: "Continuing Education",
    keywords: ["continuing education", "ce course", "ce class", "kaplan", "the ce shop", "mbition", "real estate express", "colibri"],
    deductible: "Yes", confidence: 0.95, reason: "Continuing education for license",
  },
  {
    category: "Auto - Fuel",
    keywords: ["chevron", "shell oil", "shell service", "exxon", "mobil", "arco", "76 ", "valero", "bp ", "circle k", "speedway", "sunoco", "costco gas", "sam's gas"],
    deductible: "Review", confidence: 0.6, reason: "Fuel — may be business mileage (track with mileage log)",
  },
  {
    category: "Auto - Tolls / Parking",
    keywords: ["fastrak", "fas trak", "ezpass", "ez pass", "parking", "parkmobile", "spothero", "premier parking", "ace parking", "laz parking"],
    deductible: "Review", confidence: 0.65, reason: "Tolls/parking — deductible if for business trip",
  },
  {
    category: "Auto - Service / Maintenance",
    keywords: ["jiffy lube", "valvoline", "midas", "firestone", "discount tire", "les schwab", "auto repair", "smog check"],
    deductible: "Review", confidence: 0.5, reason: "Vehicle maintenance — partial business use",
  },
  {
    category: "Phone / Internet",
    keywords: ["verizon", "at&t", "att*bill", "t-mobile", "tmobile", "sprint", "comcast", "xfinity", "spectrum", "cox comm"],
    deductible: "Review", confidence: 0.5, reason: "Phone/internet — business-use percentage",
  },
  {
    category: "Office Supplies",
    keywords: ["staples", "office depot", "officemax", "amazon business"],
    deductible: "Review", confidence: 0.55, reason: "Office supplies — verify business use",
  },
  {
    category: "Client Gifts",
    keywords: ["edible arrangements", "harry & david", "1-800-flowers", "1800flowers", "shari's berries", "closing gift", "cutco"],
    deductible: "Review", confidence: 0.7, reason: "Client gift — IRS limit $25/person/year",
  },
  {
    category: "Meals (Client / Business)",
    keywords: ["restaurant", "grill", "bistro", "cafe", "café", "kitchen", "tavern", "starbucks", "doordash", "ubereats", "uber eats", "grubhub", "panera", "chipotle"],
    deductible: "Review", confidence: 0.4, reason: "Meal — deductible only if business purpose documented (50%)",
  },
  {
    category: "Travel - Airfare",
    keywords: ["united airl", "american airl", "delta air", "southwest air", "alaska air", "jetblue", "frontier", "spirit air"],
    deductible: "Review", confidence: 0.5, reason: "Airfare — deductible if business trip",
  },
  {
    category: "Travel - Lodging",
    keywords: ["marriott", "hilton", "hyatt", "ihg", "holiday inn", "hampton inn", "airbnb", "vrbo", "best western"],
    deductible: "Review", confidence: 0.5, reason: "Lodging — deductible if business trip",
  },
  {
    category: "Rideshare",
    keywords: ["uber   ", "uber trip", "lyft"],
    deductible: "Review", confidence: 0.5, reason: "Rideshare — deductible if business purpose",
  },
  {
    category: "Bank / CC Fees",
    keywords: ["annual membership fee", "annual fee", "foreign transaction fee", "late fee", "interest charge", "finance charge"],
    deductible: "Review", confidence: 0.5, reason: "Fees — deductible on business accounts only",
  },
  {
    category: "Payment / Transfer",
    keywords: ["payment thank you", "autopay payment", "online payment", "mobile payment", "payment - thank you", "internet payment"],
    deductible: "No", confidence: 0.99, reason: "Card payment / transfer",
  },
];

const NON_DEDUCTIBLE_HINTS = [
  { kw: "netflix", reason: "Personal entertainment" },
  { kw: "spotify", reason: "Personal entertainment" },
  { kw: "hulu", reason: "Personal entertainment" },
  { kw: "disney plus", reason: "Personal entertainment" },
  { kw: "playstation", reason: "Personal entertainment" },
  { kw: "xbox", reason: "Personal entertainment" },
  { kw: "safeway", reason: "Groceries (personal)" },
  { kw: "trader joe", reason: "Groceries (personal)" },
  { kw: "whole foods", reason: "Groceries (personal)" },
  { kw: "kroger", reason: "Groceries (personal)" },
  { kw: "walmart", reason: "Personal retail" },
  { kw: "target ", reason: "Personal retail" },
];

function classify(tx) {
  const desc = (tx.description || "").toLowerCase();

  // Refunds / payments inbound
  if (tx.amount < 0) {
    if (/payment|thank you|autopay/.test(desc)) {
      return { category: "Payment / Transfer", deductible: "No", confidence: 0.99, reason: "Card payment" };
    }
    return { category: "Refund / Credit", deductible: "No", confidence: 0.9, reason: "Refund or incoming credit" };
  }

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (desc.includes(kw)) {
        return {
          category: rule.category,
          deductible: rule.deductible,
          confidence: rule.confidence,
          reason: rule.reason,
        };
      }
    }
  }

  for (const h of NON_DEDUCTIBLE_HINTS) {
    if (desc.includes(h.kw)) {
      return { category: "Personal", deductible: "No", confidence: 0.85, reason: h.reason };
    }
  }

  return { category: "Uncategorized", deductible: "Review", confidence: 0.2, reason: "No rule matched — manual review" };
}

module.exports = { classify };
