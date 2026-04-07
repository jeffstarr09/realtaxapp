# RealTax

Simple Next.js web app (deployable to Vercel) that ingests bank/credit card statements
(PDF or CSV) from Chase, Bank of America, American Express, Wells Fargo, Citi, and
Discover, unifies them into a single Excel workbook, and flags likely tax-deductible
transactions for a real estate agent operating through an S-corp.

## Run locally

```
npm install
npm run dev
```

Open http://localhost:3000, upload statements, and download the unified Excel file.

## Deploy

Connect this repo to your Vercel project (`realtax`). Push to the branch and Vercel
will build it. The `/api/unify` endpoint runs server-side with `nodejs` runtime and
60s timeout (see `vercel.json`).

## How flagging works

Rule-based — see `lib/classify.js`. Categories tuned for a real estate agent:

- **Yes** — high-confidence business expenses (MLS, dues, E&O, marketing, real-estate SaaS, CE)
- **Review** — likely-but-mixed (fuel, meals, phone, travel, office supplies). Surfaced for
  you and your tax preparer to confirm because the cards are mixed personal/business.
- **No** — payments/transfers, refunds, clearly personal categories.

The Excel workbook contains four sheets: `All Transactions`, `Likely Deductible`,
`Needs Review`, and `Summary` (totals by category).

## Notes / limitations

- PDF parsing uses `pdf-parse` with regex heuristics. Text-based statements work; scanned/image PDFs
  would need OCR (not included).
- CSV parsing normalizes the most common header schemas. Add unusual headers to `HEADER_MAP` in
  `lib/parsers/csv.js`.
- Always have a CPA review before filing.
