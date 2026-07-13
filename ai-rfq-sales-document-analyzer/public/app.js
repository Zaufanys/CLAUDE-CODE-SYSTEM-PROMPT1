// Front-end wiring for the RFQ analyzer. All heavy logic lives in the shared
// ES modules under ./js so the exact same code runs in the browser and in the
// Node test suite.

import { analyzeRfq } from "./js/rfqAnalyzer.js";
import { fieldLabels } from "./js/schema.js";
import { buildReviewPackage, toCrmPayload } from "./js/review.js";
import {
  readQueue,
  upsertRecord,
  deleteRecord,
  clearQueue,
  makeRecord
} from "./js/store.js";

const $ = (id) => document.getElementById(id);
const storage = typeof localStorage !== "undefined" ? localStorage : null;

let lastAnalysis = null;
let lastReview = null;
let currentRecordId = null; // set when the workspace was loaded from a queue record

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

const genId = () =>
  "rec_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

// ---- Samples -------------------------------------------------------------

async function loadSampleManifest() {
  const select = $("sampleSelect");
  try {
    const res = await fetch("samples/index.json");
    const manifest = await res.json();
    select.innerHTML =
      `<option value="">— choose an example —</option>` +
      manifest.samples
        .map((s) => `<option value="${esc(s.file)}">${esc(s.label)}</option>`)
        .join("");
    return manifest.samples;
  } catch {
    select.innerHTML = `<option value="">(examples unavailable)</option>`;
    return [];
  }
}

async function loadSample(file) {
  if (!file) return;
  const res = await fetch(`samples/${file}`);
  const sample = await res.json();
  currentRecordId = null;
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

  $("fieldTable").innerHTML = Object.entries(result.fields)
    .map(([key, value]) => row(fieldLabels[key] || key, esc(value)))
    .join("");

  const missingRows = result.missing.map((field) =>
    row("Missing", `<span class="bad">${fieldLabels[field] || field}</span>`)
  );
  const riskRows = result.risks.map((risk) =>
    row(risk.severity.toUpperCase(), esc(risk.label), esc(risk.evidence), true)
  );
  $("riskTable").innerHTML =
    [...missingRows, ...riskRows].join("") ||
    row("None", "<span class='good'>No major issues detected.</span>");

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

  $("evidenceTable").innerHTML =
    Object.entries(result.evidence)
      .filter(([, value]) => value)
      .map(([key, value]) => row(fieldLabels[key] || key, esc(value)))
      .join("") || row("Evidence", "No snippets available.");

  $("nextActions").innerHTML =
    "<strong>Recommended next actions</strong><br>" +
    result.recommendedNextActions.map((a) => `• ${esc(a)}`).join("<br>");

  renderOutput();
}

function reset() {
  lastAnalysis = null;
  lastReview = null;
  currentRecordId = null;
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
  renderDecision();
  renderOutput();
}

function renderDecision() {
  if (!lastReview) {
    $("decisionOut").textContent = "No decision recorded yet.";
    return;
  }
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
}

// ---- Reviewer queue (persistent) -----------------------------------------

function saveToQueue() {
  if (!lastAnalysis) {
    $("decisionOut").textContent = "Analyze a document before saving to the queue.";
    return;
  }
  const id = currentRecordId || genId();
  currentRecordId = id;
  const record = makeRecord(lastAnalysis, lastReview, $("documentInput").value, {
    id,
    savedAt: new Date().toISOString()
  });
  upsertRecord(storage, record);
  renderQueue();
  flash("saveQueueBtn", "Saved");
}

function openRecord(id) {
  const record = readQueue(storage).find((r) => r.id === id);
  if (!record) return;
  currentRecordId = record.id;
  $("documentInput").value = record.document || "";
  lastAnalysis = record.analysis || analyzeRfq(record.document || "");
  lastReview = record.review || null;
  $("reviewerName").value = lastReview?.reviewer && lastReview.reviewer !== "Unassigned Reviewer" ? lastReview.reviewer : "";
  $("reviewComment").value = lastReview?.comment || "";
  render();
  renderDecision();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function removeRecord(id) {
  deleteRecord(storage, id);
  if (currentRecordId === id) currentRecordId = null;
  renderQueue();
}

function renderQueue() {
  const queue = readQueue(storage);
  $("queueCount").textContent = queue.length ? `(${queue.length})` : "";
  if (!queue.length) {
    $("queueTable").innerHTML =
      `<tr><td colspan="7" class="muted">Queue is empty. Analyze a document and click “Save to Queue”.</td></tr>`;
    return;
  }
  $("queueTable").innerHTML = queue
    .map((r) => {
      const decisionClass =
        r.decision === "Approved"
          ? "good"
          : r.decision === "Rejected"
            ? "bad"
            : r.decision === "Pending"
              ? "muted"
              : "warn";
      const when = String(r.savedAt || "").replace("T", " ").slice(0, 16);
      return (
        `<tr>` +
        `<td class="muted">${esc(when)}</td>` +
        `<td>${esc(r.customer)}</td>` +
        `<td>${esc(r.rfqId)}</td>` +
        `<td>${r.completeness}%</td>` +
        `<td>${esc(r.reviewStatus)}</td>` +
        `<td class="${decisionClass}">${esc(r.decision)}</td>` +
        `<td class="row"><button data-open="${esc(r.id)}">Open</button>` +
        `<button class="bad-btn" data-del="${esc(r.id)}">Delete</button></td>` +
        `</tr>`
      );
    })
    .join("");
}

// ---- Output / export -----------------------------------------------------

function currentOutput() {
  if (!lastAnalysis) return {};
  return lastReview ? { ...lastAnalysis, review: stripAnalysis(lastReview) } : lastAnalysis;
}

function stripAnalysis(reviewPackage) {
  const { analysis, ...rest } = reviewPackage;
  return rest;
}

function renderOutput() {
  $("jsonOut").textContent = JSON.stringify(currentOutput(), null, 2);
}

async function copyText(text, btnId) {
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
  flash(btnId, "Copied");
}

function flash(btnId, label) {
  const btn = $(btnId);
  const original = btn.dataset.label || btn.textContent;
  btn.dataset.label = original;
  btn.textContent = label;
  setTimeout(() => (btn.textContent = btn.dataset.label), 1200);
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

// ---- File intake (upload + drag-and-drop) --------------------------------

function loadTextFile(file) {
  if (!file) return;
  const isText = file.type === "text/plain" || /\.txt$/i.test(file.name);
  if (!isText) {
    $("decisionOut").textContent = "Unsupported file type. Please provide a .txt file.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    currentRecordId = null;
    $("sampleSelect").value = "";
    $("documentInput").value = String(reader.result || "");
    runAnalysis();
  };
  reader.readAsText(file);
}

function wireDragAndDrop() {
  const zone = $("dropZone");
  ["dragenter", "dragover"].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragleave" && zone.contains(e.relatedTarget)) return;
      zone.classList.remove("dragover");
    })
  );
  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) loadTextFile(file);
  });
}

// ---- Event wiring --------------------------------------------------------

$("analyzeBtn").addEventListener("click", runAnalysis);
$("clearBtn").addEventListener("click", () => {
  $("documentInput").value = "";
  $("sampleSelect").value = "";
  reset();
});
$("sampleSelect").addEventListener("change", (e) => loadSample(e.target.value));

$("uploadBtn").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (e) => loadTextFile(e.target.files?.[0]));

$("approveBtn").addEventListener("click", () => recordDecision("APPROVE"));
$("needsInfoBtn").addEventListener("click", () => recordDecision("NEEDS_INFO"));
$("rejectBtn").addEventListener("click", () => recordDecision("REJECT"));
$("saveQueueBtn").addEventListener("click", saveToQueue);

$("copyJsonBtn").addEventListener("click", () =>
  copyText(JSON.stringify(currentOutput(), null, 2), "copyJsonBtn")
);
$("downloadJsonBtn").addEventListener("click", () => {
  const id = lastAnalysis?.fields?.rfqId || "rfq";
  download(`${id}-analysis.json`, JSON.stringify(currentOutput(), null, 2));
});
$("copyCrmBtn").addEventListener("click", () =>
  copyText(JSON.stringify(toCrmPayload(lastAnalysis, lastReview), null, 2), "copyCrmBtn")
);
$("downloadCsvBtn").addEventListener("click", () => {
  const id = lastAnalysis?.fields?.rfqId || "rfq";
  download(`${id}-summary.csv`, toCsv(), "text/csv");
});

$("exportQueueBtn").addEventListener("click", () =>
  download("rfq-reviewer-queue.json", JSON.stringify(readQueue(storage), null, 2))
);
$("clearQueueBtn").addEventListener("click", () => {
  if (readQueue(storage).length && confirm("Clear the entire reviewer queue?")) {
    clearQueue(storage);
    currentRecordId = null;
    renderQueue();
  }
});

// Delegated Open/Delete buttons in the queue table.
$("queueTable").addEventListener("click", (e) => {
  const openId = e.target.getAttribute?.("data-open");
  const delId = e.target.getAttribute?.("data-del");
  if (openId) openRecord(openId);
  else if (delId) removeRecord(delId);
});

// ---- Boot ----------------------------------------------------------------

(async function boot() {
  wireDragAndDrop();
  renderQueue();
  const samples = await loadSampleManifest();
  if (samples.length) {
    $("sampleSelect").value = samples[0].file;
    await loadSample(samples[0].file);
  }
})();
