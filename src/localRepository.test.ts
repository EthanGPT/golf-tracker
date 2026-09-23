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

  it("uses the cloud round exactly when the same ID conflicts", () => {
    const local = seedData();
    const cloud = seedData();
    const baseRound = { id: "round", date: "2026-09-19", courseName: "Test", overallNote: "", status: "in-progress" as const, holes: [] };
    local.rounds = [baseRound];
    cloud.rounds = [{ ...baseRound, status: "archived", totalScore: 84, holes: [{ holeNumber: 1, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" }] }];
    expect(mergeAppData(local, cloud)!.rounds[0]).toEqual(cloud.rounds[0]);
  });

  it("does not let a larger corrupted archived local round replace cloud", () => {
    const local = seedData();
    const cloud = seedData();
    const hole = { holeNumber: 10, score: 5, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" };
    const cloudRound = { id: "round-a", date: "2026-09-21", courseName: "Test", overallNote: "", status: "archived" as const, totalScore: 42, holes: [hole, { ...hole, holeNumber: 11 }] };
    local.rounds = [{ ...cloudRound, totalScore: 45, holes: [...cloudRound.holes, { ...hole, holeNumber: 1, note: "corrupt" }] }];
    cloud.rounds = [cloudRound];
    expect(mergeAppData(local, cloud)!.rounds).toEqual([cloudRound]);
  });

  it("preserves a local-only offline archived round", () => {
    const local = seedData();
    const cloud = seedData();
    local.rounds = [{ ...local.rounds[0], id: "offline", status: "archived" }];
    cloud.rounds = [];
    expect(mergeAppData(local, cloud)!.rounds.map((round) => round.id)).toEqual(["offline"]);
  });

  it("never lets an in-progress local copy replace an archived cloud copy", () => {
    const local = seedData();
    const cloud = seedData();
    const baseRound = { id: "round", date: "2026-09-19", courseName: "Test", overallNote: "", holes: [] };
    cloud.rounds = [{ ...baseRound, status: "archived" as const, totalScore: 84, archivedAt: "2026-09-20T10:00:00.000Z", holes: [{ holeNumber: 1, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" }] }];
    local.rounds = [{ ...baseRound, status: "in-progress" as const, holes: Array.from({ length: 9 }, (_, index) => ({ holeNumber: index + 1, score: 5, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" })) }];
    const merged = mergeAppData(local, cloud)!;
    expect(merged.rounds[0].status).toBe("archived");
    expect(merged.rounds[0].totalScore).toBe(84);
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
