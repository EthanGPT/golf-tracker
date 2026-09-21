import { beforeEach, describe, expect, it } from "vitest";
import { seedData } from "./domain";
import {
  isSyncPending,
  loadLocalData,
  mergeAppData,
  markSyncPending,
  saveLocalData,
} from "./localRepository";

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
});

describe("local repository", () => {
  it("merges local and cloud archives without shrinking either source", () => {
    const local = seedData();
    const cloud = seedData();
    local.rounds = [{ ...local.rounds[0], id: "local-round", date: "2026-09-17" }];
    cloud.rounds = [{ ...cloud.rounds[0], id: "cloud-round", date: "2026-09-19", status: "archived" }];
    local.readings = [{ ...local.readings[0], id: "shared-reading", distanceMetres: 222 }];
    cloud.readings = [{ ...cloud.readings[0], id: "cloud-reading" }];
    const merged = mergeAppData(local, cloud)!;
    expect(merged.rounds.map((round) => round.id)).toEqual(expect.arrayContaining(["local-round", "cloud-round"]));
    expect(merged.readings.map((reading) => reading.id)).toEqual(expect.arrayContaining(["shared-reading", "cloud-reading"]));
    expect(merged.readings.find((reading) => reading.id === "shared-reading")?.distanceMetres).toBe(222);
  });

  it("keeps the more complete round when the local copy is stale", () => {
    const local = seedData();
    const cloud = seedData();
    const baseRound = { id: "round", date: "2026-09-19", courseName: "Test", overallNote: "", status: "in-progress" as const, holes: [] };
    local.rounds = [baseRound];
    cloud.rounds = [{ ...baseRound, status: "archived", totalScore: 84, holes: [{ holeNumber: 1, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" }] }];
    expect(mergeAppData(local, cloud)!.rounds[0].status).toBe("archived");
    expect(mergeAppData(local, cloud)!.rounds[0].holes).toHaveLength(1);
  });
  it("persists app data without a network", () => {
    const data = seedData();
    saveLocalData(data);
    expect(loadLocalData()?.schemaVersion).toBe(data.schemaVersion);
    expect(loadLocalData()?.bag).toEqual(data.bag);
  });

  it("retains a pending sync marker until cloud sync succeeds", () => {
    markSyncPending(true);
    expect(isSyncPending()).toBe(true);
    markSyncPending(false);
    expect(isSyncPending()).toBe(false);
  });
});
