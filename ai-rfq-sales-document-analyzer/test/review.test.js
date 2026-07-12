import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRfq } from "../public/js/rfqAnalyzer.js";
import {
  buildReviewPackage,
  canApprove,
  toCrmPayload,
  reviewActions
} from "../public/js/review.js";

const cleanRfq = `Customer: ACME Mobility
RFQ ID: RFQ-CLEAN
Due Date: 2026-05-01
Region: Europe
Product: Bracket
Estimated Annual Volume: 50000 units
Requested Price Target: 12.50 EUR per unit`;

const riskyRfq = `Customer: Great Lakes Mobility
RFQ ID: RFQ-RISK
Due Date: 2026-07-29
Region: North America
Product: Cooling module
Estimated Annual Volume: 185000 units
Requested Price Target: 42.75 USD per unit
Notes: Provide risk summary for supplier constraints and shortage.`;

const FIXED_TIME = "2026-07-12T09:00:00.000Z";

test("canApprove is true only when nothing is missing and no high risk", () => {
  assert.equal(canApprove(analyzeRfq(cleanRfq)), true);
  assert.equal(canApprove(analyzeRfq(riskyRfq)), false);
});

test("buildReviewPackage records decision, reviewer, comment and timestamp", () => {
  const analysis = analyzeRfq(cleanRfq);
  const pkg = buildReviewPackage(
    analysis,
    { action: "APPROVE", reviewer: "J. Rivera", comment: "Looks good." },
    FIXED_TIME
  );
  assert.equal(pkg.decision, reviewActions.APPROVE);
  assert.equal(pkg.decisionCode, "APPROVE");
  assert.equal(pkg.reviewer, "J. Rivera");
  assert.equal(pkg.comment, "Looks good.");
  assert.equal(pkg.decidedAt, FIXED_TIME);
  assert.equal(pkg.approvedWithOpenIssues, false);
  assert.equal(pkg.advisory, "");
});

test("approving an RFQ with open high risk is flagged as an override", () => {
  const analysis = analyzeRfq(riskyRfq);
  const pkg = buildReviewPackage(analysis, { action: "APPROVE" }, FIXED_TIME);
  assert.equal(pkg.approvedWithOpenIssues, true);
  assert.match(pkg.advisory, /override/i);
});

test("Needs Info and Reject decisions are recorded verbatim", () => {
  const analysis = analyzeRfq(cleanRfq);
  const needsInfo = buildReviewPackage(
    analysis,
    { action: "NEEDS_INFO", reviewer: "K. Bauer" },
    FIXED_TIME
  );
  assert.equal(needsInfo.decision, reviewActions.NEEDS_INFO);

  const reject = buildReviewPackage(
    analysis,
    { action: "REJECT", comment: "Out of scope." },
    FIXED_TIME
  );
  assert.equal(reject.decision, reviewActions.REJECT);
  assert.equal(reject.comment, "Out of scope.");
});

test("unknown action defaults to APPROVE and blank reviewer is labelled", () => {
  const analysis = analyzeRfq(cleanRfq);
  const pkg = buildReviewPackage(analysis, { action: "BOGUS" }, FIXED_TIME);
  assert.equal(pkg.decisionCode, "APPROVE");
  assert.equal(pkg.reviewer, "Unassigned Reviewer");
});

test("toCrmPayload produces a compact downstream record", () => {
  const analysis = analyzeRfq(cleanRfq);
  const pkg = buildReviewPackage(
    analysis,
    { action: "APPROVE", reviewer: "J. Rivera" },
    FIXED_TIME
  );
  const payload = toCrmPayload(analysis, pkg);
  assert.equal(payload.rfqId, "RFQ-CLEAN");
  assert.equal(payload.customer, "ACME Mobility");
  assert.equal(payload.annualVolume, 50000);
  assert.equal(payload.priceTarget, 12.5);
  assert.equal(payload.reviewDecision, reviewActions.APPROVE);
  assert.equal(payload.reviewer, "J. Rivera");
  assert.equal(payload.decidedAt, FIXED_TIME);
});
