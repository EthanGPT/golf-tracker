import { describe, expect, it } from "vitest";
import {
  COURSES,
  HERMANUS_COURSE,
  HERMANUS_LOOPS,
  HERMANUS_PARS,
  HERMANUS_RED_DISTANCES,
  HERMANUS_TEE_DISTANCES,
  HERMANUS_WHITE_DISTANCES,
  getCourse,
  getCourseHole,
  getCourseTee,
  getHoleDistance,
  getHoleTarget,
  generateTeeLandingCandidates,
  selectTeeTarget,
  validateCourseGeometry,
} from "./course";
import { cacheCourse } from "./courseIngestion";

describe("course registry", () => {
  it("migrates Hermanus with its verified hole data", () => {
    expect(HERMANUS_COURSE.holes).toHaveLength(27);
    expect(HERMANUS_COURSE.holes.map((hole) => hole.par)).toEqual([
      ...HERMANUS_PARS,
    ]);
    expect(
      HERMANUS_COURSE.holes[0].teeBoxes.map((tee) => tee.distanceM),
    ).toEqual([
      HERMANUS_TEE_DISTANCES.yellow[0],
      HERMANUS_TEE_DISTANCES.white[0],
      HERMANUS_TEE_DISTANCES.red[0],
    ]);
  });

  it("preserves Hermanus loops and all tee distance sets", () => {
    expect(HERMANUS_COURSE.loops?.map((loop) => loop.holeNumbers)).toEqual([
      HERMANUS_LOOPS.east,
      HERMANUS_LOOPS.north,
      HERMANUS_LOOPS.south,
    ]);
    expect(getHoleDistance("hermanus-golf-club", 1, "white")).toBe(
      HERMANUS_WHITE_DISTANCES[0],
    );
    expect(getHoleDistance("hermanus-golf-club", 1, "red")).toBe(
      HERMANUS_RED_DISTANCES[0],
    );
  });

  it("resolves generic tee IDs through the course definition", () => {
    expect(getCourseTee("hermanus-golf-club", "yellow")?.name).toBe("Yellow");
    expect(getCourseHole("hermanus-golf-club", 9)?.teeBoxes).toHaveLength(3);
    expect(Object.keys(COURSES)).toContain("hermanus-golf-club");
  });

  it("prefers a verified landing target and safely falls back for par threes", () => {
    const tee = { latitude: 0, longitude: 0 };
    const explicit = selectTeeTarget({
      teeCoordinate: tee,
      hole: {
        number: 1,
        par: 4,
        teeBoxes: [],
        green: { centre: { latitude: 0, longitude: 0.002 } },
        targets: [{ id: "corner", name: "Fairway corner", position: { latitude: 0, longitude: 0.001 }, kind: "dogleg", source: "survey", verified: true }],
      },
    });
    expect(explicit?.targetName).toBe("Fairway corner");
    const parThree = selectTeeTarget({
      teeCoordinate: tee,
      hole: { number: 2, par: 3, teeBoxes: [], green: { centre: { latitude: 0, longitude: 0.001 } } },
    });
    expect(parThree?.targetName).toBe("Green centre");
    expect(selectTeeTarget({ teeCoordinate: tee, hole: { number: 3, par: 4, teeBoxes: [] } })).toBeUndefined();
  });

  it("fails safely for unknown course and tee IDs", () => {
    expect(getCourse("unknown-course")).toBeUndefined();
    expect(getCourseTee("hermanus-golf-club", "blue")).toBeUndefined();
    expect(getHoleDistance("unknown-course", 1, "white")).toBe(0);
    expect(getHoleDistance("hermanus-golf-club", 1, "blue")).toBe(0);
  });

  it("generates route-following landing candidates without inventing a straight-line route", () => {
    const candidates = generateTeeLandingCandidates({
      teeOrigin: { latitude: 0, longitude: 0 },
      centreline: [
        { latitude: 0, longitude: 0.0005 },
        { latitude: 0.0005, longitude: 0.0005 },
      ],
      greenCentre: { latitude: 0.001, longitude: 0.0005 },
      intervalM: 20,
    });
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0].distanceFromTeeM).toBeGreaterThan(0);
    expect(candidates.at(-1)?.remainingToGreenM).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.bearingDeg >= 0 && candidate.bearingDeg <= 360)).toBe(true);
  });

  it("keeps verified static geometry separate from bundled runtime geometry", () => {
    expect(validateCourseGeometry(HERMANUS_COURSE)).toEqual({
      mappedGreenCentres: 0,
      valid: true,
      duplicateGreenCentres: 0,
    });
    expect(getHoleTarget("hermanus-golf-club", 1)?.targetType).toBe("green-centre");
  });

  it("resolves imported Hermanus geometry through the active runtime target path", () => {
    const storage = new Map<string, string>();
    const previousStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage: Storage }).localStorage = {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    const centre = { latitude: -34.4, longitude: 19.25 };
    cacheCourse({
      course: {
        ...HERMANUS_COURSE,
        holes: HERMANUS_COURSE.holes.map((hole) =>
          hole.number === 1 ? { ...hole, green: { centre } } : hole,
        ),
      },
      provenance: [{ source: "golftraxx-public", confidence: "verified" }],
      providerIds: ["hermanus-golf-club"],
      fetchedAt: new Date().toISOString(),
      schemaVersion: 2,
      geometryCoverage: { greenCentres: 27, expectedHoles: 27 },
    });
    expect(getHoleTarget("hermanus-golf-club", 1)).toEqual({
      position: HERMANUS_COURSE.holes[0].green?.centre || { latitude: -34.40664377931093, longitude: 19.254041135932738 },
      targetType: "green-centre",
    });
    expect(HERMANUS_COURSE.holes[0].green).toBeUndefined();
    (globalThis as { localStorage?: unknown }).localStorage = previousStorage;
  });
});
