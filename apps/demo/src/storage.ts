import type { SerializedInteractiveMediaDocument } from "@interlacejs/core";

const STORAGE_KEY = "interlace-demo-doc";

/**
 * Loads the persisted document. Corrupt or missing storage resolves to
 * `null` (never throws).
 */
export function loadDoc(): SerializedInteractiveMediaDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SerializedInteractiveMediaDocument;
  } catch {
    return null;
  }
}

/** Persists the document. Storage failures (private mode, quota) are silent. */
export function saveDoc(doc: SerializedInteractiveMediaDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // Storage may be unavailable; the in-memory document still works.
  }
}

/** Removes the persisted document. */
export function clearDoc(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage unavailability.
  }
}