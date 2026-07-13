// Local-first persistence for the reviewer queue.
//
// Analyzed documents and their review decisions are saved to the browser's
// localStorage so work survives reloads — no account or server required. The
// functions take a `storage` object (anything with getItem/setItem, e.g.
// window.localStorage) so the layer is fully unit-testable with an in-memory
// fake in Node.

const KEY = "rfq.queue.v1";

export function readQueue(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(storage, queue) {
  if (!storage) return queue;
  storage.setItem(KEY, JSON.stringify(queue));
  return queue;
}

// Insert a new record at the front, or replace an existing one with the same id.
export function upsertRecord(storage, record) {
  const queue = readQueue(storage);
  const idx = queue.findIndex((r) => r.id === record.id);
  if (idx >= 0) queue[idx] = record;
  else queue.unshift(record);
  return writeQueue(storage, queue);
}

export function deleteRecord(storage, id) {
  const queue = readQueue(storage).filter((r) => r.id !== id);
  return writeQueue(storage, queue);
}

export function clearQueue(storage) {
  return writeQueue(storage, []);
}

// Build a compact, self-contained queue record from an analysis + review.
// `id` and `savedAt` are supplied by the caller so tests stay deterministic.
export function makeRecord(analysis, review, documentText, { id, savedAt }) {
  return {
    id,
    savedAt,
    document: documentText || "",
    rfqId: analysis?.fields?.rfqId || "(no RFQ ID)",
    customer: analysis?.fields?.customer || "(no customer)",
    completeness: analysis?.completeness ?? 0,
    reviewStatus: analysis?.reviewStatus || "",
    decision: review?.decision || "Pending",
    analysis,
    review: review || null
  };
}
