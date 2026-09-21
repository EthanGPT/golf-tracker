import { describe, expect, it } from "vitest";
import {
  calculateShotWind,
  calculateWindAdjustedDistance,
  formatShotWind,
  WEATHER_CACHE_TTL_MS,
  getCourseWeather,
  resolveWindRelativeToShot,
  windDirectionLabel,
} from "./weather";

describe("weather context", () => {
  it("converts wind degrees to compact compass labels", () => {
    expect(windDirectionLabel(0)).toBe("N");
    expect(windDirectionLabel(45)).toBe("NE");
    expect(windDirectionLabel(180)).toBe("S");
    expect(windDirectionLabel(315)).toBe("NW");
  });

  it("treats weather direction as where wind comes from", () => {
    const headwind = calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 0 }, 0)!;
    expect(headwind.headwindKmh).toBeCloseTo(20);
    expect(headwind.tailwindKmh).toBeCloseTo(0);
    expect(headwind.crosswindKmh).toBeCloseTo(0);

    const tailwind = calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 180 }, 0)!;
    expect(tailwind.tailwindKmh).toBeCloseTo(20);
    expect(tailwind.headwindKmh).toBeCloseTo(0);
  });

  it("resolves wind from its meteorological direction against shot travel", () => {
    expect(resolveWindRelativeToShot({ windSpeed: 20, windFromDegrees: 225, shotBearingDegrees: 45 }).tailwindKmh).toBeCloseTo(20);
    expect(resolveWindRelativeToShot({ windSpeed: 20, windFromDegrees: 45, shotBearingDegrees: 45 }).headwindKmh).toBeCloseTo(20);
    expect(resolveWindRelativeToShot({ windSpeed: 20, windFromDegrees: 270, shotBearingDegrees: 0 }).crosswindDirection).toBe("left-to-right");
  });

  it("calculates signed crosswind relative to shot travel", () => {
    const leftToRight = calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 270 }, 0)!;
    expect(leftToRight.crosswindKmh).toBeCloseTo(20);
    expect(leftToRight.crosswindDirection).toBe("left-to-right");

    const rightToLeft = calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 90 }, 0)!;
    expect(rightToLeft.crosswindKmh).toBeCloseTo(20);
    expect(rightToLeft.crosswindDirection).toBe("right-to-left");
  });

  it("handles diagonal wind, bearing wrap and quiet display components", () => {
    const diagonal = calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 315 }, 90)!;
    expect(diagonal.tailwindKmh).toBeCloseTo(14.142, 2);
    expect(diagonal.crosswindKmh).toBeCloseTo(14.142, 2);
    expect(calculateShotWind({ windSpeedKmh: 4, windDirectionDeg: 359 }, 1)?.windFromDeg).toBe(359);
    expect(formatShotWind(calculateShotWind({ windSpeedKmh: 1, windDirectionDeg: 0 }, 0)!)).toBe("");
    expect(calculateShotWind(undefined, 0)).toBeUndefined();
  });

  it("calculates conservative asymmetric effective distance", () => {
    const headwind = calculateWindAdjustedDistance(
      150,
      calculateShotWind({ windSpeedKmh: 10, windDirectionDeg: 0 }, 0),
    )!;
    expect(headwind.effectiveDistanceM).toBeCloseTo(162);
    expect(headwind.adjustmentPercent).toBeCloseTo(0.08);

    const tailwind = calculateWindAdjustedDistance(
      150,
      calculateShotWind({ windSpeedKmh: 10, windDirectionDeg: 180 }, 0),
    )!;
    expect(tailwind.effectiveDistanceM).toBeCloseTo(142.5);
    expect(tailwind.adjustmentPercent).toBeCloseTo(-0.05);
  });

  it("ignores crosswind, light along wind, and caps extreme adjustments", () => {
    const crosswind = calculateWindAdjustedDistance(
      150,
      calculateShotWind({ windSpeedKmh: 20, windDirectionDeg: 270 }, 0),
    )!;
    expect(crosswind.effectiveDistanceM).toBe(150);
    expect(crosswind.appliedComponent).toBe("none");

    const light = calculateWindAdjustedDistance(
      150,
      calculateShotWind({ windSpeedKmh: 1, windDirectionDeg: 0 }, 0),
    )!;
    expect(light.effectiveDistanceM).toBe(150);

    const capped = calculateWindAdjustedDistance(
      150,
      calculateShotWind({ windSpeedKmh: 100, windDirectionDeg: 0 }, 0),
    )!;
    expect(capped.effectiveDistanceM).toBe(195);
    expect(capped.capApplied).toBe(true);
  });

  it("returns no adjustment without weather", () => {
    expect(calculateWindAdjustedDistance(150, undefined)).toBeUndefined();
  });

  it("reuses fresh course cache without requesting again", async () => {
    let calls = 0;
    const provider = {
      getCurrentWeather: async () => {
        calls += 1;
        return { windSpeedKmh: 18, windDirectionDeg: 225, temperatureC: 17 };
      },
    };
    await getCourseWeather(
      "test-course",
      { latitude: 1, longitude: 2 },
      provider,
    );
    await getCourseWeather(
      "test-course",
      { latitude: 1, longitude: 2 },
      provider,
    );
    expect(calls).toBe(1);
    expect(WEATHER_CACHE_TTL_MS).toBe(25 * 60 * 1000);
  });

  it("returns stale cached weather when refresh fails", async () => {
    await getCourseWeather(
      "stale",
      { latitude: 1, longitude: 2 },
      { getCurrentWeather: async () => ({ temperatureC: 17 }) },
    );
    const result = await getCourseWeather(
      "stale",
      { latitude: 1, longitude: 2 },
      {
        getCurrentWeather: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(result?.temperatureC).toBe(17);
  });
});
