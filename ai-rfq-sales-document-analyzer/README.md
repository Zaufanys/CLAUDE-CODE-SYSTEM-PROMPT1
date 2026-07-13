# AI RFQ / Sales Document Analyzer

A local-first web app for turning RFQs and sales documents into structured,
traceable, review-ready records. Paste text or drop in a `.txt` file and the app
extracts the key fields, flags missing information and business risks, ties each
value back to its source, runs data-quality checks, and lets a reviewer approve,
request info, or reject — keeping an **auditable queue** of everything you
process. Everything runs in your browser: **no account, no server, no API keys,
no setup.**

## Features

- **Document intake** — paste text, drag-and-drop a `.txt` file, upload one, or
  load an included example.
- **Structured extraction** — customer, RFQ ID, due date, product, region,
  program, SOP, annual volume, and price target.
- **Missing-info & risk detection** — required-field gaps and business risks
  (warranty gaps, unassigned engineering owner, supplier constraints,
  cybersecurity/software impact, portal deadlines) with severity.
- **Data-quality checks** — customer presence, a valid calendar due date (catches
  present-but-invalid dates), price target, annual volume, and high-severity risk
  language.
- **Source evidence** — the snippet of original text each extracted value came
  from, so a reviewer can verify it.
- **Human review workflow** — Approve / Needs Info / Reject with reviewer,
  comment, and timestamp. Approving over open fields or high-severity risk is
  flagged as an explicit override.
- **Persistent reviewer queue** — save processed documents (with their decisions)
  to a queue that survives page reloads; reopen, re-review, delete, or export the
  whole queue as JSON.
- **Exports** — per-document JSON and CSV, plus a compact CRM/Dataverse-style
  payload.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer (only to run the local static
  server — the app itself has **zero runtime dependencies**).
- A modern browser.

## Run

```bash
npm start
```

Open `http://localhost:4173`. No `npm install` needed.

## Test & lint

```bash
npm test     # node --test — 23 unit tests (extraction, review, persistence)
npm run lint # structural checks + guards that the browser code stays self-contained
```

## Usage

1. **Intake** — paste an RFQ, drop/upload a `.txt` file, or pick an example, then
   click **Analyze Document**.
2. **Review** — read the extracted fields, risks, data-quality results, and
   evidence. The summary shows completeness, open-risk count, and whether the
   document needs human review.
3. **Decide** — enter your name and an optional comment, then **Approve**,
   **Needs Info**, or **Reject**.
4. **Save** — click **Save to Queue** to persist the document and decision. It
   appears in the **Reviewer Queue** and stays there after you reload.
5. **Export** — download JSON/CSV for one document, copy the CRM payload, or
   export the whole queue as JSON.

## How it works

The app is a static site plus a tiny zero-dependency Node server. All analysis
and persistence logic lives in shared ES modules under `public/js/`, so the exact
same code runs in the browser and in the Node test suite.

- `public/js/schema.js` — required fields, labels, risk rules, data-quality
  rules, and a strict ISO-date validator.
- `public/js/rfqAnalyzer.js` — deterministic extraction, evidence, and scoring.
- `public/js/review.js` — the review decision package and CRM payload.
- `public/js/store.js` — the persistent reviewer queue (localStorage, with an
  in-memory fallback used by tests).
- `public/app.js` — the UI layer.

Extraction is deterministic and rule-based, which is why the app needs no API
keys and produces explainable, repeatable results. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the design and how it can be extended with
a server backend, real document parsing, or LLM-based extraction.

## Deploy

The app is a self-contained static site — everything the browser needs lives
under `public/`. The included [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
publishes `public/` to GitHub Pages (set **Pages → Source: GitHub Actions** in the
repo settings). It can also be hosted on any static host (Netlify, Vercel, S3,
etc.). The reviewer queue is stored per-browser via localStorage.

## Project structure

```
ai-rfq-sales-document-analyzer/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js              # UI wiring (imports the shared modules below)
│   ├── js/
│   │   ├── schema.js       # fields, risk rules, data-quality rules
│   │   ├── rfqAnalyzer.js  # extraction + scoring + evidence
│   │   ├── review.js       # review workflow + CRM payload
│   │   └── store.js        # persistent reviewer queue
│   └── samples/            # example RFQs + manifest
├── scripts/
│   ├── serve.mjs           # zero-dependency static server
│   └── lint.mjs            # structural + self-contained-site checks
├── test/                   # node --test unit tests
└── .github/workflows/      # CI (test + lint) and Pages deployment
```

## Notes

- The reviewer queue lives in your browser's localStorage; clearing site data or
  using a different browser/device starts a fresh queue. Use **Export Queue** to
  back it up.
- The included example documents are illustrative and use invented company names,
  volumes, and prices.

## Roadmap (optional extensions)

- PDF/DOCX intake via a backend parser.
- Optional LLM-based extraction (disabled unless an API key is provided).
- A shared server backend with a database-backed queue and multi-user review.
- Authentication and role-based access control.

## License

[MIT](LICENSE) © Micheal Wolski
