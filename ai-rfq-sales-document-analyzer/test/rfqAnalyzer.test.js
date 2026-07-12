import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRfq } from "../public/js/rfqAnalyzer.js";
import { isValidIsoDate } from "../public/js/schema.js";

const completeSample = `Customer: Great Lakes Mobility
RFQ ID: RFQ-2026-PS-114
Due Date: 2026-07-29
Region: North America
Product: Power electronics cooling module
Estimated Annual Volume: 185000 units
Requested Price Target: 42.75 USD per unit
Requirements:
- Provide risk summary for supplier constraints
Notes: Missing final warranty terms. Engineering contact not yet assigned.`;

test("extracts key RFQ fields", () => {
  const result = analyzeRfq(completeSample);
  assert.equal(result.fields.customer, "Great Lakes Mobility");
  assert.equal(result.fields.rfqId, "RFQ-2026-PS-114");
  assert.equal(result.numeric.annualVolume, 185000);
  assert.equal(result.numeric.priceTarget, 42.75);
});

test("flags risks and routes to human review", () => {
  const result = analyzeRfq(completeSample);
  assert.ok(result.risks.some((risk) => risk.id === "missing-warranty"));
  assert.ok(result.risks.some((risk) => risk.id === "supplier-risk"));
  assert.equal(result.reviewStatus, "Needs Human Review");
});

test("attaches evidence snippets to extracted values", () => {
  const result = analyzeRfq(completeSample);
  assert.match(result.evidence.customer, /Great Lakes Mobility/);
});

test("detects missing required fields and lowers completeness", () => {
  const result = analyzeRfq(`RFQ ID: RFQ-1
Region: Europe
Product: Bracket`);
  assert.ok(result.missing.includes("customer"));
  assert.ok(result.missing.includes("annualVolume"));
  assert.ok(result.missing.includes("priceTarget"));
  assert.ok(result.completeness < 100);
});

test("data-quality checks fail for missing customer, price and volume", () => {
  const result = analyzeRfq(`RFQ ID: RFQ-2
Due Date: 2026-05-01
Region: Europe
Product: Bracket`);
  const failed = result.dataQuality.filter((check) => !check.ok).map((c) => c.id);
  assert.ok(failed.includes("customer-present"));
  assert.ok(failed.includes("price-target-present"));
  assert.ok(failed.includes("volume-present"));
});

test("data-quality flags an invalid due date even when present", () => {
  const result = analyzeRfq(`Customer: ACME
RFQ ID: RFQ-3
Due Date: 2026-13-05
Region: Europe
Product: Bracket
Estimated Annual Volume: 1000 units
Requested Price Target: 10 USD per unit`);
  const dueCheck = result.dataQuality.find((c) => c.id === "due-date-valid");
  assert.equal(dueCheck.ok, false);
  // The field is present (so not "missing") but fails validation.
  assert.equal(result.missing.includes("dueDate"), false);
});

test("clean, complete, risk-free RFQ is ready for approval", () => {
  const result = analyzeRfq(`Customer: ACME Mobility
RFQ ID: RFQ-4
Due Date: 2026-05-01
Region: Europe
Product: Bracket
Estimated Annual Volume: 50000 units
Requested Price Target: 12.50 EUR per unit`);
  assert.equal(result.missing.length, 0);
  assert.equal(result.risks.length, 0);
  assert.equal(result.reviewStatus, "Ready for Reviewer Approval");
  assert.equal(result.completeness, 100);
});

test("isValidIsoDate accepts real dates and rejects impossible ones", () => {
  assert.equal(isValidIsoDate("2026-07-29"), true);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("29-07-2026"), false);
  assert.equal(isValidIsoDate(""), false);
});

test("handles empty input without throwing", () => {
  const result = analyzeRfq("");
  assert.equal(result.completeness, 0);
  assert.equal(result.missing.length, 7);
});
