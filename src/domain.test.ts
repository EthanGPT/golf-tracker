import { describe, expect, it } from "vitest";
import type { RoundHole } from "./domain";
import {
  CLUBS,
  DISTANCE_CLUBS,
  SEED_READINGS,
  categoryCounts,
  clubSummary,
  isTeeTargetReachable,
  caddiePlan,
  caddieDecision,
  resolveTeeDecision,
  adaptiveCaddieDecision,
  isValidGolfShotContext,
  teeRationale,
  convertMetres,
  median,
  recommendation,
  roundTotal,
  seedData,
  roundHandicapIndex,
  getOnCourseClubAdjustment,
  formMapCategoryStats,
  normalizedRoundScore,
  roundProgressInsights,
  localDateString,
  ensurePuttingShot,
  appendHoleShot,
  updateHoleShot,
  buildShotEvidence,
  getContextEvidence,
  shotLearningInsights,
  enrichShotWithContext,
} from "./domain";

describe("local calendar dates", () => {
  it("formats midnight in the user's local calendar rather than UTC", () => {
    const localMidnight = new Date(2026, 8, 22, 0, 30);
    expect(localDateString(localMidnight)).toBe("2026-09-22");
  });
});

describe("personal shot learning evidence", () => {
  const learningRound = (id: string, club: "7i" | "8i", note: string, date = "2026-09-20") => ({
    id, date, courseName: "Test", courseId: "test-course", tee: "white", overallNote: "", status: "archived" as const,
    holes: [{ holeNumber: 4, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "", shots: [{ id: `${id}-shot`, phase: "approach" as const, club, startDistanceToTargetM: 145, endDistanceToTargetM: note === "Hit green" ? 8 : 95, startLie: "fairway" as const, outcomes: [{ outcome: note === "Hit green" ? "good" as const : "bad" as const, note }] }] }],
  });

  it("preserves structured shot context as derived evidence", () => {
    const evidence = buildShotEvidence([learningRound("a", "8i", "Too short")]);
    expect(evidence[0]).toMatchObject({ startDistanceM: 145, endDistanceM: 95, startLie: "fairway", negative: true });
  });

  it("matches comparable distance and lie while rejecting distant context", () => {
    const rounds = [learningRound("a", "7i", "Hit green")];
    expect(getContextEvidence(rounds, { phase: "approach", club: "7i", distanceM: 150, lie: "fairway" })).toHaveLength(1);
    expect(getContextEvidence(rounds, { phase: "approach", club: "7i", distanceM: 210, lie: "fairway" })).toHaveLength(0);
    expect(getContextEvidence(rounds, { phase: "approach", club: "7i", distanceM: 150, lie: "bunker" })[0].weight).toBeLessThan(1);
  });

  it("excludes legacy evidence without a start distance from distance-specific queries", () => {
    const legacy = learningRound("legacy", "7i", "Hit green");
    Object.assign(legacy.holes[0].shots![0], { startDistanceToTargetM: undefined });
    expect(getContextEvidence([legacy], { phase: "approach", club: "7i", distanceM: 145, lie: "fairway" })).toHaveLength(0);
  });

  it("enriches a first tee shot from a trusted mapped tee origin", () => {
    const start = { latitude: 0, longitude: 0, capturedAt: "2026-09-20T08:00:00Z" };
    const end = { latitude: 0, longitude: 0.001, capturedAt: "2026-09-20T08:20:00Z" };
    const shot = enrichShotWithContext({ id: "tee", phase: "tee", club: "3W" }, { position: start, distanceToTargetM: 200, lie: "tee" }, { position: end, distanceToTargetM: 40 }, 111);
    expect(shot).toMatchObject({ startDistanceToTargetM: 200, endDistanceToTargetM: 40, startLie: "tee", actualDistanceM: 111, startPosition: start, endPosition: end });
  });

  it("only surfaces learned findings after repeated evidence", () => {
    expect(shotLearningInsights([learningRound("a", "8i", "Too short")])).toHaveLength(0);
    const findings = shotLearningInsights([
      learningRound("a", "8i", "Too short"),
      learningRound("b", "8i", "Too short"),
      learningRound("c", "8i", "Too short"),
    ]);
    expect(findings[0]?.text).toContain("8i");
  });

  it("does not let one same-hole tee result override the baseline", () => {
    const readings = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `dr-${i}`, club: "Dr" as const, distanceMetres: 220, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-20", createdAt: `2026-09-${10 + i}` })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `3w-${i}`, club: "3W" as const, distanceMetres: 200, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-20", createdAt: `2026-09-${10 + i}` })),
    ];
    const round = { id: "one", date: "2026-09-20", courseName: "Test", courseId: "test-course", tee: "white", overallNote: "", status: "archived" as const, holes: [{ holeNumber: 4, score: 4, focusCategory: "Tee shot" as const, wentRight: "", wentWrong: "", shots: [{ id: "s", phase: "tee" as const, club: "3W" as const, startDistanceToTargetM: 200, outcomes: [{ outcome: "good" as const, note: "Good direction" }] }] }] };
    const result = resolveTeeDecision(readings, 4, 200, [round], { courseId: "test-course", holeNumber: 4, tee: "white" });
    expect(result?.club).toBe("Dr");
  });

  it("keeps tee plan, sequence, and explanation aligned after repeated learned results", () => {
    const readings = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `dr-${i}`, club: "Dr" as const, distanceMetres: 220, mishit: false, playable: false, severeMiss: true, sessionDate: "2026-09-20", createdAt: `2026-09-${10 + i}` })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `3w-${i}`, club: "3W" as const, distanceMetres: 200, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-20", createdAt: `2026-09-${10 + i}` })),
    ];
    const rounds = Array.from({ length: 3 }, (_, i) => ({ id: `r-${i}`, date: "2026-09-20", courseName: "Test", courseId: "test-course", tee: "white", overallNote: "", status: "archived" as const, holes: [{ holeNumber: 4, score: 4, focusCategory: "Tee shot" as const, wentRight: "", wentWrong: "", shots: [{ id: `s-${i}`, phase: "tee" as const, club: "3W" as const, startDistanceToTargetM: 200, outcomes: [{ outcome: "good" as const, note: "Good direction" }] }] }] }));
    const result = resolveTeeDecision(readings, 4, 200, rounds, { courseId: "test-course", holeNumber: 4, tee: "white" });
    expect(result?.club).toBe("3W");
    expect(result?.plan.tee.club).toBe("3W");
    expect(result?.plan.sequence[0]?.club).toBe("3W");
    expect(result?.explanation?.primaryClub).toBe("3W");
  });
});

describe("explicit putting transition", () => {
  it("adds one Putter shot without changing other shot data", () => {
    const approach = { id: "a", phase: "approach" as const, club: "7i" as const, outcome: "good" as const, note: "Green" };
    const shots = ensurePuttingShot([approach]);
    expect(shots).toHaveLength(2);
    expect(shots.find((shot) => shot.phase === "putting")).toMatchObject({ club: "Putter" });
    expect(shots[0]).toEqual(approach);
  });

  it("does not duplicate or overwrite an existing putting shot", () => {
    const putting = { id: "p", phase: "putting" as const, club: "Putter" as const, outcomes: [{ outcome: "good" as const, note: "Good speed" }] };
    const shots = ensurePuttingShot([putting]);
    expect(shots).toEqual([putting]);
  });
});

describe("chronological repeated hole shots", () => {
  it("keeps repeated phases ordered and independently editable", () => {
    const first = appendHoleShot([], "approach", "6i");
    const withSecond = appendHoleShot(first, "approach", "PW");
    const edited = updateHoleShot(withSecond, withSecond[1].id, {
      outcomes: [{ outcome: "bad", note: "Thin" }],
    });
    expect(edited.map((shot) => shot.club)).toEqual(["6i", "PW"]);
    expect(edited[0].outcomes).toBeUndefined();
    expect(edited[1].outcomes?.[0].note).toBe("Thin");
  });

  it("supports repeated short-game shots without collapsing outcomes", () => {
    const shots = appendHoleShot(appendHoleShot([], "short-game", "SW"), "short-game", "PW");
    const updated = updateHoleShot(shots, shots[0].id, { outcome: "good", note: "Good chip on" });
    expect(updated).toHaveLength(2);
    expect(updated[0].outcome).toBe("good");
    expect(updated[1].outcome).toBeUndefined();
  });
});

describe("distance calculations", () => {
  const data = seedData();
  it("calculates the median and excludes mishits", () => {
    expect(median([1, 5, 3])).toBe(3);
    const readings = [
      ...data.readings,
      {
        id: "mishit",
        club: "6i" as const,
        distanceMetres: 200,
        mishit: true,
        sessionDate: "2026-09-14",
        createdAt: "2026-09-15",
        severeMiss: true,
      },
    ];
    expect(clubSummary(readings, "6i").typical).toBe(150);
    expect(clubSummary(readings, "6i").max).toBe(160);
  });

  it("fits tee targets to observed usable carry ranges", () => {
    const readings = [142, 148, 160].map((distanceMetres, index) => ({
      id: `range-${index}`,
      club: "6i" as const,
      distanceMetres,
      mishit: false,
      sessionDate: "2026-09-14",
      createdAt: `2026-09-1${index + 1}`,
      severeMiss: false,
    }));
    expect(isTeeTargetReachable(readings, "6i", 156)).toBe(true);
    expect(isTeeTargetReachable(readings, "6i", 168)).toBe(false);
    expect(isTeeTargetReachable(readings, "6i", 248)).toBe(false);
    expect(isTeeTargetReachable(readings.slice(0, 2), "6i", 160)).toBe(true);
  });

  it("does not let severe-miss distances expand tee carry fit", () => {
    const readings = [
      ...[142, 148, 150].map((distanceMetres, index) => ({ id: `good-${index}`, club: "6i" as const, distanceMetres, mishit: false, sessionDate: "2026-09-14", createdAt: `2026-09-1${index + 1}`, severeMiss: false })),
      { id: "severe", club: "6i" as const, distanceMetres: 220, mishit: false, sessionDate: "2026-09-14", createdAt: "2026-09-20", severeMiss: true },
    ];
    expect(clubSummary(readings, "6i").max).toBe(150);
    expect(isTeeTargetReachable(readings, "6i", 200)).toBe(false);
  });

  it("explains the existing caddie plan from stored club metrics", () => {
    const decision = caddieDecision(data.readings, 4, 400);
    const plan = caddiePlan(data.readings, 4, 400);
    expect(decision?.plan).toEqual(plan?.sequence.map((item) => item.club));
    expect(
      decision?.reasons.some((reason) => reason.key === "primary-carry"),
    ).toBe(true);
    expect(
      decision?.reasons.some((reason) => reason.key === "primary-playable"),
    ).toBe(true);
  });
  it.each([
    ["6i", 150],
    ["7i", 140],
    ["8i", 136],
    ["9i", 114],
    ["PW", 95],
    ["SW", 85],
  ] as const)("%s seed data has a %sm median", (club, expected) =>
    expect(clubSummary(data.readings, club).typical).toBe(expected),
  );
  it("converts metres to yards only for display", () =>
    expect(convertMetres(100, "yards")).toBe(109));
  it("keeps empty clubs empty in bag order", () => {
    expect(CLUBS.slice(0, 3)).toEqual(["Dr", "3W", "4W-Hybrid"]);
    expect(
      CLUBS.slice(0, 3).every(
        (club) => !clubSummary(data.readings, club).typical,
      ),
    ).toBe(true);
  });
  it("keeps the on-course distance list in bag order", () =>
    expect(DISTANCE_CLUBS).toEqual([
      "Dr",
      "3W",
      "4W-Hybrid",
      "6i",
      "7i",
      "8i",
      "9i",
      "PW",
      "SW",
    ]));
  it("contains the requested seed readings", () =>
    expect(SEED_READINGS).toHaveLength(6));
  it("keeps tee-only woods and driver out of fairway sequencing", () => {
    const readings = (["Dr", "3W", "4W-Hybrid", "7i", "8i"] as const).flatMap(
      (club, clubIndex) =>
        Array.from({ length: 5 }, (_, index) => ({
          id: `${club}-${index}`,
          club,
          distanceMetres:
            club === "Dr"
              ? 210
              : club === "3W"
                ? 190
                : club === "4W-Hybrid"
                  ? 175
                  : club === "7i"
                    ? 140
                    : 130,
          mishit: false,
          playable: club !== "3W",
          severeMiss: false,
          sessionDate: "2026-09-19",
          createdAt: `2026-09-19T00:0${clubIndex}:${index}Z`,
        })),
    );
    const plan = caddiePlan(readings, 4, 380);
    expect(plan?.sequence.slice(1).map((shot) => shot.club)).not.toContain(
      "Dr",
    );
    expect(plan?.sequence.slice(1).map((shot) => shot.club)).not.toContain(
      "3W",
    );
  });
});

describe("round handicap context", () => {
  it("captures the latest handicap for a new round", () => expect(roundHandicapIndex(12.4)).toBe(12.4));
  it("preserves a stored handicap when Settings changes", () => expect(roundHandicapIndex(8.1, 12.4)).toBe(12.4));
  it("uses latest handicap only as an edit fallback for missing history", () => expect(roundHandicapIndex(8.1, undefined)).toBe(8.1));
});

describe("adaptive live caddie", () => {
  const readings = [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `6i-${index}`, club: "6i", distanceMetres: 150, mishit: false,
      playable: true, severeMiss: false, sessionDate: "2026-09-14", createdAt: `2026-09-1${index}`,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `dr-${index}`, club: "Dr", distanceMetres: 190, mishit: false,
      playable: index < 7, severeMiss: index >= 7, sessionDate: "2026-09-14", createdAt: `2026-08-1${index}`,
    })),
  ];

  it("can select an iron from the tee when its risk profile is better", () => {
    const result = adaptiveCaddieDecision(readings, ["Dr", "6i"], 150, 150, "tee");
    expect(result.status).toBe("recommended");
    expect(result.recommendedClub).toBe("6i");
  });

  it("resolves the same iron for every Par 3 tee surface", () => {
    const resolved = resolveTeeDecision(readings, 3, 150);
    expect(resolved?.club).toBe("6i");
    expect(resolved?.plan.sequence[0]?.club).toBe("6i");
    expect(resolved?.explanation?.primaryClub).toBe("6i");
  });

  it("allows the pre-hole plan to select an iron off the tee", () => {
    const plan = caddiePlan(readings, 4, 300);
    expect(plan?.tee.club).toBe("6i");
  });

  it("uses labelled, thresholded tee rationale without overstating tiny differences", () => {
    const comparable = [
      ...readings,
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `hybrid-${index}`, club: "4W-Hybrid", distanceMetres: 145, mishit: false,
        playable: index === 0, severeMiss: index !== 0, sessionDate: "2026-09-14", createdAt: `2026-07-1${index}`,
      })),
    ];
    expect(teeRationale(comparable, "6i")).toContain("Similar distance");
    expect(teeRationale(comparable, "6i")).toContain("lower penalty risk");
    const tinyDifference = comparable.map((reading) =>
      reading.club === "4W-Hybrid" ? { ...reading, playable: true, severeMiss: false, distanceMetres: 151 } : reading,
    );
    expect(teeRationale(tinyDifference, "6i")).toBe("Best risk/reliability fit off this tee.");
  });

  it("requires a lie and excludes driver from fairway", () => {
    expect(adaptiveCaddieDecision(readings, ["Dr", "6i"], 150, 150, undefined).status).toBe("insufficient-data");
    const result = adaptiveCaddieDecision(readings, ["Dr", "6i"], 150, 150, "fairway");
    expect(result.candidates.find((candidate) => candidate.club === "Dr")?.excluded).toBe(true);
  });

  it("returns recovery behavior instead of normal green-distance selection", () => {
    const result = adaptiveCaddieDecision(readings, ["6i"], 160, 160, "recovery");
    expect(result.status).toBe("recovery-required");
    expect(result.recommendedClub).toBeUndefined();
    expect(result.candidates).toHaveLength(0);
    expect(result.reasons[0].value).toContain("safety");
  });

  it("does not fabricate a precise club for a short recovery shot", () => {
    const result = adaptiveCaddieDecision(readings, ["6i", "PW"], 20, 20, "recovery");
    expect(result.status).toBe("recovery-required");
    expect(result.recommendedClub).toBeUndefined();
    expect(result.reasons[0].value).toContain("getting back into play");
  });


  it("uses normal scoring for legitimate distances and wedge logic for short game", () => {
    expect(adaptiveCaddieDecision(readings, ["6i"], 150, 150, "fairway", 450).status).toBe("recommended");
    const wedgeReadings = [...readings, { id: "pw", club: "PW", distanceMetres: 95, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-19", createdAt: "2026-09-19" }];
    expect(adaptiveCaddieDecision(wedgeReadings, ["PW"], 27, 27, "fairway", 450).recommendedClub).toBe("PW");
  });

  it("prefers SW for chip-type greenside shots and PW for longer pitches", () => {
    const wedges = [
      ...readings,
      ...Array.from({ length: 10 }, (_, index) => ({ id: `sw-${index}`, club: "SW", distanceMetres: 55, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-19", createdAt: `2026-09-2${index}` })),
      { id: "pw", club: "PW", distanceMetres: 95, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-19", createdAt: "2026-09-19" },
    ];
    expect(adaptiveCaddieDecision(wedges, ["PW", "SW"], 20, 20, "rough").recommendedClub).toBe("SW");
    expect(adaptiveCaddieDecision(wedges, ["PW", "SW"], 70, 70, "rough").recommendedClub).toBe("PW");
  });

  it("allows strong personal greenside evidence to override the default", () => {
    const wedges = [
      ...Array.from({ length: 10 }, (_, index) => ({ id: `sw-good-${index}`, club: "SW", distanceMetres: 55, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-19", createdAt: `2026-09-2${index}` })),
      ...Array.from({ length: 10 }, (_, index) => ({ id: `pw-bad-${index}`, club: "PW", distanceMetres: 95, mishit: false, playable: false, severeMiss: true, sessionDate: "2026-09-19", createdAt: `2026-08-1${index}` })),
    ];
    expect(adaptiveCaddieDecision(wedges, ["PW", "SW"], 70, 70, "rough").recommendedClub).toBe("SW");
  });

  it("never selects a long club in greenside context", () => {
    const result = adaptiveCaddieDecision(readings, ["Dr", "6i", "PW", "SW"], 20, 20, "bunker");
    expect(["Dr", "6i", "7i", "8i", "9i", "3W", "4W-Hybrid"]).not.toContain(result.recommendedClub);
  });

  it.each(["fairway", "recovery", "rough", "bunker"] as const)("uses the same safe fallback for invalid %s location", (lie) => {
    const result = adaptiveCaddieDecision(readings, ["6i", "PW"], 5439, 6309, lie, 450);
    expect(result.status).toBe("invalid-location");
    expect(result.recommendedClub).toBe("6i");
    expect(result.reasons[0].value).toContain("outside the playable hole area");
  });

  it("rejects gross GPS errors without rejecting legitimate long holes", () => {
    expect(isValidGolfShotContext(6309, 450)).toBe(false);
    expect(isValidGolfShotContext(500, 500)).toBe(true);
    expect(isValidGolfShotContext(150, 450, 300)).toBe(false);
  });

  const evidenceRound = (notes: string[], actualDistanceM?: number) => ({
    id: crypto.randomUUID(), date: "2026-09-19", courseName: "Test", overallNote: "", status: "archived" as const,
    holes: [{ holeNumber: 1, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "", shots: [{ id: crypto.randomUUID(), phase: "approach" as const, club: "7i", actualDistanceM, outcomes: notes.map((note) => ({ outcome: "bad" as const, note })) }] }],
  });
  it("ignores fewer than five subjective observations", () => expect(getOnCourseClubAdjustment([evidenceRound(["Short"]), evidenceRound(["Short"])], "7i", 140).adjustmentM).toBe(0));
  it("caps subjective short/long modifiers and treats good distance as stabilizing evidence", () => {
    expect(getOnCourseClubAdjustment(Array.from({ length: 6 }, () => evidenceRound(["Short"])), "7i", 140).adjustmentM).toBe(3);
    expect(getOnCourseClubAdjustment(Array.from({ length: 10 }, () => evidenceRound(["Long"])), "7i", 140).adjustmentM).toBe(-6);
    expect(getOnCourseClubAdjustment(Array.from({ length: 3 }, () => evidenceRound(["Short"])).concat(Array.from({ length: 3 }, () => evidenceRound(["Good distance"]))), "7i", 140).adjustmentM).toBe(0);
  });
  it("uses actual distance as the authoritative signal and ignores tiny samples", () => {
    expect(getOnCourseClubAdjustment(Array.from({ length: 4 }, () => evidenceRound([], 130)), "7i", 140).adjustmentM).toBe(0);
    expect(getOnCourseClubAdjustment(Array.from({ length: 5 }, () => evidenceRound(["Short"], 145)), "7i", 140).adjustmentM).toBe(-5);
  });
});

describe("Form Map observation semantics", () => {
  const stats = (hole: RoundHole) => formMapCategoryStats([{ id: "r", date: "2026-09-19", courseName: "Test", overallNote: "", status: "archived", holes: [hole] }]);
  const base = { holeNumber: 1, score: 4, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" };
  it("counts positive putting and short-game evidence without trouble", () => {
    expect(stats({ ...base, focusCategory: "Putting", shots: [{ id: "p", phase: "putting", club: "Putter", outcomes: [{ outcome: "good", note: "Good speed" }] }] }).find((item) => item.category === "Putting")).toMatchObject({ observationCount: 1, troubleCount: 0 });
    expect(stats({ ...base, focusCategory: "Short game", shots: [{ id: "s", phase: "short-game", club: "SW", outcome: "good", note: "Good chip on" }] }).find((item) => item.category === "Short game")).toMatchObject({ observationCount: 1, troubleCount: 0 });
  });
  it("counts bad and legacy evidence as trouble, including multi-outcomes", () => {
    expect(stats({ ...base, focusCategory: "Putting", shots: [{ id: "p", phase: "putting", club: "Putter", outcomes: [{ outcome: "good", note: "Good speed" }, { outcome: "bad", note: "Three-putt" }] }] }).find((item) => item.category === "Putting")).toMatchObject({ observationCount: 1, troubleCount: 1 });
    expect(stats({ ...base, tags: [{ category: "chip", outcome: "Chunked", type: "went-wrong" }] }).find((item) => item.category === "Short game")).toMatchObject({ observationCount: 1, troubleCount: 1 });
  });
  it("does not treat course-management focus as a structured Form Map category", () => {
    expect(stats({ ...base, focusCategory: "Course management" }).find((item) => item.category === "Course management")).toBeUndefined();
    expect(stats(base).find((item) => item.category === "Putting")).toMatchObject({ observationCount: 0, troubleCount: 0 });
  });
  it("does not let trouble in one phase mark another phase as trouble", () => {
    const result = stats({ ...base, focusCategory: "Tee shot", shots: [
      { id: "t", phase: "tee", club: "Dr", outcome: "good", note: "Good contact" },
      { id: "p", phase: "putting", club: "Putter", outcome: "bad", note: "Three-putt" },
    ] });
    expect(result.find((item) => item.category === "Tee shot")).toMatchObject({ observationCount: 1, troubleCount: 0 });
    expect(result.find((item) => item.category === "Putting")).toMatchObject({ observationCount: 1, troubleCount: 1 });
  });
});

describe("mixed-length round normalization", () => {
  it("converts an 18-hole score to a comparable 9-hole equivalent", () => {
    const round = { id: "r", date: "2026-09-19", courseName: "Test", overallNote: "", status: "archived" as const, totalScore: 90, holes: Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, score: 5, focusCategory: "Approach" as const, wentRight: "", wentWrong: "" })) };
    expect(normalizedRoundScore(round)).toBe(45);
  });
});

describe("round progression insights", () => {
  const makeRound = (date: string, category: "Tee shot" | "Approach", trouble: number, holes = 9) => ({
    id: date, date, courseName: "Test", overallNote: "", status: "archived" as const,
    holes: Array.from({ length: holes }, (_, index) => ({ holeNumber: index + 1, score: 4, focusCategory: category, wentRight: "", wentWrong: index < trouble ? "Trouble" : "", tags: [] })),
  });
  it("detects improving, worsening, stable, and insufficient data directions", () => {
    const improving = roundProgressInsights([makeRound("2026-01-01", "Tee shot", 5), makeRound("2026-01-02", "Tee shot", 5), makeRound("2026-01-03", "Tee shot", 1), makeRound("2026-01-04", "Tee shot", 1)]).find((item) => item.label === "Tee shot");
    expect(improving?.direction).toBe("improving");
    const worsening = roundProgressInsights([makeRound("2026-01-01", "Approach", 0), makeRound("2026-01-02", "Approach", 0), makeRound("2026-01-03", "Approach", 5), makeRound("2026-01-04", "Approach", 5)]).find((item) => item.label === "Approach");
    expect(worsening?.direction).toBe("worsening");
    const stable = roundProgressInsights([makeRound("2026-01-01", "Tee shot", 2), makeRound("2026-01-02", "Tee shot", 2), makeRound("2026-01-03", "Tee shot", 2), makeRound("2026-01-04", "Tee shot", 2)]).find((item) => item.label === "Tee shot");
    expect(stable?.direction).toBe("stable");
    expect(roundProgressInsights([makeRound("2026-01-01", "Tee shot", 2), makeRound("2026-01-02", "Tee shot", 2)]).find((item) => item.label === "Tee shot")?.direction).toBe("insufficient-data");
  });
  it("normalizes 9 and 18-hole windows by holes played", () => {
    const insight = roundProgressInsights([makeRound("2026-01-01", "Tee shot", 6, 18), makeRound("2026-01-02", "Tee shot", 6, 18), makeRound("2026-01-03", "Tee shot", 1, 9), makeRound("2026-01-04", "Tee shot", 1, 9)]).find((item) => item.label === "Tee shot");
    expect(insight?.direction).toBe("improving");
  });
});

describe("round feedback", () => {
  const rounds = [
    {
      id: "r1",
      date: "2026-09-15",
      courseName: "Hermanus Golf Club",
      totalScore: 45,
      overallNote: "",
      status: "archived" as const,
      holes: [
        {
          holeNumber: 1,
          score: 5,
          focusCategory: "Approach" as const,
          wentRight: "Good tempo",
          wentWrong: "Missed green",
          tags: [
            {
              category: "iron" as const,
              outcome: "Short",
              type: "went-wrong" as const,
            },
          ],
        },
      ],
    },
  ];
  it("totals scores", () => expect(roundTotal(rounds[0])).toBe(5));
  it("counts problem categories and explains recommendations", () => {
    expect(categoryCounts(rounds).Approach).toBe(1);
    expect(recommendation(rounds).text).toContain(
      "Not enough repeated feedback",
    );
  });
});
