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

function recordScore(record: unknown): number {
  if (!record || typeof record !== "object") return 0;
  return Object.keys(record).length + JSON.stringify(record).length / 1000;
}

function mergeById<T extends { id: string }>(local: T[] = [], cloud: T[] = []) {
  const merged = new Map<string, T>();
  for (const item of cloud) merged.set(item.id, item);
  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing || recordScore(item) >= recordScore(existing)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mergeRounds(local: AppData["rounds"], cloud: AppData["rounds"]) {
  const merged = new Map<string, AppData["rounds"][number]>();
  for (const round of cloud) merged.set(round.id, round);
  for (const round of local) {
    const existing = merged.get(round.id);
    if (!existing || (existing.status !== "archived" && round.status === "archived") || recordScore(round) >= recordScore(existing)) merged.set(round.id, round);
  }
  return [...merged.values()];
}

export function mergeAppData(local: AppData | null, cloud: AppData | null): AppData | null {
  if (!local) return cloud;
  if (!cloud) return local;
  const weeklyHistory = [...(cloud.weeklyHistory || []), ...(local.weeklyHistory || [])]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.weekStart === item.weekStart) === index);
  return {
    ...cloud,
    ...local,
    rounds: mergeRounds(local.rounds, cloud.rounds),
    readings: mergeById(local.readings, cloud.readings),
    handicapHistory: mergeById(local.handicapHistory, cloud.handicapHistory),
    weeklyHistory,
    weeklyPlan: recordScore(local.weeklyPlan) >= recordScore(cloud.weeklyPlan) ? local.weeklyPlan : cloud.weeklyPlan,
  };
}
