// Front-end wiring for the RFQ analyzer. All heavy logic lives in the shared
// ES modules under ./js so the exact same code runs in the browser and in the
// Node test suite.

import { analyzeRfq } from "./js/rfqAnalyzer.js";
import { fieldLabels } from "./js/schema.js";
import {
  buildReviewPackage,
  toCrmPayload,
  canApprove
} from "./js/review.js";

const $ = (id) => document.getElementById(id);

let lastAnalysis = null;
let lastReview = null;

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[ch]
  );

const row = (a, b, c = "", hasThird = false) =>
  `<tr><td><strong>${a}</strong></td><td>${
    b || "<span class='bad'>Missing</span>"
  }</td>${hasThird ? `<td>${c}</td>` : ""}</tr>`;

// ---- Samples -------------------------------------------------------------

async function loadSampleManifest() {
  const select = $("sampleSelect");
  try {
    const res = await fetch("samples/index.json");
    const manifest = await res.json();
    select.innerHTML = manifest.samples
      .map((s) => `<option value="${esc(s.file)}">${esc(s.label)}</option>`)
      .join("");
    return manifest.samples;
  } catch {
    select.innerHTML = `<option value="">(samples unavailable)</option>`;
    return [];
  }
}

async function loadSample(file) {
  if (!file) return;
  const res = await fetch(`samples/${file}`);
  const sample = await res.json();
  $("documentInput").value = sample.document || "";
  runAnalysis();
}

// ---- Analysis + render ---------------------------------------------------

function runAnalysis() {
  const text = $("documentInput").value;
  if (!text.trim()) {
    reset();
    return;
  }
  lastAnalysis = analyzeRfq(text);
  lastReview = null;
  render();
}

function render() {
  const result = lastAnalysis;
  if (!result) return;

  $("completeness").textContent = `${result.completeness}%`;
  $("completeBar").style.width = `${result.completeness}%`;
  $("riskCount").textContent = result.risks.length;
  $("status").textContent = result.reviewStatus;
  $("status").className = result.reviewStatus.includes("Needs") ? "warn" : "good";

  // Extracted fields
  $("fieldTable").innerHTML = Object.entries(result.fields)
    .map(([key, value]) => row(fieldLabels[key] || key, esc(value)))
    .join("");

  // Missing fields + risks
  const missingRows = result.missing.map((field) =>
    row("Missing", `<span class="bad">${fieldLabels[field] || field}</span>`)
  );
  const riskRows = result.risks.map((risk) =>
    row(risk.severity.toUpperCase(), esc(risk.label), esc(risk.evidence), true)
  );
  $("riskTable").innerHTML =
    [...missingRows, ...riskRows].join("") ||
    row("None", "<span class='good'>No major issues detected.</span>");

  // Data quality
  $("qualityTable").innerHTML = result.dataQuality
    .map((check) =>
      row(
        check.ok
          ? "<span class='good'>PASS</span>"
          : "<span class='bad'>FAIL</span>",
        esc(check.label),
        esc(check.detail),
        true
      )
    )
    .join("");

  // Evidence
  $("evidenceTable").innerHTML =
    Object.entries(result.evidence)
      .filter(([, value]) => value)
      .map(([key, value]) => row(fieldLabels[key] || key, esc(value)))
      .join("") || row("Evidence", "No snippets available.");

  // Next actions
  $("nextActions").innerHTML =
    "<strong>Recommended next actions</strong><br>" +
    result.recommendedNextActions.map((a) => `• ${esc(a)}`).join("<br>");

  renderOutput();
}

function reset() {
  lastAnalysis = null;
  lastReview = null;
  $("completeness").textContent = "0%";
  $("completeBar").style.width = "0%";
  $("riskCount").textContent = "0";
  $("status").textContent = "Not run";
  $("status").className = "";
  ["fieldTable", "riskTable", "qualityTable", "evidenceTable"].forEach(
    (id) => ($(id).innerHTML = "")
  );
  $("nextActions").textContent = "Run analysis to generate recommended next actions.";
  $("decisionOut").textContent = "No decision recorded yet.";
  $("jsonOut").textContent = "{}";
}

// ---- Review workflow -----------------------------------------------------

function recordDecision(action) {
  if (!lastAnalysis) {
    $("decisionOut").textContent = "Analyze a document before recording a decision.";
    return;
  }
  const decision = {
    action,
    reviewer: $("reviewerName").value,
    comment: $("reviewComment").value
  };
  lastReview = buildReviewPackage(lastAnalysis, decision);

  const overrideNote = lastReview.approvedWithOpenIssues
    ? `<br><span class="warn">${esc(lastReview.advisory)}</span>`
    : "";
  const stateClass =
    lastReview.decisionCode === "APPROVE"
      ? "good"
      : lastReview.decisionCode === "REJECT"
        ? "bad"
        : "warn";

  $("decisionOut").innerHTML =
    `<strong>Decision:</strong> <span class="${stateClass}">${esc(
      lastReview.decision
    )}</span><br>` +
    `<strong>Reviewer:</strong> ${esc(lastReview.reviewer)}<br>` +
    `<strong>Recorded:</strong> ${esc(lastReview.decidedAt)}` +
    (lastReview.comment ? `<br><strong>Comment:</strong> ${esc(lastReview.comment)}` : "") +
    overrideNote;

  renderOutput();
}

// ---- Output / export -----------------------------------------------------

function currentOutput() {
  if (!lastAnalysis) return {};
  return lastReview ? { ...lastAnalysis, review: stripAnalysis(lastReview) } : lastAnalysis;
}

// Avoid embedding the whole analysis twice inside the exported JSON.
function stripAnalysis(reviewPackage) {
  const { analysis, ...rest } = reviewPackage;
  return rest;
}

function renderOutput() {
  $("jsonOut").textContent = JSON.stringify(currentOutput(), null, 2);
}

async function copyText(text, btnId, doneLabel = "Copied") {
  const btn = $(btnId);
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  btn.textContent = doneLabel;
  setTimeout(() => (btn.textContent = original), 1200);
}

function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv() {
  const a = lastAnalysis;
  const rows = [
    ["field", "value"],
    ["rfqId", a?.fields?.rfqId || ""],
    ["customer", a?.fields?.customer || ""],
    ["product", a?.fields?.product || ""],
    ["region", a?.fields?.region || ""],
    ["dueDate", a?.fields?.dueDate || ""],
    ["annualVolume", a?.numeric?.annualVolume ?? ""],
    ["priceTarget", a?.numeric?.priceTarget ?? ""],
    ["completeness", a?.completeness ?? ""],
    ["reviewStatus", a?.reviewStatus || ""],
    ["reviewDecision", lastReview?.decision || "Pending"],
    ["reviewer", lastReview?.reviewer || ""],
    ["decidedAt", lastReview?.decidedAt || ""]
  ];
  return rows
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// ---- Event wiring --------------------------------------------------------

$("analyzeBtn").addEventListener("click", runAnalysis);
$("clearBtn").addEventListener("click", () => {
  $("documentInput").value = "";
  reset();
});
$("sampleSelect").addEventListener("change", (e) => loadSample(e.target.value));

$("approveBtn").addEventListener("click", () => recordDecision("APPROVE"));
$("needsInfoBtn").addEventListener("click", () => recordDecision("NEEDS_INFO"));
$("rejectBtn").addEventListener("click", () => recordDecision("REJECT"));

$("copyJsonBtn").addEventListener("click", () =>
  copyText(JSON.stringify(currentOutput(), null, 2), "copyJsonBtn")
);
$("downloadJsonBtn").addEventListener("click", () => {
  const id = lastAnalysis?.fields?.rfqId || "rfq";
  download(`${id}-analysis.json`, JSON.stringify(currentOutput(), null, 2));
});
$("copyCrmBtn").addEventListener("click", () =>
  copyText(
    JSON.stringify(toCrmPayload(lastAnalysis, lastReview), null, 2),
    "copyCrmBtn"
  )
);
$("downloadCsvBtn").addEventListener("click", () => {
  const id = lastAnalysis?.fields?.rfqId || "rfq";
  download(`${id}-summary.csv`, toCsv(), "text/csv");
});

// ---- Boot ----------------------------------------------------------------

(async function boot() {
  const samples = await loadSampleManifest();
  if (samples.length) {
    await loadSample(samples[0].file);
  }
})();

// Exposed for lightweight debugging in the browser console.
window.__rfq = { analyzeRfq, canApprove };
