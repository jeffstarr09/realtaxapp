# RealTax

Desktop app (Electron) that ingests bank/credit card statements (PDF or CSV) from
Chase, Bank of America, American Express, Wells Fargo, Citi, and Discover, unifies
them into a single Excel workbook, and flags likely tax-deductible transactions for
a real estate agent operating through an S-corp.

Runs entirely on your machine — statements never leave your computer, and there is
no request timeout.

## Run from source

```
npm install
npm start
```

## Build installers

```
npm run dist          # current platform
npm run dist:mac      # .dmg
npm run dist:win      # .exe (NSIS)
```

Output goes to `dist/`.

## How flagging works

Rule-based — see `lib/classify.js`. Categories tuned for a real estate agent:

- **Yes** — high-confidence business expenses (MLS, dues, E&O, marketing, real-estate SaaS, CE)
- **Review** — likely-but-mixed (fuel, meals, phone, travel, office supplies). Surfaced for
  you and your tax preparer to confirm because the cards are mixed personal/business.
- **No** — payments/transfers, refunds, clearly personal categories.

The Excel workbook contains four sheets: `All Transactions`, `Likely Deductible`,
`Needs Review`, and `Summary` (totals by category).

## Notes / limitations

- PDF parsing uses `pdf-parse` with regex heuristics. Text-based statements work; scanned/image
  PDFs would need OCR (not included).
- Always have a CPA review before filing.
