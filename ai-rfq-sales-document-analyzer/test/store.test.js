import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRfq } from "../public/js/rfqAnalyzer.js";
import { buildReviewPackage } from "../public/js/review.js";
import {
  readQueue,
  upsertRecord,
  deleteRecord,
  clearQueue,
  makeRecord
} from "../public/js/store.js";

// In-memory stand-in for window.localStorage.
function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    }
  };
}

const sample = `Customer: ACME Mobility
RFQ ID: RFQ-STORE-1
Due Date: 2026-05-01
Region: Europe
Product: Bracket
Estimated Annual Volume: 50000 units
Requested Price Target: 12.50 EUR per unit`;

function recordFrom(id, savedAt) {
  const analysis = analyzeRfq(sample);
  const review = buildReviewPackage(
    analysis,
    { action: "APPROVE", reviewer: "J. Rivera" },
    "2026-07-12T09:00:00.000Z"
  );
  return makeRecord(analysis, review, sample, { id, savedAt });
}

test("empty storage yields an empty queue", () => {
  assert.deepEqual(readQueue(fakeStorage()), []);
});

test("makeRecord captures the key summary fields", () => {
  const record = recordFrom("rec_1", "2026-07-12T09:00:00.000Z");
  assert.equal(record.rfqId, "RFQ-STORE-1");
  assert.equal(record.customer, "ACME Mobility");
  assert.equal(record.completeness, 100);
  assert.equal(record.decision, "Approved");
  assert.equal(record.document, sample);
});

test("upsertRecord adds new records at the front", () => {
  const storage = fakeStorage();
  upsertRecord(storage, recordFrom("rec_1", "2026-07-12T09:00:00.000Z"));
  upsertRecord(storage, recordFrom("rec_2", "2026-07-12T10:00:00.000Z"));
  const queue = readQueue(storage);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, "rec_2");
  assert.equal(queue[1].id, "rec_1");
});

test("upsertRecord replaces an existing record with the same id", () => {
  const storage = fakeStorage();
  upsertRecord(storage, recordFrom("rec_1", "2026-07-12T09:00:00.000Z"));
  const updated = recordFrom("rec_1", "2026-07-12T11:00:00.000Z");
  updated.decision = "Rejected";
  upsertRecord(storage, updated);
  const queue = readQueue(storage);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].decision, "Rejected");
});

test("deleteRecord removes only the targeted record", () => {
  const storage = fakeStorage();
  upsertRecord(storage, recordFrom("rec_1", "2026-07-12T09:00:00.000Z"));
  upsertRecord(storage, recordFrom("rec_2", "2026-07-12T10:00:00.000Z"));
  deleteRecord(storage, "rec_1");
  const queue = readQueue(storage);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, "rec_2");
});

test("clearQueue empties the queue", () => {
  const storage = fakeStorage();
  upsertRecord(storage, recordFrom("rec_1", "2026-07-12T09:00:00.000Z"));
  clearQueue(storage);
  assert.deepEqual(readQueue(storage), []);
});

test("readQueue tolerates corrupt storage without throwing", () => {
  const storage = fakeStorage();
  storage.setItem("rfq.queue.v1", "{not valid json");
  assert.deepEqual(readQueue(storage), []);
});

test("a null storage backend is a safe no-op", () => {
  assert.deepEqual(readQueue(null), []);
  assert.doesNotThrow(() => upsertRecord(null, recordFrom("x", "t")));
});
