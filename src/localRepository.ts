import type { AppData } from "./domain";

const DATA_KEY = "golf-tracker-local-data";
const PENDING_KEY = "golf-tracker-cloud-sync-pending";

export function loadLocalData(): AppData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}

export function saveLocalData(data: AppData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // Local persistence is best effort; the in-memory UI remains usable.
  }
}

export function markSyncPending(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, "true");
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore storage quota/private-mode errors.
  }
}

export function isSyncPending() {
  try {
    return localStorage.getItem(PENDING_KEY) === "true";
  } catch {
    return false;
  }
}
