import { describe, expect, it } from "vitest";
import {
  CLUBS,
  DISTANCE_CLUBS,
  SEED_READINGS,
  categoryCounts,
  clubSummary,
  caddiePlan,
  convertMetres,
  median,
  recommendation,
  roundTotal,
  seedData,
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
