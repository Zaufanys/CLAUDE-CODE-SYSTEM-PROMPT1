// Human-in-the-loop review workflow.
//
// Turns an analyzer result plus a reviewer decision into an auditable
// "approval package" — the artifact that would be persisted to a CRM / intake
// system and used as the record of who decided what, when, and why.
// Pure functions only; the clock is injectable so the logic is fully testable.

export const reviewActions = {
  APPROVE: "Approved",
  NEEDS_INFO: "Needs Info",
  REJECT: "Rejected"
};

// Whether an RFQ is safe to auto-approve: no missing required fields and no
// high-severity risks. Used to warn a reviewer who approves anyway.
export function canApprove(analysis) {
  if (!analysis) return false;
  const hasMissing = (analysis.missing || []).length > 0;
  const hasHighRisk = (analysis.risks || []).some(
    (risk) => risk.severity === "high"
  );
  return !hasMissing && !hasHighRisk;
}

// Build the auditable review package. `now` may be supplied (ISO string) for
// deterministic tests; otherwise the current time is stamped.
export function buildReviewPackage(analysis, decision = {}, now) {
  const actionCode = reviewActions[decision.action] ? decision.action : "APPROVE";
  const decisionLabel = reviewActions[actionCode];
  const decidedAt = now || new Date().toISOString();
  const reviewer = (decision.reviewer || "").trim() || "Unassigned Reviewer";
  const comment = (decision.comment || "").trim();

  const missingFields = analysis?.missing || [];
  const openRisks = (analysis?.risks || []).map((risk) => risk.label);
  const dataQualityIssues = (analysis?.dataQuality || [])
    .filter((check) => !check.ok)
    .map((check) => check.label);

  const approvedWithOpenIssues =
    actionCode === "APPROVE" && !canApprove(analysis);

  return {
    rfqId: analysis?.fields?.rfqId || "",
    customer: analysis?.fields?.customer || "",
    decision: decisionLabel,
    decisionCode: actionCode,
    reviewer,
    comment,
    decidedAt,
    completeness: analysis?.completeness ?? 0,
    reviewStatus: analysis?.reviewStatus || "",
    missingFields,
    openRisks,
    dataQualityIssues,
    approvedWithOpenIssues,
    advisory: approvedWithOpenIssues
      ? "Approved despite open required fields or high-severity risks. Confirm this is an intentional override."
      : "",
    analysis
  };
}

// Compact record shaped like a CRM / Dataverse intake payload — the structured
// output an integration would push downstream after approval.
export function toCrmPayload(analysis, reviewPackage) {
  return {
    source: "ai-rfq-sales-document-analyzer",
    recordType: "RFQ_Intake",
    rfqId: analysis?.fields?.rfqId || "",
    customer: analysis?.fields?.customer || "",
    product: analysis?.fields?.product || "",
    region: analysis?.fields?.region || "",
    dueDate: analysis?.fields?.dueDate || "",
    annualVolume: analysis?.numeric?.annualVolume ?? null,
    priceTarget: analysis?.numeric?.priceTarget ?? null,
    completeness: analysis?.completeness ?? 0,
    reviewDecision: reviewPackage?.decision || "Pending",
    reviewer: reviewPackage?.reviewer || "",
    decidedAt: reviewPackage?.decidedAt || "",
    openRiskCount: (analysis?.risks || []).length,
    missingFieldCount: (analysis?.missing || []).length
  };
}
