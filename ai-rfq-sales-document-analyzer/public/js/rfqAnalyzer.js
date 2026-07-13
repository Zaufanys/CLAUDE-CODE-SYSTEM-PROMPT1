// Deterministic, dependency-free RFQ / sales-document analyzer.
//
// The extraction is intentionally local and rule-based so the demo runs with
// no API keys and no network. In a production system the same output contract
// (structured fields + evidence + risks + data quality) would be produced by an
// LLM extraction step with schema validation and RAG-grounded evidence.

import {
  requiredFields,
  fieldLabels,
  riskRules,
  dataQualityRules
} from "./schema.js";

// Find "Label: value" (or "Label - value") on its own line, trying each alias.
function findLineValue(text, labels) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i");
    const hit = lines.find((line) => re.test(line));
    if (hit) return hit.match(re)[1].trim();
  }
  return "";
}

// Extract the first capture group of a regex, or "" if it does not match.
function findRegexValue(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

// Return a short source snippet around a value so a reviewer can trace it back
// to the original document (RAG-style evidence).
function evidenceFor(text, value) {
  if (!value) return "";
  const idx = text.toLowerCase().indexOf(String(value).toLowerCase());
  if (idx < 0) return "";
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + String(value).length + 100);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

// Pull the first number out of a free-text value (handles thousands separators).
function parseNumber(value) {
  if (!value) return null;
  const match = String(value).replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function analyzeRfq(text) {
  const doc = String(text || "").trim();

  const fields = {
    customer: findLineValue(doc, ["Customer", "OEM", "Client"]),
    rfqId: findLineValue(doc, ["RFQ ID", "RFQ", "Quote Request"]),
    dueDate: findLineValue(doc, ["Due Date", "Response Due", "Deadline"]),
    sop: findLineValue(doc, ["Target SOP", "SOP", "Start of Production"]),
    region: findLineValue(doc, ["Region", "Market"]),
    product: findLineValue(doc, ["Product", "Part", "Component"]),
    program: findLineValue(doc, ["Program", "Vehicle Program"]),
    annualVolume: findLineValue(doc, [
      "Estimated Annual Volume",
      "Annual Volume",
      "Volume"
    ]),
    priceTarget: findLineValue(doc, [
      "Requested Price Target",
      "Price Target",
      "Target Price"
    ])
  };

  // Regex fallbacks for values that may appear in prose rather than as labels.
  if (!fields.annualVolume) {
    fields.annualVolume = findRegexValue(doc, /([\d,]+)\s*units/i);
  }
  if (!fields.priceTarget) {
    fields.priceTarget = findRegexValue(
      doc,
      /([\d.]+\s*(?:USD|EUR)?\s*per\s*unit)/i
    );
  }

  const missing = requiredFields.filter((field) => !fields[field]);

  const evidence = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, evidenceFor(doc, value)])
  );

  const risks = riskRules
    .filter((rule) => rule.pattern.test(doc))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      evidence: (doc.match(rule.pattern)?.[0] || "").trim()
    }));

  const requirements = (
    doc.match(/Requirements:[\s\S]+?(?:\n\n|Notes:|$)/i)?.[0] || ""
  )
    .split(/\n/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter((line) => line && !/^requirements:?$/i.test(line));

  const numeric = {
    annualVolume: parseNumber(fields.annualVolume),
    priceTarget: parseNumber(fields.priceTarget)
  };

  // Evaluate data-quality gates against the extracted context.
  const context = { fields, numeric, risks };
  const dataQuality = dataQualityRules.map((rule) => {
    const ok = Boolean(rule.check(context));
    return {
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      ok,
      detail: ok ? "" : rule.fail
    };
  });
  const qualityIssues = dataQuality.filter((check) => !check.ok);

  const completeness = Math.round(
    ((requiredFields.length - missing.length) / requiredFields.length) * 100
  );

  const reviewStatus =
    missing.length || risks.length || qualityIssues.length
      ? "Needs Human Review"
      : "Ready for Reviewer Approval";

  return {
    documentType: "RFQ / OE Sales Document",
    extractedAt: new Date().toISOString(),
    fields,
    numeric,
    requirements,
    missing,
    risks,
    evidence,
    dataQuality,
    completeness,
    reviewStatus,
    recommendedNextActions: buildNextActions({ missing, risks, qualityIssues })
  };
}

function buildNextActions({ missing, risks, qualityIssues }) {
  const actions = [];
  actions.push(
    missing.length
      ? `Request missing fields: ${missing
          .map((field) => fieldLabels[field] || field)
          .join(", ")}`
      : "Validate extracted fields with the sales owner."
  );
  if (qualityIssues.length) {
    actions.push(
      `Resolve data-quality issues: ${qualityIssues
        .map((issue) => issue.label)
        .join(", ")}`
    );
  }
  actions.push(
    risks.length
      ? "Route the risk summary to the sales / engineering reviewer."
      : "Proceed to reviewer approval."
  );
  actions.push("Save the structured output to the CRM / intake record after approval.");
  return actions;
}
