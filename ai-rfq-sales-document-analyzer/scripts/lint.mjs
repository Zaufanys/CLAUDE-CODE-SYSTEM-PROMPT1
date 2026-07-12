// Lightweight, dependency-free project checks. Verifies the expected files
// exist and guards against the class of bug where the browser cannot load the
// shared modules because they live outside the served public/ root.
import fs from "node:fs";
import path from "node:path";

const required = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/js/rfqAnalyzer.js",
  "public/js/schema.js",
  "public/js/review.js",
  "public/samples/index.json",
  "public/samples/sample-rfq.json",
  "README.md",
  "ARCHITECTURE.md",
  "LICENSE"
];

const problems = [];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) problems.push(`Missing files: ${missing.join(", ")}`);

// The site must be self-contained: browser code under public/ must not import
// from outside public/ (that would 404 when served statically / on Pages).
if (fs.existsSync("public/app.js")) {
  const appSrc = fs.readFileSync("public/app.js", "utf8");
  if (/from\s+["']\.\.\//.test(appSrc)) {
    problems.push(
      "public/app.js imports from outside public/ (../). Browser code must stay self-contained."
    );
  }
}

// Every sample listed in the manifest must exist and be valid JSON.
if (fs.existsSync("public/samples/index.json")) {
  try {
    const manifest = JSON.parse(
      fs.readFileSync("public/samples/index.json", "utf8")
    );
    for (const sample of manifest.samples || []) {
      const file = path.join("public/samples", sample.file);
      if (!fs.existsSync(file)) {
        problems.push(`Sample listed in manifest is missing: ${file}`);
        continue;
      }
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!doc.document) problems.push(`Sample ${file} has no "document" field.`);
    }
  } catch (err) {
    problems.push(`samples/index.json is not valid JSON: ${err.message}`);
  }
}

if (problems.length) {
  console.error("Lint failed:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log("Project structure OK");
