# Architecture

## Overview

The app is a **local-first, zero-dependency static web app** with a small Node
static server for local use and a self-contained `public/` folder for static
hosting. All analysis and persistence logic lives in shared ES modules under
`public/js/`, so the exact same code runs in the browser and in the `node --test`
suite. There is no backend and no external service — documents and review
decisions never leave the browser.

### Flow

1. **Intake.** The user pastes text, drops/uploads a `.txt` file, or loads an
   included example (`public/samples/*`).
2. **Extraction.** `analyzeRfq()` (`public/js/rfqAnalyzer.js`) extracts structured
   fields via labelled-line and regex rules and parses numeric values
   (annual volume, price target).
3. **Evidence.** For each extracted value the analyzer captures a short source
   snippet so a reviewer can trace it back to the original text.
4. **Risk & missing-info detection.** Required-field gaps and business-risk
   phrases (warranty, engineering owner, supplier constraints,
   cybersecurity/software documentation, portal deadlines) are flagged with
   severity from `schema.js`.
5. **Data quality.** Declarative gates (`dataQualityRules`) check customer
   presence, a **valid calendar due date**, price target, annual volume, and
   high-severity risk language — including values that are *present but invalid*
   (e.g. a due date of `2026-13-05`).
6. **Review routing.** A completeness score and a `reviewStatus`
   (`Needs Human Review` vs `Ready for Reviewer Approval`) are computed.
7. **Human review.** `buildReviewPackage()` (`public/js/review.js`) records the
   reviewer, decision (Approve / Needs Info / Reject), comment, and timestamp.
   Approving with open required fields or high-severity risks is flagged as an
   explicit override.
8. **Persistence.** `store.js` saves processed documents and decisions to a
   reviewer queue in `localStorage`, so work survives reloads. Records can be
   reopened, re-reviewed, deleted, or exported.
9. **Output.** `toCrmPayload()` produces a compact record for CRM / ERP / intake
   systems; the UI exports per-document JSON/CSV and whole-queue JSON.

### Modules

| Module | Responsibility |
| --- | --- |
| `public/js/schema.js` | Field list, labels, risk rules, data-quality rules, ISO-date validator |
| `public/js/rfqAnalyzer.js` | Deterministic extraction, evidence, scoring |
| `public/js/review.js` | Review decision package + CRM payload |
| `public/js/store.js` | Persistent reviewer queue (localStorage + in-memory fallback) |
| `public/app.js` | UI wiring: intake, rendering, exports, queue |
| `scripts/serve.mjs` | Zero-dependency static file server |
| `scripts/lint.mjs` | Structural checks; guards the site stays self-contained |

### Design choices

- **Single source of truth.** Analysis and persistence logic are pure ES modules
  with no DOM-only or Node-only assumptions (the store takes an injectable
  storage backend), so the same code is exercised by the browser and the tests.
- **Self-contained site.** Because the shared modules live under `public/`, the
  app deploys as a pure static site. `lint.mjs` actively guards against
  re-introducing an out-of-root import.
- **Deterministic core.** Rule-based extraction means results are explainable and
  repeatable, with no API keys or network calls.
- **Local-first data.** Nothing is uploaded; the reviewer queue is per-browser.
  Exporting to JSON is the backup/handoff mechanism.

## Extending to a server deployment

The same output contract scales to a multi-user, server-backed system:

```
Sources (upload / SharePoint / Blob)
   │  ingestion + parsing (PDF/DOCX/email)
   ▼
Extraction (rule-based today; optionally LLM with enforced JSON schema)
   │  structured output + grounded evidence
   ▼
Risk + data-quality + completeness scoring
   │
   ▼
Human review workflow (Approve / Needs Info / Reject)
   │  reviewer + decision + comment + timestamp
   ▼
Server-backed queue (database) + exports to CRM / ERP / BI
```

Building blocks for that path:

- **Document parsing:** a backend service to accept PDF/DOCX and normalise to
  text before extraction.
- **Optional LLM extraction:** swap the deterministic extractor for an LLM call
  that returns the same schema; keep it **disabled unless an API key is
  configured** so the default build stays dependency-free.
- **Shared queue:** replace the `localStorage` store with a database-backed API
  (`store.js`'s interface — read/upsert/delete/clear — maps directly onto REST
  endpoints), enabling multi-user review.
- **Access control & audit:** authentication, role-based access, and an immutable
  audit trail (who/what/when/why) for the review decisions the app already
  records.
- **Retrieval grounding:** for large document sets, hybrid/vector retrieval with
  reranking to source the evidence snippets.

### Output contract

`analyzeRfq()` returns: `documentType`, `extractedAt`, `fields`, `numeric`,
`requirements`, `missing`, `risks`, `evidence`, `dataQuality`, `completeness`,
`reviewStatus`, and `recommendedNextActions`. Keeping this contract stable is
what lets the deterministic core be replaced by a server or LLM pipeline without
touching the UI, the review workflow, or the persistence layer.
