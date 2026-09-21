import { beforeEach, describe, expect, it } from "vitest";
import { seedData } from "./domain";
import {
  isSyncPending,
  loadLocalData,
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
