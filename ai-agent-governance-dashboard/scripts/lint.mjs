// Lightweight, dependency-free "lint" gate for CI.
// Three checks: required files exist, every JS file parses (`node --check`),
// and the trace dataset is well-formed. Exits non-zero on any failure.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.join(root, p);
const problems = [];

// 1) Required project files.
const required = [
  "public/index.html",
  "public/mapping.html",
  "public/styles.css",
  "public/js/app.js",
  "public/js/governanceEngine.js",
  "public/data/traces.json",
  "README.md",
  "ARCHITECTURE.md",
  "package.json",
];
for (const f of required) {
  if (!fs.existsSync(rel(f))) problems.push(`Missing required file: ${f}`);
}

// 2) Syntax-check every JS/MJS file (parse only, no execution).
const jsFiles = [
  "public/js/app.js",
  "public/js/governanceEngine.js",
  "scripts/serve.mjs",
  "scripts/lint.mjs",
];
for (const f of jsFiles) {
  if (!fs.existsSync(rel(f))) continue;
  try {
    execFileSync(process.execPath, ["--check", rel(f)], { stdio: "pipe" });
  } catch (err) {
    problems.push(`Syntax error in ${f}:\n${String(err.stderr || err.message).trim()}`);
  }
}

// 3) Validate the fictional trace dataset.
try {
  const raw = fs.readFileSync(rel("public/data/traces.json"), "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length === 0) {
    problems.push("traces.json must be a non-empty array");
  } else {
    const ids = new Set();
    rows.forEach((t, i) => {
      const where = `traces[${i}]`;
      for (const key of ["id", "timestamp", "agent", "input"]) {
        if (t[key] == null || t[key] === "") problems.push(`${where} missing "${key}"`);
      }
      if (t.id) {
        if (ids.has(t.id)) problems.push(`${where} duplicate id "${t.id}"`);
        ids.add(t.id);
      }
      if (t.tools && !Array.isArray(t.tools)) problems.push(`${where}.tools must be an array`);
      if (t.groundedness != null && (t.groundedness < 0 || t.groundedness > 1)) {
        problems.push(`${where}.groundedness must be within 0..1`);
      }
    });
  }
} catch (err) {
  problems.push(`traces.json is not valid JSON: ${err.message}`);
}

if (problems.length) {
  console.error("Lint failed:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("Lint passed: structure, JS syntax, and trace dataset all OK.");
