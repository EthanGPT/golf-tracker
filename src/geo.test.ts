import { describe, expect, it } from "vitest";
import { bearingBetween, deriveLearnedTeeOrigin, distanceBetweenMeters } from "./geo";

describe("geographic helpers", () => {
  it("calculates distance between coordinates", () => {
    expect(
      distanceBetweenMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111195, -2);
  });

  it("calculates and normalizes bearing", () => {
    expect(
      bearingBetween(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
      ),
    ).toBeCloseTo(0);
    expect(
      bearingBetween(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: -1 },
      ),
    ).toBeCloseTo(270);
    expect(
      bearingBetween(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeGreaterThanOrEqual(0);
    expect(
      bearingBetween(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeLessThan(360);
  });

  it("promotes only repeated, tight, tee-specific GPS observations", () => {
    const base = { courseId: "hermanus-golf-club", holeNumber: 3, tee: "white", accuracyM: 8, capturedAt: "2026-01-01", source: "live-gps" as const };
    const observations = [
      { ...base, latitude: 0, longitude: 0 },
      { ...base, latitude: 0.00002, longitude: 0.00001 },
      { ...base, latitude: -0.00001, longitude: 0.00001 },
    ];
    expect(deriveLearnedTeeOrigin(observations)?.sampleCount).toBe(3);
    expect(deriveLearnedTeeOrigin(observations)?.confidence).toBe("medium");
    expect(deriveLearnedTeeOrigin(observations.slice(0, 2))).toBeUndefined();
    expect(deriveLearnedTeeOrigin(observations.map((item, index) => index === 2 ? { ...item, latitude: 0.001 } : item))).toBeUndefined();
  });
});
