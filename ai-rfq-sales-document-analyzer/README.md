# AI RFQ / Sales Document Analyzer

Production-style portfolio prototype for **OE sales digitalization** and **GenAI
document automation**. It ingests an RFQ or sales document and turns unstructured
text into a structured, traceable, review-ready package: extracted fields,
missing-information detection, business-risk flags, source evidence, data-quality
gates, and a human-in-the-loop approval workflow with an exportable audit trail.

The extraction runs **locally and deterministically** — no API keys, no network,
no paid dependencies — so the demo is reproducible in under two minutes. The same
input/output contract is designed to be swapped for an LLM extraction step in
production (see [ARCHITECTURE.md](ARCHITECTURE.md)).

> ⚠️ **All sample data is fictional.** Customer names, programs, volumes, and
> prices are invented for demonstration. This is an independent portfolio project
> and contains no confidential or proprietary data from any company.

---

## Why this project / role relevance

This prototype is built to demonstrate readiness for an **OE Sales,
Digitalization & AI Specialist**–type role. It deliberately focuses on the
concerns such a role cares about rather than a generic chatbot:

- **Sales-document automation** — reduce manual RFQ triage time.
- **Structured extraction** — turn free text into CRM/ERP-ready fields.
- **Traceability (RAG-style evidence)** — every extracted value links back to its
  source text, so a reviewer can trust it.
- **Data quality & governance** — explicit checks and a **human-in-the-loop**
  approval step, not blind automation.
- **Auditability** — reviewer, decision, comment, and timestamp captured for the
  record.

---

## Demo walkthrough (under 2 minutes)

1. **RFQ Intake** — a sample document loads automatically. Use the dropdown to
   switch between a complete RFQ, one missing key fields, and a
   cybersecurity/software-requirement RFQ. You can also paste your own text.
2. **Structured Extraction** — customer, RFQ ID, due date, product, region,
   volume, price target, program, and SOP are extracted into a table.
3. **Risk Summary & Missing Info** — missing required fields and business risks
   (warranty gaps, unassigned engineering owner, supplier constraints,
   cybersecurity/software impact, portal deadlines) are flagged with severity.
4. **Data Quality** — pass/fail gates for customer presence, a valid calendar due
   date, price target, annual volume, and high-severity risk language.
5. **Evidence Snippets** — the source text around each extracted value.
6. **Human Review Package** — enter a reviewer name and comment, then
   **Approve / Needs Info / Reject**. Approving an RFQ that still has missing
   fields or high-severity risk is flagged as an intentional override.
7. **JSON / CRM Payload** — copy or download the structured JSON, copy a compact
   CRM/Dataverse-style payload, or download a CSV summary. The reviewer decision
   and timestamp are embedded as an audit trail.

## Screenshots

_Add screenshots or a short GIF of the running app here._

| View | Placeholder |
| --- | --- |
| Full dashboard | `docs/screenshot-dashboard.png` |
| Human review package | `docs/screenshot-review.png` |

> Tip: run the app (below), screenshot the dashboard, and drop the images into a
> `docs/` folder to replace these placeholders.

---

## Run locally

```bash
npm start
```

Then open `http://localhost:4173`. No `npm install` is required — the project has
**zero runtime dependencies**.

## Test & lint

```bash
npm test    # node --test — extraction + review-workflow unit tests
npm run lint # structural checks + guards the site stays self-contained
```

## Deploy (GitHub Pages)

The app is a **self-contained static site** — everything the browser needs lives
under `public/`. The included [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
publishes `public/` to GitHub Pages. In the repository settings, set
**Pages → Source: GitHub Actions**, and the workflow deploys on every push to
`main`. (You can also host `public/` on any static host such as Netlify or
Vercel.)

---

## Architecture overview

```
Document text
   │
   ▼
analyzeRfq()  ──►  fields · numeric · requirements · missing
   │                risks · evidence · dataQuality · completeness
   ▼
buildReviewPackage()  ──►  reviewer decision + comment + timestamp (audit trail)
   │
   ▼
toCrmPayload()  ──►  compact record for CRM / ERP / Power BI intake
```

- `public/js/schema.js` — required fields, labels, risk rules, data-quality
  rules, and a strict ISO-date validator.
- `public/js/rfqAnalyzer.js` — deterministic extraction, evidence, and scoring.
- `public/js/review.js` — human-in-the-loop decision package and CRM payload.
- `public/app.js` — thin UI layer; all logic is in the shared modules above, so
  the **exact same code runs in the browser and in the Node test suite**.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current design and a production
target (Azure AI Foundry / Microsoft Fabric / RAG, governance, and approvals).

## Project structure

```
ai-rfq-sales-document-analyzer/
├── public/
│   ├── index.html          # UI
│   ├── styles.css
│   ├── app.js              # UI wiring (imports the shared modules below)
│   ├── js/
│   │   ├── schema.js       # fields, risk rules, data-quality rules
│   │   ├── rfqAnalyzer.js  # extraction + scoring + evidence
│   │   └── review.js       # human review workflow + CRM payload
│   └── samples/            # fictional sample RFQs + manifest
├── scripts/
│   ├── serve.mjs           # zero-dependency static server
│   └── lint.mjs            # structural + self-contained-site checks
├── test/                   # node --test unit tests
└── .github/workflows/      # CI (test + lint) and Pages deployment
```

---

## What this demonstrates in an interview

- Framing an AI feature around a **real sales workflow**, not a demo chatbot.
- **Structured output** with a stable schema suitable for downstream systems.
- **Source traceability / RAG thinking** for reviewer trust.
- **Data quality and governance** as first-class concerns.
- **Human-in-the-loop** approval with an audit trail.
- Clean, testable, dependency-light engineering (unit tests, CI, lint).

## Future production roadmap

- Real LLM extraction (Azure AI Foundry / OpenAI / local model), **disabled by
  default** unless an API key is provided.
- PDF/DOCX ingestion via a backend parser; drag-and-drop upload.
- True hybrid / vector retrieval with reranking for evidence grounding.
- Evaluation dataset with expected fields and extraction accuracy metrics.
- Authentication and role-based access control.
- Database-backed audit trail and secure document storage.
- Approval routing via email / Teams / Power Automate.
- Prompt-injection and document-injection testing; monitoring and tracing.

## License

[MIT](LICENSE) © Micheal Wolski
