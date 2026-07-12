// Dashboard controller for the AI Agent Governance Dashboard.
// Loads fictional traces, scores them with the shared governance engine, and
// wires up filtering, a trace timeline, an approval queue, a human reviewer
// workflow (persisted in localStorage), and audit export.
import { summarizeTraces, RULES, FILTERS } from "./governanceEngine.js";

// --- tiny helpers ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const pct = (n) =>
  new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(n || 0);
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]),
  );
const unique = (arr, key) => [...new Set(arr.map((x) => x[key]))].sort();
const fmtTime = (ts) => {
  const d = new Date(ts);
  return isNaN(d) ? String(ts) : d.toLocaleString();
};
const shortTime = (ts) => {
  const d = new Date(ts);
  return isNaN(d) ? String(ts) : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const riskClass = (level) => (level === "High" ? "bad" : level === "Medium" ? "warn" : "good");

// --- persistence -------------------------------------------------------------
const DECISIONS_KEY = "aiagd.decisions.v1";
const REVIEWER_KEY = "aiagd.reviewer.v1";
const store = {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable (e.g. private mode) — decisions stay in-memory */
    }
  },
};

// --- state -------------------------------------------------------------------
const state = {
  summary: null,
  decisions: store.load(DECISIONS_KEY, {}),
  reviewer: store.load(REVIEWER_KEY, ""),
  activeChips: new Set(),
  selectedId: null,
};

const DECISION_LABEL = { approved: "Approved", rejected: "Rejected", escalated: "Escalated" };

function decisionStatus(trace) {
  const d = state.decisions[trace.id];
  if (d && d.status) return d.status;
  return trace.approvalRequired ? "pending" : "none";
}

// --- filtering ---------------------------------------------------------------
function getFiltered() {
  const risk = $("riskFilter").value;
  const agent = $("agentFilter").value;
  return state.summary.scored.filter((t) => {
    if (risk && t.governance.level !== risk) return false;
    if (agent && t.agent !== agent) return false;
    for (const key of state.activeChips) {
      const f = FILTERS[key];
      if (f && !f.test(t)) return false;
    }
    return true;
  });
}

// --- render orchestration ----------------------------------------------------
function render() {
  renderKpis();
  renderBreakdown();
  renderRuleTally();
  renderTimeline();
  renderQueue();
  renderTable();
  renderSelected();
}

function renderKpis() {
  const s = state.summary;
  $("kpiTotal").textContent = s.total;
  $("kpiHigh").textContent = s.high;
  $("kpiMedium").textContent = s.medium;
  $("kpiApprovalsMissing").textContent = s.approvalsMissing;
  $("kpiWrite").textContent = s.writeTools;
  $("kpiGrounded").textContent = pct(s.avgGroundedness);
}

function renderBreakdown() {
  const s = state.summary;
  const max = Math.max(1, s.total);
  $("barHigh").style.width = `${(s.high / max) * 100}%`;
  $("barMedium").style.width = `${(s.medium / max) * 100}%`;
  $("barLow").style.width = `${(s.low / max) * 100}%`;
  $("cntHigh").textContent = s.high;
  $("cntMedium").textContent = s.medium;
  $("cntLow").textContent = s.low;
}

function renderRuleTally() {
  const tally = new Map();
  for (const t of state.summary.scored) {
    for (const f of t.governance.flags) tally.set(f.id, (tally.get(f.id) || 0) + 1);
  }
  const labelOf = (id) => (RULES.find((r) => r.id === id) || {}).label || id;
  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("ruleTally").innerHTML = rows.length
    ? rows
        .map(
          ([id, n]) =>
            `<li><span>${esc(labelOf(id))}</span><span class="count-badge">${n}</span></li>`,
        )
        .join("")
    : `<li class="muted">No policies triggered.</li>`;
}

function renderTimeline() {
  const rows = [...state.summary.scored].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
  $("timeline").innerHTML = rows
    .map((t) => {
      const sel = t.id === state.selectedId ? " selected" : "";
      return `<button class="tl-node${sel}" data-id="${t.id}" title="${esc(t.agent)} — ${esc(
        t.governance.level,
      )} risk">
        <span class="tl-dot ${riskClass(t.governance.level)}-bg"></span>
        <span class="tl-time">${esc(shortTime(t.timestamp))}</span>
        <span class="tl-agent">${esc(t.agent)}</span>
      </button>`;
    })
    .join("");
}

function renderQueue() {
  const pending = state.summary.scored.filter((t) => decisionStatus(t) === "pending");
  $("queueCount").textContent = pending.length;
  if (!pending.length) {
    $("approvalQueue").innerHTML = `<p class="muted small ok-note">✓ No traces awaiting a decision.</p>`;
    return;
  }
  $("approvalQueue").innerHTML = pending
    .map(
      (t) => `<div class="queue-item" data-id="${t.id}">
        <div class="queue-main">
          <span class="tag ${riskClass(t.governance.level)}">${esc(t.governance.level)}</span>
          <button class="link" data-open="${t.id}">${esc(t.id)} · ${esc(t.agent)}</button>
          <span class="muted small">${esc(t.governance.reasons[0] || "Approval required")}</span>
        </div>
        <div class="row queue-actions">
          <button class="btn approve xs" data-quick="approved" data-id="${t.id}">Approve</button>
          <button class="btn reject xs" data-quick="rejected" data-id="${t.id}">Reject</button>
          <button class="btn escalate xs" data-quick="escalated" data-id="${t.id}">Escalate</button>
        </div>
      </div>`,
    )
    .join("");
}

function decisionBadge(trace) {
  const status = decisionStatus(trace);
  if (status === "none") return `<span class="muted">—</span>`;
  if (status === "pending") return `<span class="badge pending">Pending</span>`;
  return `<span class="badge ${status}">${DECISION_LABEL[status]}</span>`;
}

function renderTable() {
  const rows = getFiltered();
  $("tableEmpty").hidden = rows.length > 0;
  $("traceTable").innerHTML = rows
    .map((t) => {
      const cls = riskClass(t.governance.level);
      const flags = t.governance.flags.length
        ? t.governance.flags
            .map((f) => `<span class="flag ${f.severity}">${esc(f.label)}</span>`)
            .join(" ")
        : `<span class="muted">No issues</span>`;
      const sel = t.id === state.selectedId ? " selected" : "";
      return `<tr class="${sel}" data-id="${t.id}">
        <td>${esc(t.id)}<br /><span class="muted small">${esc(shortTime(t.timestamp))}</span></td>
        <td>${esc(t.agent)}</td>
        <td class="${cls}">${esc(t.governance.level)} <span class="muted">(${t.governance.score})</span></td>
        <td>${esc(t.governance.action)}</td>
        <td class="flags-cell">${flags}</td>
        <td>${decisionBadge(t)}</td>
      </tr>`;
    })
    .join("");
}

function renderSelected() {
  const trace = state.summary.scored.find((t) => t.id === state.selectedId);
  if (!trace) {
    $("reviewer").hidden = true;
    $("selectedHint").hidden = false;
    $("selectedTitle").textContent = "Selected trace";
    return;
  }
  $("selectedHint").hidden = true;
  $("reviewer").hidden = false;
  $("selectedTitle").textContent = `${trace.id} · ${trace.agent}`;

  // Reviewer decision state.
  const decision = state.decisions[trace.id];
  $("reviewerNote").value = decision?.note || "";
  document.querySelectorAll("#decisionButtons [data-decision]").forEach((btn) => {
    btn.classList.toggle("active", !!decision && decision.status === btn.dataset.decision);
  });
  $("decisionMeta").textContent = decision
    ? `${DECISION_LABEL[decision.status]} by ${decision.reviewer || "unknown"} · ${fmtTime(
        decision.timestamp,
      )}`
    : trace.approvalRequired
      ? "Awaiting decision — approval required."
      : "No decision required.";

  // Per-trace policy checklist: every rule, pass or fail.
  $("policyChecklist").innerHTML = RULES.map((r) => {
    const triggered = trace.governance.categories[r.id];
    return `<li class="${triggered ? "fail" : "pass"}">
      <span class="mark">${triggered ? "⚠" : "✓"}</span>
      <span><strong>${esc(r.label)}</strong><br /><span class="muted small">${esc(
        r.description,
      )}</span></span>
    </li>`;
  }).join("");

  // Raw trace (with computed governance + any recorded decision).
  $("traceJson").textContent = JSON.stringify(
    { ...trace, decision: decision || null },
    null,
    2,
  );
}

// --- actions -----------------------------------------------------------------
function select(id) {
  state.selectedId = id;
  render();
  document.getElementById("selectedTitle")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setDecision(id, status) {
  const note = state.selectedId === id ? $("reviewerNote").value.trim() : state.decisions[id]?.note || "";
  state.decisions[id] = {
    status,
    note,
    reviewer: state.reviewer || "reviewer",
    timestamp: new Date().toISOString(),
  };
  store.save(DECISIONS_KEY, state.decisions);
  render();
}

function clearDecision(id) {
  delete state.decisions[id];
  store.save(DECISIONS_KEY, state.decisions);
  render();
}

function buildChips() {
  $("quickFilters").innerHTML = Object.entries(FILTERS)
    .map(([key, f]) => `<button class="chip" data-chip="${key}">${esc(f.label)}</button>`)
    .join("");
}

function syncChips() {
  document.querySelectorAll("#quickFilters .chip").forEach((chip) => {
    chip.classList.toggle("active", state.activeChips.has(chip.dataset.chip));
  });
}

function resetFilters() {
  $("riskFilter").value = "";
  $("agentFilter").value = "";
  state.activeChips.clear();
  syncChips();
  renderTable();
}

function exportJson() {
  const filtered = getFiltered();
  const s = state.summary;
  const payload = {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Fictional demonstration data. Contains no real customer, pricing, or confidential information.",
    filtersApplied: {
      risk: $("riskFilter").value || "all",
      agent: $("agentFilter").value || "all",
      quickFilters: [...state.activeChips],
    },
    summary: {
      total: s.total,
      high: s.high,
      medium: s.medium,
      low: s.low,
      approvalsRequired: s.approvalsRequired,
      approvalsMissing: s.approvalsMissing,
      writeTools: s.writeTools,
      avgGroundedness: Number(s.avgGroundedness.toFixed(3)),
      exportedTraceCount: filtered.length,
    },
    traces: filtered.map((t) => ({ ...t, decision: state.decisions[t.id] || null })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ai_agent_governance_audit.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- event wiring ------------------------------------------------------------
function wireEvents() {
  $("riskFilter").addEventListener("change", renderTable);
  $("agentFilter").addEventListener("change", renderTable);
  $("resetBtn").addEventListener("click", resetFilters);
  $("exportBtn").addEventListener("click", exportJson);

  $("reviewerName").addEventListener("input", (e) => {
    state.reviewer = e.target.value;
    store.save(REVIEWER_KEY, state.reviewer);
  });

  $("quickFilters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const key = chip.dataset.chip;
    if (state.activeChips.has(key)) state.activeChips.delete(key);
    else state.activeChips.add(key);
    syncChips();
    renderTable();
  });

  $("timeline").addEventListener("click", (e) => {
    const node = e.target.closest(".tl-node");
    if (node) select(node.dataset.id);
  });

  $("traceTable").addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) select(row.dataset.id);
  });

  $("approvalQueue").addEventListener("click", (e) => {
    const quick = e.target.closest("[data-quick]");
    if (quick) {
      setDecision(quick.dataset.id, quick.dataset.quick);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) select(open.dataset.open);
  });

  $("decisionButtons").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-decision]");
    if (btn && state.selectedId) setDecision(state.selectedId, btn.dataset.decision);
  });
  $("clearDecisionBtn").addEventListener("click", () => {
    if (state.selectedId) clearDecision(state.selectedId);
  });
}

// --- boot --------------------------------------------------------------------
async function boot() {
  buildChips();
  $("reviewerName").value = state.reviewer;
  wireEvents();
  try {
    const res = await fetch("data/traces.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    state.summary = summarizeTraces(rows);
    $("agentFilter").innerHTML =
      `<option value="">All</option>` +
      unique(rows, "agent")
        .map((a) => `<option>${esc(a)}</option>`)
        .join("");
    render();
  } catch (err) {
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      `<section class="card span12"><p class="bad">Failed to load traces: ${esc(
        err.message,
      )}. Run <code>npm start</code> and open the served URL (fetch does not work from <code>file://</code>).</p></section>`,
    );
  }
}

boot();
