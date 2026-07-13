// Extraction schema, business rules, and data-quality rules for the RFQ analyzer.
// Pure data + tiny helpers only, so this module runs identically in the browser
// and in Node (tests). No DOM, no Node built-ins.

// Fields that must be present for an RFQ to be considered review-ready.
export const requiredFields = [
  "customer",
  "rfqId",
  "dueDate",
  "product",
  "annualVolume",
  "priceTarget",
  "region"
];

// Human-readable labels for every extractable field.
export const fieldLabels = {
  customer: "Customer",
  rfqId: "RFQ ID",
  dueDate: "Due Date",
  product: "Product",
  annualVolume: "Estimated Annual Volume",
  priceTarget: "Requested Price Target",
  sop: "Target SOP",
  region: "Region",
  program: "Program"
};

// Business-risk phrases the analyzer flags for a reviewer. Each rule maps a
// regex signal in the document to a labelled, severity-scored risk.
export const riskRules = [
  {
    id: "missing-warranty",
    pattern: /missing\s+final\s+warranty|warranty\s+terms\s+missing/i,
    severity: "medium",
    label: "Warranty terms missing"
  },
  {
    id: "no-owner",
    pattern: /engineering\s+contact\s+not\s+yet\s+assigned|owner\s+not\s+assigned/i,
    severity: "medium",
    label: "Engineering owner missing"
  },
  {
    id: "supplier-risk",
    pattern: /supplier\s+constraints|supply\s+risk|shortage/i,
    severity: "high",
    label: "Supplier constraint risk"
  },
  {
    id: "portal-deadline",
    pattern: /portal\s+by\s+due\s+date|submit\s+response/i,
    severity: "low",
    label: "Portal submission deadline"
  },
  {
    id: "security-impact",
    pattern: /cybersecurity|software\s+update|security\s+documentation/i,
    severity: "medium",
    label: "Cybersecurity/software documentation impact"
  }
];

// Strict ISO calendar-date validator (YYYY-MM-DD). Rejects malformed strings
// and impossible dates such as 2026-13-40 or 2026-02-30.
export function isValidIsoDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Data-quality gate rules. Each rule inspects the extracted context
// ({ fields, numeric, risks }) and passes or fails with an explanation.
// These power the "Data Quality" panel and the review-readiness decision.
export const dataQualityRules = [
  {
    id: "customer-present",
    label: "Customer identified",
    severity: "high",
    check: (ctx) => Boolean(ctx.fields.customer),
    fail: "No customer / OEM name was found in the document."
  },
  {
    id: "due-date-valid",
    label: "Due date is a valid calendar date",
    severity: "high",
    check: (ctx) => isValidIsoDate(ctx.fields.dueDate),
    fail: "Due date is missing or not a valid date (expected format e.g. 2026-07-29)."
  },
  {
    id: "price-target-present",
    label: "Requested price target provided",
    severity: "medium",
    check: (ctx) => ctx.numeric.priceTarget != null,
    fail: "No requested price target could be detected."
  },
  {
    id: "volume-present",
    label: "Estimated annual volume provided",
    severity: "medium",
    check: (ctx) => ctx.numeric.annualVolume != null,
    fail: "No estimated annual volume could be detected."
  },
  {
    id: "no-high-risk",
    label: "No high-severity risk phrases",
    severity: "high",
    check: (ctx) => !ctx.risks.some((risk) => risk.severity === "high"),
    fail: "Document contains high-severity risk language (e.g. supplier constraints / shortage)."
  }
];
