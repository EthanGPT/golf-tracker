import { describe, expect, it } from "vitest";
import { fairwayAccuracyStats, greenInRegulationStats, scoringDistributionStats } from "./roundAccuracy";
import type { Round } from "./domain";

const round = (id: string, fairways: number, attempts = 18): Round => ({
  id,
  date: "2026-10-23",
  courseName: "Test",
  overallNote: "",
  status: "archived",
  holes: Array.from({ length: attempts }, (_, index) => ({
    holeNumber: index + 1,
    score: 4,
    focusCategory: "Tee shot",
    wentRight: "",
    wentWrong: "",
    shots: [{
      id: `${id}-${index}`,
      phase: "tee",
      club: "Dr",
      outcomes: [{ outcome: index < fairways ? "good" : "bad", note: index < fairways ? "Fairway found" : "Miss" }],
    }],
  })),
});

describe("fairway accuracy", () => {
  it("uses recorded eligible tee shots as the denominator across rounds", () => {
    const stats = fairwayAccuracyStats(
      [round("one", 9), round("two", 9)],
      () => 4,
    );

    expect(stats).toMatchObject({ attempts: 36, trackedTeeShots: 36, fairways: 18, fir: 50 });
  });

  it("keeps unrecorded eligible holes in possible fairways", () => {
    const incomplete = round("incomplete", 7, 14);
    incomplete.holes.slice(10).forEach((hole) => { hole.shots = []; });

    expect(fairwayAccuracyStats([incomplete], () => 4)).toMatchObject({
      attempts: 14,
      trackedTeeShots: 10,
      fairways: 7,
      fir: 50,
    });
  });

  it("counts a tee shot finishing on the green as a fairway hit on par 4/5", () => {
    const teeOnGreen = round("green", 0, 1);
    teeOnGreen.holes[0].shots![0].outcomes = [{ outcome: "good", note: "Hit green" }];

    expect(fairwayAccuracyStats([teeOnGreen], () => 4)).toMatchObject({ attempts: 1, fairways: 1, fir: 100 });
  });

  it("uses par minus two strokes for GIR and excludes partial records", () => {
    const par4Partial = round("partial", 0, 1);
    const par4Hit = round("hit", 0, 1);
    par4Hit.holes[0].shots![1] = {
      id: "hit-approach",
      phase: "approach",
      club: "7i",
      outcomes: [{ outcome: "good", note: "Hit green" }],
    };
    const par3Hit = round("par3", 0, 1);
    par3Hit.holes[0].shots![0].outcomes = [{ outcome: "good", note: "Hit green" }];

    expect(greenInRegulationStats([par4Partial], () => 4)).toMatchObject({ attempts: 0, greens: 0, gir: null });
    expect(greenInRegulationStats([par4Hit, par3Hit], (_, hole) => hole.holeNumber === 1 ? 4 : 3)).toMatchObject({ attempts: 2, greens: 2, gir: 100 });
  });

  it("groups completed holes into a usable scoring mix", () => {
    const scoringRound = round("scoring", 0, 4);
    scoringRound.holes[0].score = 3;
    scoringRound.holes[1].score = 4;
    scoringRound.holes[2].score = 5;
    scoringRound.holes[3].score = 6;

    expect(scoringDistributionStats([scoringRound], () => 4)).toMatchObject({
      holes: 4,
      birdieOrBetter: 1,
      pars: 1,
      bogeys: 1,
      doubleBogeyOrWorse: 1,
      birdieOrBetterRate: 25,
      parRate: 25,
      bogeyRate: 25,
      doubleBogeyOrWorseRate: 25,
    });
  });
});
