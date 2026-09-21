import { describe, expect, it } from "vitest";
import {
  CLUBS,
  DISTANCE_CLUBS,
  SEED_READINGS,
  categoryCounts,
  clubSummary,
  isTeeTargetReachable,
  caddiePlan,
  caddieDecision,
  adaptiveCaddieDecision,
  isValidGolfShotContext,
  teeRationale,
  convertMetres,
  median,
  recommendation,
  roundTotal,
  seedData,
  roundHandicapIndex,
} from "./domain";

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
    expect(result.reasons[0].value).toContain("safety");
  });

  it("uses normal scoring for legitimate distances and wedge logic for short game", () => {
    expect(adaptiveCaddieDecision(readings, ["6i"], 150, 150, "fairway", 450).status).toBe("recommended");
    const wedgeReadings = [...readings, { id: "pw", club: "PW", distanceMetres: 95, mishit: false, playable: true, severeMiss: false, sessionDate: "2026-09-19", createdAt: "2026-09-19" }];
    expect(adaptiveCaddieDecision(wedgeReadings, ["PW"], 27, 27, "fairway", 450).recommendedClub).toBe("PW");
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
