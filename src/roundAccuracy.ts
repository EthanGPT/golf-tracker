import type { Round, RoundHole, HoleShot } from "./domain";

type ParForHole = (round: Round, hole: RoundHole) => number;

function outcomesFor(shot: HoleShot) {
  return shot.outcomes || (shot.note ? [{ outcome: shot.outcome || "bad", note: shot.note }] : []);
}

/** Fairway hit rate using all played par-4/5 holes as possible fairways. */
export function fairwayAccuracyStats(rounds: Round[], parForHole: ParForHole) {
  let fairways = 0;
  let possibleFairways = 0;
  let trackedTeeShots = 0;

  rounds.forEach((round) => round.holes
    .filter((hole) => hole.score > 0)
    .forEach((hole) => {
      const par = parForHole(round, hole);
      if (par !== 4 && par !== 5) return;
      possibleFairways += 1;

      const tee = (hole.shots || []).find((shot) => shot.phase === "tee");
      const teeOutcomes = tee ? outcomesFor(tee) : [];
      if (!teeOutcomes.length) return;

      trackedTeeShots += 1;
      if (teeOutcomes.some((outcome) => outcome.outcome === "good" && (outcome.note === "Fairway found" || outcome.note === "Hit green"))) {
        fairways += 1;
      }
    }));

  return {
    fir: possibleFairways ? Math.round((fairways / possibleFairways) * 100) : null,
    attempts: possibleFairways,
    fairways,
    trackedTeeShots,
  };
}

/** GIR using the standard par-minus-two rule, excluding partial shot records. */
export function greenInRegulationStats(rounds: Round[], parForHole: ParForHole) {
  let greens = 0;
  let attempts = 0;

  rounds.forEach((round) => round.holes
    .filter((hole) => hole.score > 0)
    .forEach((hole) => {
      const regulationStrokes = Math.max(0, parForHole(round, hole) - 2);
      const scoringShots = (hole.shots || []).filter((shot) => shot.phase !== "putting");
      const regulationShots = scoringShots.slice(0, regulationStrokes);
      const hit = regulationShots.some((shot) => outcomesFor(shot)
        .some((outcome) => outcome.outcome === "good" && (outcome.note === "Hit green" || outcome.note === "Good chip on")));

      // A partial record cannot establish a GIR miss. It stays out of the
      // denominator until the regulation stroke sequence is recorded.
      if (!hit && scoringShots.length < regulationStrokes) return;
      attempts += 1;
      if (hit) greens += 1;
    }));

  return {
    gir: attempts ? Math.round((greens / attempts) * 100) : null,
    attempts,
    greens,
  };
}

/** Scoring distribution from completed holes, using the course par for each hole. */
export function scoringDistributionStats(rounds: Round[], parForHole: ParForHole) {
  let holes = 0;
  let birdieOrBetter = 0;
  let pars = 0;
  let bogeys = 0;
  let doubleBogeyOrWorse = 0;

  rounds.forEach((round) => round.holes
    .filter((hole) => hole.score > 0)
    .forEach((hole) => {
      const relativeToPar = hole.score - parForHole(round, hole);
      holes += 1;
      if (relativeToPar <= -1) birdieOrBetter += 1;
      else if (relativeToPar === 0) pars += 1;
      else if (relativeToPar === 1) bogeys += 1;
      else doubleBogeyOrWorse += 1;
    }));

  const rate = (count: number) => holes ? Math.round((count / holes) * 100) : null;
  return {
    holes,
    birdieOrBetter,
    pars,
    bogeys,
    doubleBogeyOrWorse,
    birdieOrBetterRate: rate(birdieOrBetter),
    parRate: rate(pars),
    bogeyRate: rate(bogeys),
    doubleBogeyOrWorseRate: rate(doubleBogeyOrWorse),
  };
}
