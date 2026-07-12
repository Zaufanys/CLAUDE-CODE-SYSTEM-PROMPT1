# Architecture

## Current design (this prototype)

The prototype is a **zero-dependency static web app** with a deterministic,
rule-based analysis core. It is intentionally simple so the demo is reproducible
without API keys or a backend, while keeping a **stable input/output contract**
that a production LLM pipeline could implement without changing the UI.

### Flow

1. **Intake.** The user pastes an RFQ / sales document or loads a fictional
   sample (`public/samples/*`).
2. **Extraction.** `analyzeRfq()` (`public/js/rfqAnalyzer.js`) extracts structured
   fields via labelled-line and regex rules and parses numeric values
   (annual volume, price target).
3. **Evidence.** For each extracted value the analyzer captures a short source
   snippet so a reviewer can trace it back to the original text (RAG-style
   grounding, done locally here).
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
8. **Downstream output.** `toCrmPayload()` produces a compact record for
   CRM / ERP / Power BI / intake systems; the UI can export JSON and CSV.

### Design choices

- **Single source of truth.** All analysis and review logic lives in
  `public/js/*` as pure ES modules with no DOM or Node-only APIs, so the **exact
  same code runs in the browser and in the `node --test` suite**. This keeps the
  UI a thin layer and makes the logic fully unit-testable.
- **Self-contained site.** Because the shared modules live under `public/`, the
  app deploys as a pure static site (GitHub Pages / any static host). `lint.mjs`
  actively guards against re-introducing an out-of-root import.
- **Deterministic core.** Rule-based extraction means the demo is reproducible
  and explainable — useful for governance conversations.

## Production extension

The same contract scales to an enterprise pipeline:

```
Sources (SharePoint / OneLake / Blob)
   │  ingestion + parsing (PDF/DOCX/email)
   ▼
Chunking + embeddings ──► Vector store (hybrid + keyword retrieval, reranking)
   │
   ▼
LLM extraction (Azure AI Foundry / OpenAI / local)
   │  schema-validated structured output + grounded evidence
   ▼
Risk + data-quality + completeness scoring
   │
   ▼
Human approval workflow (email / Teams / Power Automate)
   │  reviewer + decision + comment + timestamp
   ▼
CRM / ERP / Dataverse / Power BI   +   audit store + tracing/evaluation
```

### Production building blocks

- **Retrieval:** hybrid search (vector + keyword), reranking, source-grounded
  evidence rather than local string matching.
- **Extraction:** LLM with enforced JSON schema validation; the current
  `analyzeRfq` output shape is the target schema. Optional AI mode stays
  **disabled unless an API key / environment variable is provided**.
- **Orchestration:** Azure AI Foundry / Microsoft Fabric / Databricks or a
  LangGraph-style agent for multi-step extraction, validation, and routing.
- **Governance & audit controls:** immutable audit trail (who/what/when/why),
  role-based access control, secure document storage, PII handling, and
  prompt-injection / document-injection testing.
- **Human approval:** routing and escalation with SLA tracking; overrides
  recorded explicitly (as the prototype already models).
- **Observability:** tracing, evaluation datasets with expected fields, and
  extraction-accuracy dashboards.

### Output contract (stable across local and production)

`analyzeRfq()` returns: `documentType`, `extractedAt`, `fields`, `numeric`,
`requirements`, `missing`, `risks`, `evidence`, `dataQuality`, `completeness`,
`reviewStatus`, and `recommendedNextActions`. Keeping this contract stable is
what lets the deterministic core be replaced by an LLM pipeline without touching
the UI or the review workflow.
