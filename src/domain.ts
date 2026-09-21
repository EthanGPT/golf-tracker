export const CLUBS: ClubName[] = [
  "Dr",
  "3W",
  "4W-Hybrid",
  "6i",
  "7i",
  "8i",
  "9i",
  "PW",
  "SW",
] as const;
export const DISTANCE_CLUBS: ClubName[] = [
  "Dr",
  "3W",
  "4W-Hybrid",
  "6i",
  "7i",
  "8i",
  "9i",
  "PW",
  "SW",
] as const;
export type ClubName = string;
export type FocusCategory =
  "Tee shot" | "Approach" | "Short game" | "Putting" | "Course management";
export type RoundCategory = "drive" | "wood" | "iron" | "chip" | "putt";
export type RoundTag = {
  category: RoundCategory;
  outcome: string;
  type: "went-right" | "went-wrong";
};
export type ShotPhase = "tee" | "approach" | "short-game" | "putting";
export type AdaptiveCaddieStatus =
  | "recommended"
  | "insufficient-data"
  | "recovery-required"
  | "no-suitable-club";
export type AdaptiveClubCandidate = {
  club: ClubName;
  carryM?: number;
  distanceGapM?: number;
  distanceFitScore?: number;
  playableRate?: number;
  severeMissRate?: number;
  lieSuitability?: number;
  reliabilityScore?: number;
  utility?: number;
  excluded?: boolean;
  exclusionReason?: string;
};
export type AdaptiveCaddieDecision = {
  recommendedClub?: ClubName;
  targetDistanceM: number;
  effectiveDistanceM: number;
  lie?: ShotLie;
  candidates: AdaptiveClubCandidate[];
  reasons: CaddieReason[];
  status: AdaptiveCaddieStatus;
};
export type HoleShot = {
  id: string;
  phase: ShotPhase;
  club?: ClubName;
  outcome?: "good" | "bad";
  note?: string;
  outcomes?: { outcome: "good" | "bad"; note: string }[];
};
export type CaddieContext = {
  windSpeed?: number;
  windDirection?: number;
  temperature?: number;
  latitude?: number;
  longitude?: number;
};
export type WeatherContext = {
  windSpeedKmh?: number;
  windDirectionDegrees?: number;
  temperatureC?: number;
  fetchedAt?: string;
};
export type Screen =
  "today" | "range" | "distances" | "round" | "progress" | "settings";

export type RangeReading = {
  id: string;
  club: ClubName;
  distanceMetres: number;
  mishit: boolean;
  playable?: boolean;
  severeMiss?: boolean;
  sessionDate: string;
  createdAt: string;
};

export type TeeOrigin = {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  capturedAt: string;
  source: "live-gps";
};
export type TeeOriginObservation = TeeOrigin & {
  courseId: string;
  holeNumber: number;
  tee: string;
};
export type RoundHole = {
  holeNumber: number;
  score: number;
  focusCategory: FocusCategory;
  wentRight: string;
  wentWrong: string;
  tags?: RoundTag[];
  shots?: HoleShot[];
  note?: string;
  tracking?: {
    samples: {
      latitude: number;
      longitude: number;
      accuracy: number;
      recordedAt: string;
    }[];
    lastAccuracy?: number;
  };
  latestShotContext?: ShotContext;
  teeOrigin?: TeeOrigin;
  teeOriginObservations?: TeeOriginObservation[];
};
export type ShotLie = "tee" | "fairway" | "rough" | "bunker" | "recovery";

export type ShotContext = {
  holeNumber: number;
  position: {
    latitude: number;
    longitude: number;
    accuracyM?: number;
    capturedAt: string;
  };
  targetPosition: { latitude: number; longitude: number };
  targetType: "green-centre" | "target";
  distanceToTargetM: number;
  shotBearingDeg: number;
  capturedAt: string;
  lie?: ShotLie;
};

export type Round = {
  id: string;
  date: string;
  courseName: string;
  courseId?: string;
  totalScore?: number;
  handicapIndex?: number;
  overallNote: string;
  status: "in-progress" | "archived";
  holes: RoundHole[];
  loop?: "east" | "north" | "south";
  loopId?: string;
  roundLength?: number;
  holeSequence?: number[];
  tee?: string;
  teeId?: string;
  archivedAt?: string;
  currentHoleIndex?: number;
};

export type WeeklyPlan = {
  weekStart: string;
  practiceAComplete: boolean;
  practiceBComplete: boolean;
  practiceCComplete?: boolean;
  practiceSessionsComplete?: boolean[];
  roundsComplete?: boolean[];
  roundComplete: boolean;
};

export type AppData = {
  schemaVersion: number;
  handicapHistory: {
    id: string;
    date: string;
    index: number;
    roundId?: string;
  }[];
  readings: RangeReading[];
  rounds: Round[];
  weeklyPlan: WeeklyPlan;
  weeklyHistory?: WeeklyPlan[];
  bag?: ClubName[];
  practiceFrequency?: {
    roundsPerWeek: number;
    practiceSessionsPerWeek: number;
  };
  playerGoals?: string[];
  homeCourseId?: string;
  homeCourseName?: string;
  preferredTee?: string;
  lastRoundLength?: 9 | 18 | 27;
  lastRoundLoop?: "east" | "north" | "south";
};

export type PracticePriority = {
  key: string;
  phase: ShotPhase;
  club?: ClubName;
  outcome: string;
  count: number;
  impact: number;
  evidence: string;
  drill: string;
};
export function issueLabel(
  category: RoundCategory | ShotPhase,
  outcome: string,
): string {
  const value = outcome.toLowerCase();
  if ((category === "drive" || category === "tee") && value.includes("contact"))
    return "Driver strike";
  if ((category === "drive" || category === "tee") && value.includes("slice"))
    return "Slice control";
  if (
    (category === "drive" || category === "tee") &&
    (value.includes("bad drive") || value.includes("fairway"))
  )
    return "Fairway finding";
  if ((category === "drive" || category === "tee") && value.includes("top"))
    return "Strike height control";
  if (category === "drive" || category === "tee") return "Tee-shot control";
  if (
    (category === "iron" || category === "approach") &&
    value.includes("contact")
  )
    return "Iron strike";
  if (
    (category === "iron" || category === "approach") &&
    (value.includes("short") ||
      value.includes("long") ||
      value.includes("distance"))
  )
    return "Approach distance control";
  if (category === "iron" || category === "approach") return "Approach control";
  if (
    (category === "putt" || category === "putting") &&
    value.includes("speed")
  )
    return "Putting pace";
  if (category === "putt" || category === "putting") return "Putting control";
  if (category === "chip" || category === "short-game")
    return value.includes("distance")
      ? "Short-game distance control"
      : "Short-game contact";
  return "Course management";
}

export const SEED_READINGS: Array<[ClubName, number[]]> = [
  ["6i", [142, 152, 150, 145, 160]],
  ["7i", [140, 140, 140, 145]],
  ["8i", [137, 138, 142, 135, 128, 130]],
  ["9i", [120, 110, 120, 115, 100, 112]],
  ["PW", [90, 98, 100, 95, 92]],
  ["SW", [80, 86, 88, 85, 80]],
];

export const CATEGORY_GUIDANCE: Record<FocusCategory, string> = {
  "Tee shot": "Driver contact and fairway-finder practice",
  Approach: "Iron contact and starting-line practice",
  "Short game": "Chipping and pitching practice",
  Putting: "Putting distance-control practice",
  "Course management": "Conservative targets and club-selection practice",
};

export function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function clubSummary(readings: RangeReading[], club: ClubName) {
  const usable = readings.filter(
    (reading) => reading.club === club && !reading.severeMiss,
  );
  const distances = usable.map((reading) => reading.distanceMetres);
  return {
    typical: median(distances),
    min: distances.length ? Math.min(...distances) : undefined,
    max: distances.length ? Math.max(...distances) : undefined,
    usableCount: distances.length,
    playableCount: readings.filter(
      (reading) => reading.club === club && reading.playable !== false,
    ).length,
    playablePercentage: readings.filter((reading) => reading.club === club)
      .length
      ? Math.round(
          (readings.filter(
            (reading) => reading.club === club && reading.playable !== false,
          ).length /
            readings.filter((reading) => reading.club === club).length) *
            100,
        )
      : undefined,
    severeMissPercentage: readings.filter((reading) => reading.club === club)
      .length
      ? Math.round(
          (readings.filter(
            (reading) => reading.club === club && reading.severeMiss === true,
          ).length /
            readings.filter((reading) => reading.club === club).length) *
            100,
        )
      : undefined,
    readings: readings
      .filter((reading) => reading.club === club)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** Fits a wind-adjusted target to the golfer's observed usable carry. */
export function isTeeTargetReachable(
  readings: RangeReading[],
  club: ClubName,
  playingDistanceM: number,
  fallbackToleranceM = 15,
) {
  const summary = clubSummary(readings, club);
  if (
    summary.usableCount >= 3 &&
    summary.min !== undefined &&
    summary.max !== undefined
  ) {
    const edgeAllowance = 3;
    return playingDistanceM >= summary.min - edgeAllowance && playingDistanceM <= summary.max + edgeAllowance;
  }
  return summary.typical !== undefined && Math.abs(summary.typical - playingDistanceM) <= fallbackToleranceM;
}

export function clubDisplayLabel(club: string) {
  return club === "4W-Hybrid" ? "4H" : club;
}

export function caddiePlan(
  readings: RangeReading[],
  par: number,
  targetDistance: number,
) {
  const clubs = CLUBS.map((club) => ({
    club,
    summary: clubSummary(readings, club),
  })).filter(({ summary }) => summary.typical);
  if (!clubs.length) return undefined;
  const stats = clubs
    .map(({ club, summary }) => {
      const clubReadings = readings.filter((reading) => reading.club === club);
      const recent = clubReadings
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
      const rate = (
        items: RangeReading[],
        key: "playable" | "severeMiss",
        inverse = false,
      ) =>
        items.length
          ? items.filter((item) =>
              inverse
                ? item[key] !== true
                : item[key] === true ||
                  (key === "playable" && item[key] === undefined),
            ).length / items.length
          : 0;
      const playable =
        rate(clubReadings, "playable") * 0.7 +
        (recent.length >= 5
          ? rate(recent, "playable")
          : rate(clubReadings, "playable")) *
          0.3;
      const severe =
        rate(clubReadings, "severeMiss") * 0.7 +
        (recent.length >= 5
          ? rate(recent, "severeMiss")
          : rate(clubReadings, "severeMiss")) *
          0.3;
      return { club, carry: summary.typical!, playable, severe };
    })
    .sort((a, b) => b.carry - a.carry);
  // Maximise progress while heavily discounting clubs that bring a ball out of play.
  // Severe-miss risk is squared so it outweighs small carry or playable-rate gains.
  const teeScore = (item: (typeof stats)[number]) =>
    item.carry * (1 - item.severe) ** 2 * (0.85 + item.playable * 0.15);
  // Tee selection evaluates the whole bag. An iron can be the correct tee
  // club when its carry is sufficient and its penalty risk is materially lower.
  const tee = stats
    .slice()
    .sort((a, b) => teeScore(b) - teeScore(a))[0];
  // Driver and 3W are tee clubs. 4W-Hybrid remains available from the fairway.
  const fairwayClubs = stats.filter(
    (item) => !["Dr", "3W"].includes(item.club),
  );
  const sequence: typeof stats = [];
  let remaining = targetDistance;
  if (par === 3)
    sequence.push(
      stats
        .slice()
        .sort(
          (a, b) =>
            Math.abs(a.carry - targetDistance) -
            Math.abs(b.carry - targetDistance),
        )[0],
    );
  else {
    sequence.push(tee);
    remaining -= tee.carry;
    if (par === 5 && remaining > 25) {
      const layup = fairwayClubs
        .filter((item) => item.club !== tee.club && item.carry <= remaining)
        .sort((a, b) => b.carry - a.carry)[0];
      if (layup) {
        sequence.push(layup);
        remaining -= layup.carry;
      }
    }
    const approach = fairwayClubs
      .filter((item) => !sequence.some((shot) => shot.club === item.club))
      .sort(
        (a, b) => Math.abs(remaining - a.carry) - Math.abs(remaining - b.carry),
      )[0];
    if (approach) sequence.push(approach);
  }
  return { tee, sequence };
}

export type CaddieReason = {
  key: string;
  label: string;
  value?: string;
  tone?: "positive" | "neutral" | "warning";
};

export type CaddieDecision = {
  plan: string[];
  primaryClub?: string;
  followUpClub?: string;
  reasons: CaddieReason[];
};

export const TEE_RATIONALE_CONFIG = {
  similarDistanceM: 10,
  meaningfulPlayablePoints: 8,
  meaningfulSeverePoints: 8,
} as const;

const naturalClubName = (club: ClubName) => (club === "Dr" ? "Driver" : club);

export function teeRationale(
  readings: RangeReading[],
  selectedClub: ClubName,
): string {
  const selected = clubSummary(readings, selectedClub);
  if (!selected.typical) return "Best risk/reliability fit off this tee.";
  const alternatives = [...new Set([...CLUBS, ...readings.map((reading) => reading.club)])]
    .filter((club) => club !== selectedClub)
    .map((club) => ({ club, summary: clubSummary(readings, club) }))
    .filter((item) => item.summary.typical !== undefined)
    .sort((a, b) => Math.abs(a.summary.typical! - selected.typical!) - Math.abs(b.summary.typical! - selected.typical!));
  const comparison = alternatives.find((item) => {
    const distanceSimilar = Math.abs(item.summary.typical! - selected.typical!) <= TEE_RATIONALE_CONFIG.similarDistanceM;
    const playableAdvantage = (selected.playablePercentage ?? 0) - (item.summary.playablePercentage ?? 0);
    const severeAdvantage = (item.summary.severeMissPercentage ?? 0) - (selected.severeMissPercentage ?? 0);
    return distanceSimilar && (playableAdvantage >= TEE_RATIONALE_CONFIG.meaningfulPlayablePoints || severeAdvantage >= TEE_RATIONALE_CONFIG.meaningfulSeverePoints);
  });
  if (!comparison) return "Best risk/reliability fit off this tee.";
  const playableAdvantage = (selected.playablePercentage ?? 0) - (comparison.summary.playablePercentage ?? 0);
  const severeAdvantage = (comparison.summary.severeMissPercentage ?? 0) - (selected.severeMissPercentage ?? 0);
  const other = naturalClubName(comparison.club);
  if (playableAdvantage >= TEE_RATIONALE_CONFIG.meaningfulPlayablePoints && severeAdvantage >= TEE_RATIONALE_CONFIG.meaningfulSeverePoints)
    return `Similar distance with better reliability and lower penalty risk than ${other}.`;
  if (severeAdvantage >= TEE_RATIONALE_CONFIG.meaningfulSeverePoints)
    return `Similar distance with much lower penalty risk than ${other}.`;
  if (playableAdvantage >= TEE_RATIONALE_CONFIG.meaningfulPlayablePoints)
    return `More reliable than ${other} at similar distance.`;
  return `Best distance and reliability fit off this tee.`;
}

/** Explains the existing caddiePlan output without changing its selection logic. */
export function caddieDecision(
  readings: RangeReading[],
  par: number,
  targetDistance: number,
): CaddieDecision | undefined {
  const result = caddiePlan(readings, par, targetDistance);
  if (!result) return undefined;
  const primary = result.sequence[0];
  const followUp = result.sequence[1];
  const primarySummary = primary
    ? clubSummary(readings, primary.club)
    : undefined;
  const followUpSummary = followUp
    ? clubSummary(readings, followUp.club)
    : undefined;
  const reasons: CaddieReason[] = [];
  if (primary && primarySummary?.typical) {
    const summary = primarySummary;
    reasons.push({
      key: "primary-carry",
      label: "Typical carry",
      value: `${summary.typical}m`,
      tone: "neutral",
    });
    if (summary.usableCount >= 3 && summary.min !== undefined && summary.max !== undefined)
      reasons.push({
        key: "primary-range",
        label: "Observed carry",
        value: `${summary.min}–${summary.max}m observed`,
        tone: "neutral",
      });
    if (summary.playablePercentage !== undefined)
      reasons.push({
        key: "primary-playable",
        label: "Playable",
        value: `${summary.playablePercentage}%`,
        tone: "positive",
      });
    if (summary.severeMissPercentage !== undefined)
      reasons.push({
        key: "primary-severe",
        label: "Severe miss",
        value: `${summary.severeMissPercentage}%`,
        tone: summary.severeMissPercentage > 15 ? "warning" : "neutral",
      });
    reasons.push({
      key: "risk-comparison",
      label: "Reason",
      value: teeRationale(readings, primary.club),
      tone: "positive",
    });
  }
  if (
    primary &&
    followUp &&
    primarySummary?.typical &&
    followUpSummary?.typical
  ) {
    const remaining = Math.max(
      0,
      Math.round(targetDistance - primarySummary.typical),
    );
    reasons.push({
      key: "follow-up-distance",
      label: "Expected remaining",
      value: `~${remaining}m`,
      tone: "neutral",
    });
    reasons.push({
      key: "follow-up-carry",
      label: `${followUp.club} typical carry`,
      value: `${followUpSummary.typical}m`,
      tone: "positive",
    });
    if (followUpSummary.playablePercentage !== undefined)
      reasons.push({
        key: "follow-up-playable",
        label: `${followUp.club} playable`,
        value: `${followUpSummary.playablePercentage}%`,
        tone: "positive",
      });
  }
  return {
    plan: result.sequence.map((item) => item.club),
    primaryClub: primary?.club,
    followUpClub: followUp?.club,
    reasons,
  };
}

export const ADAPTIVE_CADDIE_V1 = {
  distanceFitWeight: 0.5,
  playableWeight: 0.25,
  severeMissPenalty: 0.8,
  reliabilityWeight: 0.1,
  shortBias: 0.04,
  lieSuitability: {
    tee: { Dr: 1, "3W": 0.98, "4W-Hybrid": 0.98, iron: 0.95 },
    fairway: { Dr: 0, "3W": 0, "4W-Hybrid": 1, iron: 1 },
    rough: { Dr: 0, "3W": 0.45, "4W-Hybrid": 0.78, iron: 0.95 },
    bunker: { Dr: 0, "3W": 0, "4W-Hybrid": 0, longIron: 0.45, iron: 0.9 },
  },
} as const;

const adaptiveClubKind = (club: ClubName) =>
  club === "Dr" ? "Dr" : club === "3W" ? "3W" : club === "4W-Hybrid" ? "4W-Hybrid" : ["6i", "7i"].includes(club) ? "longIron" : "iron";

function lieSuitability(club: ClubName, lie: ShotLie) {
  const values = ADAPTIVE_CADDIE_V1.lieSuitability[lie as keyof typeof ADAPTIVE_CADDIE_V1.lieSuitability];
  if (lie === "recovery") return ["6i", "7i", "8i", "9i"].includes(club) ? 1 : 0;
  return values[adaptiveClubKind(club) as keyof typeof values] ?? values.iron ?? 0;
}

export function adaptiveCaddieDecision(
  readings: RangeReading[],
  bag: ClubName[] | undefined,
  targetDistanceM: number,
  effectiveDistanceM: number,
  lie: ShotLie | undefined,
): AdaptiveCaddieDecision {
  if (!lie)
    return { targetDistanceM, effectiveDistanceM, candidates: [], reasons: [], status: "insufficient-data" };
  if (effectiveDistanceM <= 35 && (lie === "fairway" || lie === "rough")) {
    const wedge = ["PW", "SW"].find((club) => (bag || CLUBS).includes(club) && clubSummary(readings, club).typical);
    if (wedge) return { recommendedClub: wedge, targetDistanceM, effectiveDistanceM, lie, candidates: [{ club: wedge, carryM: clubSummary(readings, wedge).typical, lieSuitability: 1, utility: 1 }], reasons: [{ key: "short-game", label: "Reason", value: "Scoring wedge for a short approach", tone: "positive" }], status: "recommended" };
  }
  if (lie === "recovery") {
    const recoveryClub = (bag || CLUBS).find((club) => ["6i", "7i", "8i", "9i"].includes(club) && clubSummary(readings, club).typical);
    return {
      recommendedClub: recoveryClub,
      targetDistanceM,
      effectiveDistanceM,
      lie,
      candidates: recoveryClub ? [{ club: recoveryClub, carryM: clubSummary(readings, recoveryClub).typical, lieSuitability: 1, utility: 1 }] : [],
      reasons: recoveryClub ? [{ key: "recovery", label: "Reason", value: "Conservative club to play back to safety", tone: "positive" }] : [],
      status: recoveryClub ? "recovery-required" : "no-suitable-club",
    };
  }
  const candidates = [...new Set(bag || CLUBS)]
    .map((club): AdaptiveClubCandidate => {
      const summary = clubSummary(readings, club);
      const carry = summary.typical;
      const suitability = lieSuitability(club, lie);
      const excluded = !carry || suitability === 0;
      if (excluded) return { club, carryM: carry, lieSuitability: suitability, excluded: true, exclusionReason: !carry ? "No carry data" : "Not suitable from this lie" };
      const gap = Math.abs(carry - effectiveDistanceM);
      const fit = Math.max(0, 1 - gap / Math.max(effectiveDistanceM, 1));
      const playable = summary.playablePercentage === undefined ? 0.5 : summary.playablePercentage / 100;
      const severe = summary.severeMissPercentage === undefined ? 0.15 : summary.severeMissPercentage / 100;
      const reliability = Math.min(1, summary.readings.length / 10);
      const shortPreference = carry > effectiveDistanceM ? ADAPTIVE_CADDIE_V1.shortBias : 0;
      const utility = fit * ADAPTIVE_CADDIE_V1.distanceFitWeight + playable * ADAPTIVE_CADDIE_V1.playableWeight - severe * ADAPTIVE_CADDIE_V1.severeMissPenalty + reliability * ADAPTIVE_CADDIE_V1.reliabilityWeight + suitability * 0.15 - shortPreference;
      return { club, carryM: carry, distanceGapM: gap, distanceFitScore: fit, playableRate: playable, severeMissRate: severe, lieSuitability: suitability, reliabilityScore: reliability, utility };
    });
  const usable = candidates.filter((candidate) => !candidate.excluded).sort((a, b) => (b.utility || -Infinity) - (a.utility || -Infinity));
  const best = usable[0];
  if (!best) return { targetDistanceM, effectiveDistanceM, lie, candidates, reasons: [], status: "no-suitable-club" };
  const reasons: CaddieReason[] = [];
  if (best.carryM !== undefined) reasons.push({ key: "adaptive-carry", label: "Carry", value: `${best.carryM}m carry`, tone: "positive" });
  if (best.playableRate !== undefined) reasons.push({ key: "adaptive-playable", label: "Playable", value: `${Math.round(best.playableRate * 100)}% playable`, tone: "positive" });
  if (best.severeMissRate !== undefined) reasons.push({ key: "adaptive-severe", label: "Severe miss", value: `${Math.round(best.severeMissRate * 100)}% severe miss`, tone: best.severeMissRate > 0.15 ? "warning" : "neutral" });
  reasons.push({ key: "adaptive-fit", label: "Reason", value: best.carryM && best.carryM < effectiveDistanceM ? "Best fit for playing distance" : "Best distance/risk balance", tone: "positive" });
  return { recommendedClub: best.club, targetDistanceM, effectiveDistanceM, lie, candidates, reasons, status: "recommended" };
}

export function convertMetres(metres: number, units: "metres" | "yards") {
  return units === "yards" ? Math.round(metres * 1.09361) : metres;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function startOfWeek(date = new Date()) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value.toISOString().slice(0, 10);
}

export function seedData(): AppData {
  const createdAt = "2026-09-14T08:00:00.000Z";
  const readings = SEED_READINGS.flatMap(([club, distances]) =>
    distances.map((distanceMetres, index) => ({
      id: `seed-${club}-${index}`,
      club,
      distanceMetres,
      mishit: false,
      playable: true,
      sessionDate: "2026-09-14",
      createdAt,
    })),
  );
  return {
    schemaVersion: 1,
    handicapHistory: [{ id: "seed-handicap", date: "2026-09-14", index: 16.5 }],
    readings,
    rounds: [],
    weeklyPlan: {
      weekStart: startOfWeek(),
      practiceAComplete: false,
      practiceBComplete: false,
      practiceCComplete: false,
      roundComplete: false,
    },
    weeklyHistory: [],
    bag: [...CLUBS, "Putter"],
    practiceFrequency: { roundsPerWeek: 1, practiceSessionsPerWeek: 2 },
    homeCourseId: "hermanus-golf-club",
    homeCourseName: "Hermanus Golf Club",
    preferredTee: "white",
    lastRoundLength: 9,
    lastRoundLoop: "east",
  };
}

export function roundTotal(round: Round) {
  return round.holes.reduce((total, hole) => total + (hole.score || 0), 0);
}

export function categoryCounts(rounds: Round[]) {
  const counts = {} as Record<FocusCategory, number>;
  rounds
    .flatMap((round) => round.holes)
    .forEach((hole) => {
      if (hole.wentWrong.trim())
        counts[hole.focusCategory] = (counts[hole.focusCategory] || 0) + 1;
    });
  return counts;
}

export function recommendation(rounds: Round[]) {
  const recent = rounds
    .filter((round) => round.status === "archived")
    .slice(-3);
  const problems = recent
    .flatMap((round) =>
      round.holes.map((hole) =>
        (hole.tags || []).filter((tag) => tag.type === "went-wrong"),
      ),
    )
    .filter((tags) => tags.length);
  if (problems.length < 2) {
    return {
      text: "Not enough repeated feedback yet.",
      evidence:
        "Complete more rounds using the quick tags to reveal a reliable pattern.",
    };
  }
  const groups = problems.reduce<
    Record<string, { count: number; outcomes: Record<string, number> }>
  >((all, tags) => {
    const categories = new Set(tags.map((tag) => tag.category));
    categories.forEach((category) => {
      const group = all[category] || { count: 0, outcomes: {} };
      group.count += 1;
      tags
        .filter((tag) => tag.category === category)
        .forEach((tag) => {
          group.outcomes[tag.outcome] = (group.outcomes[tag.outcome] || 0) + 1;
        });
      all[category] = group;
    });
    return all;
  }, {});
  const [category, group] = Object.entries(groups).sort(
    (a, b) => b[1].count - a[1].count,
  )[0];
  const [outcome, outcomeCount] = Object.entries(group.outcomes).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const label = category[0].toUpperCase() + category.slice(1);
  const focus =
    category === "drive"
      ? "contact and finding playable fairways"
      : category === "iron"
        ? "distance control"
        : category === "putt"
          ? "green reading and speed"
          : `${category} consistency`;
  return {
    text: `${label} is the main leak right now.`,
    evidence: `You recorded ${outcomeCount} ${outcome.toLowerCase()} problem${outcomeCount === 1 ? "" : "s"} across your last ${recent.length} rounds. Focus your next practice on ${focus}.`,
  };
}

export function practicePriorities(
  rounds: Round[],
  readings: RangeReading[],
): PracticePriority[] {
  const recent = rounds
    .filter((round) => round.status === "archived")
    .slice(-5);
  const groups = new Map<
    string,
    {
      phase: ShotPhase;
      club?: ClubName;
      outcome: string;
      count: number;
      impact: number;
    }
  >();
  recent
    .flatMap((round) =>
      round.holes.flatMap((hole) =>
        (hole.shots || []).map((shot) => ({ ...shot, score: hole.score })),
      ),
    )
    .filter((shot) => shot.outcome === "bad" && shot.note)
    .forEach((shot) => {
      const key = `${shot.phase}|${shot.club}|${shot.note}`;
      const current = groups.get(key) || {
        phase: shot.phase,
        club: shot.club,
        outcome: shot.note!,
        count: 0,
        impact: 0,
      };
      current.count += 1;
      current.impact += Math.max(1, shot.score - 4);
      groups.set(key, current);
    });
  const legacyPhase: Record<RoundCategory, ShotPhase> = {
    drive: "tee",
    wood: "tee",
    iron: "approach",
    chip: "short-game",
    putt: "putting",
  };
  recent
    .flatMap((round) =>
      round.holes.flatMap((hole) =>
        (hole.tags || [])
          .filter((tag) => tag.type === "went-wrong")
          .map((tag) => ({ tag, score: hole.score })),
      ),
    )
    .forEach(({ tag, score }) => {
      const phase = legacyPhase[tag.category];
      const key = `${phase}|legacy|${tag.outcome}`;
      const current = groups.get(key) || {
        phase,
        club: undefined,
        outcome: tag.outcome,
        count: 0,
        impact: 0,
      };
      current.count += 1;
      current.impact += Math.max(1, score - 4);
      groups.set(key, current);
    });
  const risk = new Map<string, { bad: number; total: number }>();
  readings.forEach((reading) => {
    const item = risk.get(reading.club) || { bad: 0, total: 0 };
    item.total += 1;
    if (reading.playable === false || reading.severeMiss) item.bad += 1;
    risk.set(reading.club, item);
  });
  return [...groups.values()]
    .map((item) => {
      const clubRisk = item.club ? risk.get(item.club) : undefined;
      const playable = clubRisk?.total
        ? ` ${Math.round((1 - clubRisk.bad / clubRisk.total) * 100)}% playable in range data.`
        : "";
      return {
        ...item,
        key: `${item.phase}|${item.club || "legacy"}|${item.outcome}`,
        evidence: `${item.club ? `${item.club} ` : ""}${item.outcome.toLowerCase()} ${item.count} time${item.count === 1 ? "" : "s"} in recent rounds.${playable}`,
        drill: issueLabel(item.phase, item.outcome),
      };
    })
    .sort((a, b) => b.count * 3 + b.impact - (a.count * 3 + a.impact))
    .slice(0, 5);
}

export function personalisedRecommendation(
  rounds: Round[],
  readings: RangeReading[],
) {
  const priorities = practicePriorities(rounds, readings);
  if (!priorities.length)
    return {
      text: "Choose your first practice focus.",
      evidence:
        "Tell us what you want to improve during onboarding, or record a round to let the caddie find your priorities.",
      priorities,
    };
  const top = priorities[0];
  return {
    text: `Work on ${top.club ? `${top.club} ` : ""}${top.outcome.toLowerCase()}.`,
    evidence: top.evidence,
    priorities,
  };
}
