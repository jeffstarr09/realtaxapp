// Rule-based classifier tuned for a real estate agent S-corp + part-of-home rental.
// Convention: tx.amount > 0 = money out (charge); < 0 = money in (payment/credit/refund).
// Output: { category, deductible: "Yes" | "Review" | "No", confidence: 0..1, reason }
//
// Matching strategy:
//   1. Normalize the description (lowercase, strip punctuation/digits/asterisks/hashes)
//      so that real-world merchant strings like "ZILLOW.COM*PREMIER 800-555-1212 WA"
//      reduce to "zillow com premier" and match a "zillow" keyword.
//   2. Walk rules in priority order. First rule wins.
//
// Tax notes baked into the rules:
//   - Real estate licensing/dues, marketing, photography, real-estate SaaS, CE, E&O =>
//     clearly business, flagged Yes.
//   - Hardware stores / home improvement => Review (could be office build-out, listing
//     fix-ups, OR rental property repair, OR personal home).
//   - Utilities / internet / phone => Review (business-use % + rental %).
//   - Meals, gifts, fuel, travel => Review (need business-purpose documentation).
//   - Rental-specific vendors (property mgmt, tenant screening) => Yes for rental.

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[*#]/g, " ")
    .replace(/[^a-z0-9&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RULES = [
  // ============ HIGH-CONFIDENCE BUSINESS (Yes) ============

  {
    category: "MLS / Dues / Licensing",
    keywords: [
      "mls", "nar", "national assoc of realtors", "national association of realtors",
      "association of realtors", "realtor com", "realtors", "car ", "c a r ",
      "supra", "lockbox", "ekey", "sentrilock",
      "dre", "department of real estate", "license renew", "bre ",
    ],
    deductible: "Yes", confidence: 0.95,
    reason: "Real estate licensing / association dues",
  },
  {
    category: "E&O / Business Insurance",
    keywords: [
      "e&o insurance", "errors and omissions", "errors omissions",
      "victor o schinnerer", "rice insurance", "pearl insurance", "calsurance",
    ],
    deductible: "Yes", confidence: 0.95,
    reason: "Errors & omissions / business insurance",
  },
  {
    category: "Marketing / Advertising",
    keywords: [
      "vistaprint", "moo com", "moo print", "canva", "constant contact", "mailchimp",
      "facebook ads", "fb ads", "meta platforms", "meta ads",
      "google ads", "googleads", "google adwords", "adwords",
      "yelp", "nextdoor ads",
      "zillow", "realtor.com", "homes com", "trulia", "redfin partner",
      "ylopo", "boomtown", "kvcore", "lofty", "chime crm",
      "yard sign", "open house sign", "brochure", "flyer print", "postcard print",
      "bombbomb", "videoshop",
    ],
    deductible: "Yes", confidence: 0.9,
    reason: "Marketing / advertising for listings or lead gen",
  },
  {
    category: "Photography / Staging / Listing Prep",
    keywords: [
      "photograph", "photog", "matterport", "drone", "aerial", "iguide",
      "staging", "stager", "stage", "virtuance", "hommati", "tourfactory",
      "boxbrownie", "virtualtoursolution", "spaces virtual",
    ],
    deductible: "Yes", confidence: 0.9,
    reason: "Listing photography / staging / virtual tour",
  },
  {
    category: "Real Estate Software / SaaS",
    keywords: [
      "docusign", "dotloop", "skyslope", "ziplogix", "zipform", "transactiondesk",
      "google workspace", "gsuite", "microsoft 365", "office 365", "ms 365",
      "adobe", "adobe acropro", "acrobat",
      "notion", "calendly", "hubspot", "salesforce",
      "follow up boss", "followupboss", "fub",
      "wise agent", "top producer", "lionsbase", "realgeeks", "real geeks",
      "homesnap", "spacio", "showingtime", "broker mint", "brokermint",
    ],
    deductible: "Yes", confidence: 0.9,
    reason: "Business software / SaaS",
  },
  {
    category: "Continuing Education",
    keywords: [
      "continuing education", "ce shop", "ce course", "ce class",
      "kaplan", "mbition", "real estate express", "colibri", "aceable",
      "360training", "vaned",
    ],
    deductible: "Yes", confidence: 0.95,
    reason: "Continuing education / license renewal training",
  },
  {
    category: "Bank / Card - Business",
    keywords: [
      "intuit quickbooks", "quickbooks", "qbo", "wave accounting",
      "freshbooks", "xero", "gusto", "adp payroll", "paychex",
    ],
    deductible: "Yes", confidence: 0.9,
    reason: "Bookkeeping / payroll software",
  },
  {
    category: "Rental Property - Mgmt / Tenant",
    keywords: [
      "appfolio", "buildium", "rentredi", "avail", "zillow rental",
      "tenant screening", "transunion smartmove", "smartmove",
      "rentprep", "rently", "cozy",
    ],
    deductible: "Yes", confidence: 0.9,
    reason: "Rental property management / tenant screening",
  },

  // ============ REVIEW: MIXED PERSONAL / BUSINESS / RENTAL ============

  {
    category: "Hardware / Home Improvement",
    keywords: [
      "home depot", "homedepot", "lowes", "lowe s", "ace hardware", "true value",
      "harbor freight", "menards", "ferguson", "build com", "ferguson plumb",
      "sherwin williams", "sherwin-williams", "benjamin moore",
      "floor decor", "floor & decor", "lumber", "tile shop",
    ],
    deductible: "Review", confidence: 0.7,
    reason: "Hardware/home improvement — deductible if for rental unit, listing prep, or home office (allocate %)",
  },
  {
    category: "Auto - Fuel",
    keywords: [
      "chevron", "shell", "exxon", "mobil", "arco", "76 ", "valero", "bp ",
      "circle k", "speedway", "sunoco", "costco gas", "sams gas", "sam s gas",
      "wawa", "racetrac", "qt ", "quik trip", "quiktrip", "marathon petrol",
    ],
    deductible: "Review", confidence: 0.6,
    reason: "Fuel — deductible portion = business mileage % (track with mileage log) OR use standard mileage rate instead",
  },
  {
    category: "Auto - Tolls / Parking",
    keywords: [
      "fastrak", "fas trak", "ezpass", "ez pass", "ipass", "sunpass",
      "parking", "parkmobile", "spothero", "premier parking", "ace parking",
      "laz parking", "passport parking", "paybyphone",
    ],
    deductible: "Review", confidence: 0.7,
    reason: "Tolls/parking — deductible if for client showing/business trip",
  },
  {
    category: "Auto - Service / Maintenance",
    keywords: [
      "jiffy lube", "valvoline", "midas", "firestone", "discount tire", "les schwab",
      "auto repair", "smog check", "pep boys", "autozone", "o reilly auto", "oreilly auto",
      "car wash", "carwash", "meineke", "big o tires",
    ],
    deductible: "Review", confidence: 0.55,
    reason: "Vehicle maintenance — deductible by business-use % (only if using actual-expense method)",
  },
  {
    category: "Auto - Insurance / Registration",
    keywords: [
      "geico", "progressive", "state farm auto", "allstate", "liberty mutual",
      "farmers ins", "usaa auto", "dmv", "vehicle registration",
    ],
    deductible: "Review", confidence: 0.55,
    reason: "Auto insurance/registration — deductible by business-use % (actual-expense method)",
  },
  {
    category: "Phone",
    keywords: ["verizon", "at&t", "att ", "t-mobile", "tmobile", "t mobile", "sprint", "mint mobile", "google fi"],
    deductible: "Review", confidence: 0.75,
    reason: "Cell phone — deductible by business-use % (commonly 50–80% for an active agent)",
  },
  {
    category: "Internet / Cable",
    keywords: ["comcast", "xfinity", "spectrum", "cox comm", "cox communic", "frontier comm", "centurylink", "fios", "starlink", "wow internet"],
    deductible: "Review", confidence: 0.75,
    reason: "Internet — deductible by business + rental allocation (home office %, plus rental unit if separate)",
  },
  {
    category: "Utilities (Home / Rental)",
    keywords: ["pg&e", "pge ", "socalgas", "so cal gas", "edison", "sce ", "duke energy", "dominion", "national grid", "water dept", "city of "],
    deductible: "Review", confidence: 0.7,
    reason: "Utilities — deductible portion = home office % + rental unit % of square footage",
  },
  {
    category: "Office Supplies",
    keywords: [
      "staples", "office depot", "officemax", "office max", "amazon business",
      "fedex office", "fedex print", "the ups store", "ups store", "kinkos",
      "quill com", "ream paper",
    ],
    deductible: "Review", confidence: 0.7,
    reason: "Office supplies / printing — likely business",
  },
  {
    category: "Client Gifts",
    keywords: [
      "edible arrangement", "harry & david", "harry and david", "1 800 flowers",
      "1800flowers", "shari s berries", "closing gift", "cutco",
      "godiva", "see s candies", "sees candies", "wine club", "winc",
    ],
    deductible: "Review", confidence: 0.75,
    reason: "Client gift — deductible up to $25/recipient/year (IRC §274(b))",
  },
  {
    category: "Meals (Client / Business)",
    keywords: [
      "restaurant", "grill", "bistro", "cafe", "cafeteria", "kitchen", "tavern",
      "starbucks", "peets", "peet s coffee", "philz", "dutch bros",
      "doordash", "ubereats", "uber eats", "grubhub", "postmates", "caviar",
      "panera", "chipotle", "sweetgreen", "shake shack", "in n out", "in-n-out",
      "subway", "mcdonald", "chick fil a", "chick-fil-a", "jersey mike",
      "pizza", "sushi", "thai", "ramen", "taqueria", "deli", "bakery",
      "bar & grill", "steakhouse", "bbq",
    ],
    deductible: "Review", confidence: 0.4,
    reason: "Meal — 50% deductible if business purpose documented (client/prospect/closing)",
  },
  {
    category: "Travel - Airfare",
    keywords: [
      "united airl", "united.com", "american airl", "aa.com", "delta air",
      "southwest air", "southwest.com", "alaska air", "alaskaair", "jetblue",
      "frontier air", "spirit air", "hawaiian air",
    ],
    deductible: "Review", confidence: 0.6,
    reason: "Airfare — deductible if primarily for business (conference, training, out-of-area client)",
  },
  {
    category: "Travel - Lodging",
    keywords: [
      "marriott", "hilton", "hyatt", "ihg", "holiday inn", "hampton inn",
      "airbnb", "vrbo", "best western", "wyndham", "sheraton", "westin",
      "courtyard", "doubletree", "embassy suites", "fairmont", "kimpton",
    ],
    deductible: "Review", confidence: 0.6,
    reason: "Lodging — deductible if business trip (conference / out-of-area showing)",
  },
  {
    category: "Rideshare / Taxi",
    keywords: ["uber trip", "uber  ", "lyft", "yellow cab", "taxi"],
    deductible: "Review", confidence: 0.55,
    reason: "Rideshare — deductible if for business purpose",
  },
  {
    category: "Bank / CC Fees",
    keywords: [
      "annual membership fee", "annual fee", "foreign transaction fee",
      "late fee", "interest charge", "finance charge", "service fee", "wire fee",
    ],
    deductible: "Review", confidence: 0.6,
    reason: "Fees — deductible on business / rental accounts only",
  },
  {
    category: "Professional Services",
    keywords: [
      "legalzoom", "rocket lawyer", "law office", "attorney", "cpa ", "accountant",
      "tax preparation", "h&r block", "turbotax", "bookkeep",
    ],
    deductible: "Yes", confidence: 0.85,
    reason: "Legal / accounting / professional fees",
  },
  {
    category: "Health Insurance (S-corp)",
    keywords: ["blue shield", "blue cross", "kaiser", "aetna", "cigna", "anthem", "united healthcare", "uhc "],
    deductible: "Review", confidence: 0.6,
    reason: "Health insurance — S-corp >2% shareholder may deduct via W-2 wage adjustment (ask CPA)",
  },

  // ============ AMAZON PRODUCT-LEVEL KEYWORDS ============
  // Only apply when description starts with "amazon ". The Amazon CSV parser
  // formats descriptions as "Amazon: <product title>", so we can read product
  // intent rather than just seeing "AMZN MKTP US".
  {
    category: "Office Supplies (Amazon)",
    keywords: [
      "amazon printer", "amazon paper", "amazon toner", "amazon ink cartridge",
      "amazon stapler", "amazon folder", "amazon envelope", "amazon label",
      "amazon notebook", "amazon pen ", "amazon pens", "amazon binder",
      "amazon desk ", "amazon chair", "amazon monitor", "amazon keyboard",
      "amazon mouse", "amazon webcam", "amazon usb", "amazon hdmi",
      "amazon laptop stand", "amazon shredder",
    ],
    deductible: "Yes", confidence: 0.8,
    reason: "Office equipment / supplies",
  },
  {
    category: "Marketing (Amazon)",
    keywords: [
      "amazon business card", "amazon yard sign", "amazon for sale sign",
      "amazon open house sign", "amazon brochure", "amazon flyer",
      "amazon postcard", "amazon name badge", "amazon lockbox",
    ],
    deductible: "Yes", confidence: 0.85,
    reason: "Marketing / signage / agent supplies",
  },
  {
    category: "Hardware / Rental Repair (Amazon)",
    keywords: [
      "amazon paint", "amazon caulk", "amazon drywall", "amazon screw",
      "amazon nail", "amazon drill", "amazon hammer", "amazon wrench",
      "amazon tool", "amazon ladder", "amazon faucet", "amazon toilet",
      "amazon door knob", "amazon doorknob", "amazon hinge", "amazon light bulb",
      "amazon smoke detector", "amazon thermostat", "amazon water heater",
      "amazon air filter", "amazon hvac",
    ],
    deductible: "Review", confidence: 0.7,
    reason: "Repair/improvement — deductible if for rental unit, listing prep, or home office",
  },
  {
    category: "Client Gifts (Amazon)",
    keywords: [
      "amazon gift card", "amazon gift basket", "amazon wine glass",
      "amazon cheese board", "amazon candle gift",
    ],
    deductible: "Review", confidence: 0.7,
    reason: "Possible client gift — deductible up to $25/recipient/year",
  },

  // ============ NO ============

  {
    category: "Payment / Transfer",
    keywords: [
      "payment thank you", "autopay payment", "online payment", "mobile payment",
      "payment - thank you", "internet payment", "ach payment", "electronic payment",
      "automatic payment", "epayment",
    ],
    deductible: "No", confidence: 0.99,
    reason: "Card payment / transfer (not an expense)",
  },
];

const NON_DEDUCTIBLE_HINTS = [
  { kw: "netflix", reason: "Personal entertainment" },
  { kw: "spotify", reason: "Personal entertainment" },
  { kw: "hulu", reason: "Personal entertainment" },
  { kw: "disney plus", reason: "Personal entertainment" },
  { kw: "disneyplus", reason: "Personal entertainment" },
  { kw: "hbo max", reason: "Personal entertainment" },
  { kw: "max com", reason: "Personal entertainment" },
  { kw: "paramount", reason: "Personal entertainment" },
  { kw: "peacock", reason: "Personal entertainment" },
  { kw: "apple tv", reason: "Personal entertainment" },
  { kw: "playstation", reason: "Personal entertainment" },
  { kw: "xbox", reason: "Personal entertainment" },
  { kw: "nintendo", reason: "Personal entertainment" },
  { kw: "steam games", reason: "Personal entertainment" },
  { kw: "safeway", reason: "Groceries (personal)" },
  { kw: "trader joe", reason: "Groceries (personal)" },
  { kw: "whole foods", reason: "Groceries (personal)" },
  { kw: "kroger", reason: "Groceries (personal)" },
  { kw: "ralphs", reason: "Groceries (personal)" },
  { kw: "sprouts farmers", reason: "Groceries (personal)" },
  { kw: "aldi", reason: "Groceries (personal)" },
  { kw: "instacart", reason: "Grocery delivery (personal)" },
  { kw: "cvs pharmacy", reason: "Personal health/retail" },
  { kw: "walgreens", reason: "Personal health/retail" },
  { kw: "rite aid", reason: "Personal health/retail" },
];

function classify(tx) {
  const desc = normalize(tx.description);

  // Refunds / payments inbound
  if (tx.amount < 0) {
    if (/\b(payment|thank you|autopay|ach)\b/.test(desc)) {
      return { category: "Payment / Transfer", deductible: "No", confidence: 0.99, reason: "Card payment" };
    }
    return { category: "Refund / Credit", deductible: "No", confidence: 0.9, reason: "Refund or incoming credit" };
  }

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const k = normalize(kw);
      if (k && desc.includes(k)) {
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
    if (desc.includes(normalize(h.kw))) {
      return { category: "Personal", deductible: "No", confidence: 0.85, reason: h.reason };
    }
  }

  return {
    category: "Uncategorized",
    deductible: "Review",
    confidence: 0.2,
    reason: "No rule matched — manual review",
  };
}

module.exports = { classify, normalize };
