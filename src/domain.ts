export const CLUBS: ClubName[] = [
  "Dr",
  "3W",
  "4W-Hybrid",
  "5i",
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
  "5i",
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
export type ShotPhase = "tee" | "approach" | "short-game" | "recovery" | "putting";
export type AdaptiveCaddieStatus =
  | "recommended"
  | "insufficient-data"
  | "recovery-required"
  | "no-suitable-club";
export type AdaptiveCaddieStatusWithLocation = AdaptiveCaddieStatus | "invalid-location";
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
  adjustmentM?: number;
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
  status: AdaptiveCaddieStatusWithLocation;
};
export type HoleShot = {
  id: string;
  phase: ShotPhase;
  club?: ClubName;
  outcome?: "good" | "bad";
  note?: string;
  outcomes?: { outcome: "good" | "bad"; note: string }[];
  actualDistanceM?: number;
  startDistanceToTargetM?: number;
  endDistanceToTargetM?: number;
  startLie?: ShotLie;
  startPosition?: ShotContext["position"];
  endPosition?: ShotContext["position"];
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
  onGreen?: boolean;
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

export function ensurePuttingShot(shots: HoleShot[]) {
  const normalized = shots.map((shot) => shot.phase === "putting" && shot.club !== "Putter" ? { ...shot, club: "Putter" } : shot);
  return normalized.some((shot) => shot.phase === "putting")
    ? normalized
    : [...normalized, { id: crypto.randomUUID(), phase: "putting" as const, club: "Putter" }];
}

export function appendHoleShot(shots: HoleShot[], phase: ShotPhase, club?: ClubName) {
  return [...shots, { id: crypto.randomUUID(), phase, club }];
}

export function updateHoleShot(shots: HoleShot[], shotId: string, update: Partial<HoleShot>) {
  return shots.map((shot) => shot.id === shotId ? { ...shot, ...update } : shot);
}

export function enrichShotWithContext(
  shot: HoleShot,
  start: Pick<ShotContext, "position" | "distanceToTargetM" | "lie">,
  end: Pick<ShotContext, "position" | "distanceToTargetM">,
  actualDistanceM?: number,
) {
  return {
    ...shot,
    ...(actualDistanceM !== undefined ? { actualDistanceM } : {}),
    startDistanceToTargetM: start.distanceToTargetM,
    endDistanceToTargetM: end.distanceToTargetM,
    startLie: start.lie,
    startPosition: start.position,
    endPosition: end.position,
  };
}
export type ShotLie = "tee" | "fairway" | "rough" | "bunker" | "green" | "recovery";

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
  practicePeriod?: "week" | "month";
  playerGoals?: string[];
  homeCourseId?: string;
  homeCourseName?: string;
  preferredTee?: string;
  lastRoundLength?: 9 | 18 | 27;
  lastRoundLoop?: "east" | "north" | "south";
};

export function roundHandicapIndex(latestHandicap: number | undefined, storedHandicap?: number) {
  return storedHandicap ?? latestHandicap;
}

export function currentHandicapIndex(history: AppData["handicapHistory"]) {
  return history.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).at(-1)?.index;
}

export function normalizedRoundScore(round: Round, targetHoles = 9) {
  const playedHoles = round.holes.filter((hole) => hole.score > 0).length || round.holes.length;
  const score = round.totalScore || roundTotal(round);
  return playedHoles ? (score / playedHoles) * targetHoles : 0;
}

export function getOnCourseClubAdjustment(rounds: Round[], club: ClubName, baselineCarryM?: number) {
  const evidence: Array<{ kind: "actual" | "short" | "long" | "good"; value: number }> = [];
  for (const round of rounds) for (const hole of round.holes) for (const shot of hole.shots || []) {
    if (shot.club !== club) continue;
    if (shot.actualDistanceM !== undefined && shot.actualDistanceM >= 5 && shot.startDistanceToTargetM === undefined && shot.endDistanceToTargetM === undefined) {
      evidence.push({ kind: "actual", value: shot.actualDistanceM });
      continue;
    }
    for (const outcome of shot.outcomes || []) {
      if (/short|too short/i.test(outcome.note)) evidence.push({ kind: "short", value: 1 });
      else if (/long|too long/i.test(outcome.note)) evidence.push({ kind: "long", value: 1 });
      else if (/good distance/i.test(outcome.note)) evidence.push({ kind: "good", value: 0 });
    }
  }
  const actual = evidence.filter((item) => item.kind === "actual").map((item) => item.value);
  let adjustment = 0;
  let usable = evidence.length;
  let reason = "";
  if (actual.length >= 5) {
    const sorted = [...actual].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    usable = actual.length;
    adjustment = baselineCarryM ? Math.max(-6, Math.min(6, baselineCarryM - median)) : 0;
    if (adjustment > 0) reason = "Recent on-course distances: tends to finish longer";
    if (adjustment < 0) reason = "Recent on-course distances: tends to finish shorter";
  } else {
    const tagged = evidence.filter((item) => item.kind !== "actual");
    usable = tagged.length;
    const short = tagged.filter((item) => item.kind === "short").length;
    const long = tagged.filter((item) => item.kind === "long").length;
    const good = tagged.filter((item) => item.kind === "good").length;
    if (usable >= 5) {
      const cap = usable >= 10 ? 6 : 3;
      adjustment = Math.max(-cap, Math.min(cap, (Math.max(0, short - good) - Math.max(0, long - good)) * 1.5));
      if (adjustment > 0) reason = "Recent rounds: tends to finish short";
      if (adjustment < 0) reason = "Recent rounds: tends to finish long";
    }
  }
  return { adjustmentM: adjustment, usableObservations: usable, reason };
}

export type ShotEvidence = {
  roundId: string;
  date: string;
  courseId?: string;
  holeNumber: number;
  tee?: string;
  phase: ShotPhase;
  club?: ClubName;
  startDistanceM?: number;
  endDistanceM?: number;
  startLie?: ShotLie;
  actualDistanceM?: number;
  positive: boolean;
  negative: boolean;
  executionIssue: boolean;
  notes: string[];
};

const evidenceNotes = (shot: HoleShot) => [
  ...(shot.note ? [shot.note] : []),
  ...(shot.outcomes || []).map((item) => item.note),
];

export function buildShotEvidence(rounds: Round[]): ShotEvidence[] {
  return rounds
    .filter((round) => round.status === "archived")
    .flatMap((round) => round.holes.flatMap((hole) => (hole.shots || []).map((shot) => {
      const notes = evidenceNotes(shot);
      const text = notes.join(" · ").toLowerCase();
      const executionIssue = /bad contact|thin|fat|topped|mishit|poor contact/.test(text);
      const positive = /hit green|good distance|good contact|good direction|good approach|good read|good speed|playable/.test(text) || (!notes.length && shot.endDistanceToTargetM !== undefined && shot.startDistanceToTargetM !== undefined && shot.endDistanceToTargetM < shot.startDistanceToTargetM * 0.25);
      const negative = /too short|too long|poor direction|poor lie|wrong club|three-putt|missed|bad read|bad speed/.test(text) || (!executionIssue && /bad/.test(text));
      return {
        roundId: round.id,
        date: round.archivedAt || round.date,
        courseId: round.courseId,
        holeNumber: hole.holeNumber,
        tee: round.tee,
        phase: shot.phase,
        club: shot.club,
        startDistanceM: shot.startDistanceToTargetM,
        endDistanceM: shot.endDistanceToTargetM,
        startLie: shot.startLie,
        actualDistanceM: shot.actualDistanceM,
        positive,
        negative,
        executionIssue,
        notes,
      };
    })));
}

export function getContextEvidence(rounds: Round[], input: {
  phase: ShotPhase;
  club?: ClubName;
  distanceM?: number;
  lie?: ShotLie;
  courseId?: string;
  holeNumber?: number;
  tee?: string;
  referenceDate?: string | number | Date;
}) {
  const distanceToleranceM = 12;
  return buildShotEvidence(rounds)
    .filter((item) => item.phase === input.phase && (!input.club || item.club === input.club))
    .map((item) => {
      let weight = 1;
      if (input.courseId && item.courseId === input.courseId) weight += 1.5;
      if (input.holeNumber !== undefined && item.holeNumber === input.holeNumber) weight += 2;
      if (input.tee && item.tee === input.tee) weight += 0.5;
      if (input.lie && item.startLie === input.lie) weight += 1;
      else if (input.lie && item.startLie && item.startLie !== input.lie) weight *= 0.25;
      if (input.distanceM !== undefined && item.startDistanceM === undefined) return null;
      if (input.distanceM !== undefined && item.startDistanceM !== undefined) {
        const distance = Math.abs(item.startDistanceM - input.distanceM);
        if (distance > distanceToleranceM * 3) return null;
        weight *= Math.max(0.25, 1 - distance / (distanceToleranceM * 3));
      }
      const referenceTime = input.referenceDate === undefined ? Date.now() : new Date(input.referenceDate).getTime();
      const ageDays = Math.max(0, (referenceTime - Date.parse(item.date)) / 86400000);
      weight *= Math.pow(0.995, ageDays);
      return { ...item, weight };
    })
    .filter((item): item is ShotEvidence & { weight: number } => item !== null);
}

export function getClubContextEvidence(rounds: Round[], input: Omit<Parameters<typeof getContextEvidence>[1], "club"> & { club: ClubName }) {
  return getContextEvidence(rounds, input);
}

export type ShotLearningInsight = {
  key: string;
  text: string;
  evidence: string;
  strength: number;
};

export function shotLearningInsights(rounds: Round[]): ShotLearningInsight[] {
  const evidence = buildShotEvidence(rounds);
  const insights: ShotLearningInsight[] = [];
  const approachGroups = new Map<string, typeof evidence>();
  for (const item of evidence) {
    if (item.phase !== "approach" || !item.club || item.startDistanceM === undefined) continue;
    const bucket = Math.floor(item.startDistanceM / 15) * 15;
    const key = `${item.club}|${bucket}|${item.startLie || "unknown"}`;
    approachGroups.set(key, [...(approachGroups.get(key) || []), item]);
  }
  for (const [key, items] of approachGroups) {
    if (items.length < 3) continue;
    const [club, bucket, lie] = key.split("|");
    const negative = items.filter((item) => item.negative && !item.executionIssue).length;
    const positive = items.filter((item) => item.positive).length;
    if (negative >= 3 && negative >= positive) {
      insights.push({ key: `approach-short-${key}`, text: `${club} tends to struggle from ${bucket}–${Number(bucket) + 15}m`, evidence: `${negative} of ${items.length} comparable ${lie} approaches were negative.`, strength: negative / items.length });
    } else if (positive >= 3 && positive > negative) {
      insights.push({ key: `approach-strong-${key}`, text: `${club} has been strong from ${bucket}–${Number(bucket) + 15}m`, evidence: `${positive} of ${items.length} comparable ${lie} approaches were positive.`, strength: positive / items.length });
    }
  }
  const teeGroups = new Map<string, typeof evidence>();
  for (const item of evidence) {
    if (item.phase !== "tee" || !item.club || !item.courseId) continue;
    const key = `${item.courseId}|${item.holeNumber}|${item.tee || "default"}|${item.club}`;
    teeGroups.set(key, [...(teeGroups.get(key) || []), item]);
  }
  for (const [key, items] of teeGroups) {
    if (items.length < 3) continue;
    const [course, hole, tee, club] = key.split("|");
    const positive = items.filter((item) => item.positive).length;
    const negative = items.filter((item) => item.negative).length;
    if (positive >= 3 && positive > negative) insights.push({ key: `tee-${key}`, text: `${club} has been reliable on hole ${hole}`, evidence: `${positive}/${items.length} positive results from ${course} (${tee} tees).`, strength: positive / items.length });
  }
  return insights.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

export function formMapCategoryStats(rounds: Round[], parForHole: (holeNumber: number) => number = () => 0) {
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  const phaseCategory: Record<ShotPhase, FocusCategory> = { tee: "Tee shot", approach: "Approach", "short-game": "Short game", recovery: "Course management", putting: "Putting" };
  const tagCategory: Record<RoundCategory, FocusCategory> = { drive: "Tee shot", wood: "Tee shot", iron: "Approach", chip: "Short game", putt: "Putting" };
  const holes = rounds.filter((round) => round.status === "archived").flatMap((round) => round.holes);
  return categories.map((category) => {
    const observations = holes.filter((hole) => {
      const tagged = (hole.tags || []).some((tag) => tagCategory[tag.category] === category);
      const phase = (hole.shots || []).some((shot) => phaseCategory[shot.phase] === category);
      return tagged || phase || hole.focusCategory === category;
    });
    const trouble = observations.filter((hole) => {
      const relevantTagTrouble = (hole.tags || []).some((tag) => tag.type === "went-wrong" && tagCategory[tag.category] === category);
      const relevantShotTrouble = (hole.shots || []).some((shot) => phaseCategory[shot.phase] === category && (shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad")));
      const focusTrouble = hole.focusCategory === category && !!hole.wentWrong.trim();
      return relevantTagTrouble || relevantShotTrouble || focusTrouble;
    });
    return { category, observationCount: observations.length, troubleCount: trouble.length, averageTroubleScore: trouble.length ? trouble.reduce((sum, hole) => sum + (hole.score - parForHole(hole.holeNumber)), 0) / trouble.length : 0 };
  });
}

export function roundTroubleByCategory(round: Round) {
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  const phaseCategory: Record<ShotPhase, FocusCategory> = { tee: "Tee shot", approach: "Approach", "short-game": "Short game", recovery: "Course management", putting: "Putting" };
  const tagCategory: Record<RoundCategory, FocusCategory> = { drive: "Tee shot", wood: "Tee shot", iron: "Approach", chip: "Short game", putt: "Putting" };
  return Object.fromEntries(categories.map((category) => [category, round.holes.filter((hole) => {
    const badShot = (hole.shots || []).some((shot) => phaseCategory[shot.phase] === category && (shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad")));
    const badTag = (hole.tags || []).some((tag) => tag.type === "went-wrong" && tagCategory[tag.category] === category);
    return badShot || badTag || (hole.focusCategory === category && Boolean(hole.wentWrong.trim()));
  }).length])) as Record<FocusCategory, number>;
}

export function roundTroubleHolesByCategory(round: Round) {
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  const phaseCategory: Record<ShotPhase, FocusCategory> = { tee: "Tee shot", approach: "Approach", "short-game": "Short game", recovery: "Course management", putting: "Putting" };
  const tagCategory: Record<RoundCategory, FocusCategory> = { drive: "Tee shot", wood: "Tee shot", iron: "Approach", chip: "Short game", putt: "Putting" };
  return Object.fromEntries(categories.map((category) => [category, round.holes.filter((hole) => {
    const badShot = (hole.shots || []).some((shot) => phaseCategory[shot.phase] === category && (shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad")));
    const badTag = (hole.tags || []).some((tag) => tag.type === "went-wrong" && tagCategory[tag.category] === category);
    return badShot || badTag || (hole.focusCategory === category && Boolean(hole.wentWrong.trim()));
  }).map((hole) => hole.holeNumber)])) as Record<FocusCategory, number[]>;
}

export function roundTroubleDetailsByCategory(round: Round) {
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  const phaseCategory: Record<ShotPhase, FocusCategory> = { tee: "Tee shot", approach: "Approach", "short-game": "Short game", recovery: "Course management", putting: "Putting" };
  const tagCategory: Record<RoundCategory, FocusCategory> = { drive: "Tee shot", wood: "Tee shot", iron: "Approach", chip: "Short game", putt: "Putting" };
  return Object.fromEntries(categories.map((category) => [category, round.holes.flatMap((hole) => {
    const details = [
      ...(hole.shots || []).filter((shot) => phaseCategory[shot.phase] === category && (shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad"))).flatMap((shot) => shot.outcomes?.filter((outcome) => outcome.outcome === "bad").map((outcome) => outcome.note) || (shot.note ? [shot.note] : [])),
      ...(hole.tags || []).filter((tag) => tag.type === "went-wrong" && tagCategory[tag.category] === category).map((tag) => tag.outcome),
      ...(hole.focusCategory === category && hole.wentWrong.trim() ? [hole.wentWrong.trim()] : []),
    ];
    return details.length ? [{ holeNumber: hole.holeNumber, detail: [...new Set(details)].join(", ") }] : [];
  })])) as Record<FocusCategory, { holeNumber: number; detail: string }[]>;
}

export function recentCategoryTroubleStats(rounds: Round[], parForHole: (holeNumber: number) => number = () => 0) {
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  const recent = rounds.filter((round) => round.status === "archived").sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
  return categories.map((category) => {
    const playedHoles = recent.flatMap((round) => round.holes.filter((hole) => hole.score > 0));
    const categoryTroubleHoles = recent.flatMap((round) => {
      const issueNumbers = new Set(roundTroubleDetailsByCategory(round)[category].map((item) => item.holeNumber));
      return round.holes.filter((hole) => hole.score > 0 && issueNumbers.has(hole.holeNumber));
    });
    const avg = categoryTroubleHoles.length ? categoryTroubleHoles.reduce((sum, hole) => sum + hole.score - parForHole(hole.holeNumber), 0) / categoryTroubleHoles.length : 0;
    return { category, troubleRate: playedHoles.length ? (categoryTroubleHoles.length / playedHoles.length) * 100 : 0, averageWhenItHappens: avg, observationCount: playedHoles.length };
  });
}

export const ROUND_PROGRESS_CONFIG = {
  recentRounds: 2,
  previousRounds: 3,
  minimumRounds: 3,
  meaningfulAbsoluteChange: 0.1,
  minimumIssueOccurrences: 2,
} as const;

export type RoundProgressDirection = "improving" | "stable" | "worsening" | "insufficient-data";
export type RoundProgressInsight = {
  key: string;
  label: string;
  direction: RoundProgressDirection;
  recentTrouble: number;
  recentHoles: number;
  previousTrouble: number;
  previousHoles: number;
  evidence: string;
  strength: number;
};

function holeCategoryEvidence(hole: RoundHole, category: FocusCategory) {
  const phaseCategory: Record<ShotPhase, FocusCategory> = { tee: "Tee shot", approach: "Approach", "short-game": "Short game", recovery: "Course management", putting: "Putting" };
  const tagCategory: Record<RoundCategory, FocusCategory> = { drive: "Tee shot", wood: "Tee shot", iron: "Approach", chip: "Short game", putt: "Putting" };
  const relevantShots = (hole.shots || []).filter((shot) => phaseCategory[shot.phase] === category);
  const relevantTags = (hole.tags || []).filter((tag) => tagCategory[tag.category] === category);
  const observed = hole.focusCategory === category || relevantShots.length > 0 || relevantTags.length > 0;
  const trouble = (hole.focusCategory === category && !!hole.wentWrong.trim()) || relevantTags.some((tag) => tag.type === "went-wrong") || relevantShots.some((shot) => shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad"));
  return { observed, trouble };
}

export function roundProgressInsights(rounds: Round[]): RoundProgressInsight[] {
  const archived = rounds.filter((round) => round.status === "archived").sort((a, b) => a.date.localeCompare(b.date));
  const recent = archived.slice(-ROUND_PROGRESS_CONFIG.recentRounds);
  const previous = archived.slice(-ROUND_PROGRESS_CONFIG.recentRounds - ROUND_PROGRESS_CONFIG.previousRounds, -ROUND_PROGRESS_CONFIG.recentRounds);
  const categories: FocusCategory[] = ["Tee shot", "Approach", "Short game", "Putting"];
  return categories.map((label) => {
    const period = (items: Round[]) => {
      let trouble = 0;
      let holes = 0;
      for (const round of items) for (const hole of round.holes) {
        if (hole.score <= 0) continue;
        holes += 1;
        if (holeCategoryEvidence(hole, label).trouble) trouble += 1;
      }
      return { trouble, holes };
    };
    const current = period(recent);
    const prior = period(previous);
    const priorRate = prior.holes ? prior.trouble / prior.holes : 0;
    const recentRate = current.holes ? current.trouble / current.holes : 0;
    const difference = recentRate - priorRate;
    const enough = archived.length >= ROUND_PROGRESS_CONFIG.minimumRounds && prior.holes > 0 && current.holes > 0 && prior.trouble + current.trouble >= ROUND_PROGRESS_CONFIG.minimumIssueOccurrences;
    const direction: RoundProgressDirection = !enough ? "insufficient-data" : difference <= -ROUND_PROGRESS_CONFIG.meaningfulAbsoluteChange ? "improving" : difference >= ROUND_PROGRESS_CONFIG.meaningfulAbsoluteChange ? "worsening" : "stable";
    const evidence = !enough
      ? "Not enough comparable round evidence yet"
      : direction === "stable"
        ? `Similar trouble rate · ${Math.round(recentRate * 100)}% recently vs ${Math.round(priorRate * 100)}% previously`
        : `Trouble rate · ${Math.round(recentRate * 100)}% recently vs ${Math.round(priorRate * 100)}% previously`;
    return { key: label.toLowerCase().replace(/\s+/g, "-"), label, direction, recentTrouble: current.trouble, recentHoles: current.holes, previousTrouble: prior.trouble, previousHoles: prior.holes, evidence, strength: Math.abs(difference) * Math.max(current.holes, prior.holes) };
  });
}

export type PracticePriority = {
  key: string;
  phase: ShotPhase;
  club?: ClubName;
  outcome: string;
  count: number;
  impact: number;
  evidence: string;
  drill: string;
  clubGroup: "Driver/Woods" | "Irons" | "Wedges" | "Putter" | "Club not recorded";
  phaseLabel: "Off the tee" | "Approach" | "Short game" | "Recovery" | "Putting";
};

function clubGroupForPractice(club: ClubName | undefined, phase: ShotPhase) {
  if (!club && phase === "tee") return "Driver/Woods" as const;
  if (!club && phase === "approach") return "Irons" as const;
  if (!club && phase === "short-game") return "Wedges" as const;
  if (!club && phase === "recovery") return "Club not recorded" as const;
  if (!club && phase === "putting") return "Putter" as const;
  if (club === "Putter" || phase === "putting") return "Putter" as const;
  if (club === "PW" || club === "SW" || phase === "short-game") return "Wedges" as const;
  if (phase === "tee" || ["Dr", "3W", "4W-Hybrid", "5W"].includes(club || "")) return "Driver/Woods" as const;
  return "Irons" as const;
}

function phaseLabelForPractice(phase: ShotPhase) {
  return ({ tee: "Off the tee", approach: "Approach", "short-game": "Short game", recovery: "Recovery", putting: "Putting" } as const)[phase];
}
export function issueLabel(
  category: RoundCategory | ShotPhase,
  outcome: string,
  club?: ClubName,
): string {
  const value = outcome.toLowerCase();
  if ((category === "drive" || category === "tee") && value.includes("contact"))
    return club === "Dr" ? "Driver strike" : club ? `${clubDisplayLabel(club)} strike` : "Tee-shot strike";
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
  return club;
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
  selectedClub?: ClubName,
): CaddieDecision | undefined {
  const result = caddiePlan(readings, par, targetDistance);
  if (!result) return undefined;
  const primary = selectedClub ? { club: selectedClub } as typeof result.sequence[number] : result.sequence[0];
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

export function resolveTeeDecision(
  readings: RangeReading[],
  par: number,
  targetDistance: number,
  rounds: Round[] = [],
  context?: { courseId?: string; holeNumber?: number; tee?: string },
) {
  const plan = caddiePlan(readings, par, targetDistance);
  if (!plan) return undefined;
  const explanation = caddieDecision(readings, par, targetDistance);
  const teeCandidates = [...new Set([plan.tee.club, "Dr", "3W", "4W-Hybrid"] as ClubName[])]
    .filter((club) => clubSummary(readings, club).typical !== undefined && isTeeTargetReachable(readings, club, targetDistance));
  const learned = teeCandidates.map((club) => {
    const evidence = getContextEvidence(rounds, { phase: "tee", club, ...context });
    const weight = evidence.reduce((sum, item) => sum + item.weight, 0);
    const positive = evidence.reduce((sum, item) => sum + (item.positive ? item.weight : 0), 0);
    const negative = evidence.reduce((sum, item) => sum + (item.negative ? item.weight : 0), 0);
    return { club, weight, score: weight >= 2 ? ((positive - negative) / weight) * Math.min(1, weight / 6) : 0 };
  });
  const learnedBest = learned.filter((item) => item.weight >= 2 && getContextEvidence(rounds, { phase: "tee", club: item.club, ...context }).length >= 3).sort((a, b) => b.score - a.score)[0];
  const selectedClub = learnedBest && learnedBest.score > 0 ? learnedBest.club : plan.tee.club;
  const selectedExplanation = caddieDecision(readings, par, targetDistance, selectedClub);
  const selectedSummary = clubSummary(readings, selectedClub);
  const selectedTee = selectedSummary.typical === undefined || selectedClub === plan.tee.club
    ? plan.tee
    : { ...plan.tee, club: selectedClub, carry: selectedSummary.typical };
  const selectedSequence = selectedClub === plan.sequence[0]?.club || !plan.sequence.length
    ? plan.sequence
    : [{ ...plan.sequence[0], club: selectedClub, carry: selectedSummary.typical ?? plan.sequence[0].carry }, ...plan.sequence.slice(1)];
  const selectedPlan = selectedClub === plan.tee.club || selectedSummary.typical === undefined
    ? plan
    : { ...plan, tee: selectedTee, sequence: selectedSequence };
  return {
    club: selectedClub,
    plan: selectedPlan,
    explanation: selectedExplanation || explanation,
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
  if (lie === "green") return club === "Putter" ? 1 : 0;
  const values = ADAPTIVE_CADDIE_V1.lieSuitability[lie as keyof typeof ADAPTIVE_CADDIE_V1.lieSuitability];
  if (lie === "recovery") return ["6i", "7i", "8i", "9i"].includes(club) ? 1 : 0;
  return values[adaptiveClubKind(club) as keyof typeof values] ?? values.iron ?? 0;
}

function greensideClubDecision(readings: RangeReading[], bag: ClubName[], effectiveDistanceM: number) {
  const available = ["SW", "PW"].filter((club) => bag.includes(club));
  if (!available.length) return undefined;
  const sw = clubSummary(readings, "SW");
  const pw = clubSummary(readings, "PW");
  const strongEvidence = (preferred: typeof sw, alternative: typeof pw) =>
    preferred.usableCount >= 5 && alternative.readings.length >= 5 &&
    (preferred.playablePercentage || 0) >= (alternative.playablePercentage || 0) + 20 &&
    (preferred.severeMissPercentage || 0) <= (alternative.severeMissPercentage || 0) + 5;
  const chipType = effectiveDistanceM <= 35;
  const defaultClub = chipType ? "SW" : "PW";
  const alternative = defaultClub === "SW" ? "PW" : "SW";
  const club = available.includes(defaultClub)
    ? (available.includes(alternative) && strongEvidence(clubSummary(readings, alternative), clubSummary(readings, defaultClub)) ? alternative : defaultClub)
    : available[0];
  return { club, chipType };
}

export function adaptiveCaddieDecision(
  readings: RangeReading[],
  bag: ClubName[] | undefined,
  targetDistanceM: number,
  effectiveDistanceM: number,
  lie: ShotLie | undefined,
  officialHoleDistanceM?: number,
  gpsAccuracyM?: number,
  rounds: Round[] = [],
  learningContext?: { courseId?: string; holeNumber?: number; tee?: string },
): AdaptiveCaddieDecision {
  if (!isValidGolfShotContext(targetDistanceM, officialHoleDistanceM, gpsAccuracyM)) {
    const fallback = safeRecoveryClub(readings, bag);
    return {
      recommendedClub: fallback,
      targetDistanceM,
      effectiveDistanceM,
      lie,
      candidates: fallback ? [{ club: fallback, carryM: clubSummary(readings, fallback).typical, lieSuitability: 1, utility: 1 }] : [],
      reasons: [{ key: "invalid-location", label: "Location check", value: "Live location is outside the playable hole area. Using safe fallback.", tone: "warning" }],
      status: "invalid-location",
    };
  }
  if (!lie)
    return { targetDistanceM, effectiveDistanceM, candidates: [], reasons: [], status: "insufficient-data" };
  if (lie === "recovery") {
    return {
      targetDistanceM,
      effectiveDistanceM,
      lie,
      candidates: [],
      reasons: [{ key: "recovery", label: "Recovery shot", value: "Prioritise getting back into play and safety; choose a safe escape line.", tone: "positive" }],
      status: "recovery-required",
    };
  }
  const greensideContext = lie === "bunker" || ((lie === "fairway" || lie === "rough") && effectiveDistanceM <= 100);
  if (greensideContext) {
    const greenside = greensideClubDecision(readings, bag || CLUBS, effectiveDistanceM);
    if (greenside) {
      const summary = clubSummary(readings, greenside.club);
      return {
        recommendedClub: greenside.club,
        targetDistanceM,
        effectiveDistanceM,
        lie,
        candidates: [{ club: greenside.club, ...(summary.typical !== undefined ? { carryM: summary.typical } : {}), lieSuitability: 1, utility: 1 }],
        reasons: [{ key: "short-game", label: "Reason", value: greenside.chipType ? "SW default for a short greenside shot" : "Pitching wedge for a longer greenside shot", tone: "positive" }],
        status: "recommended",
      };
    }
    return { targetDistanceM, effectiveDistanceM, lie, candidates: [], reasons: [{ key: "short-game", label: "Reason", value: "No suitable greenside wedge data available.", tone: "warning" }], status: "no-suitable-club" };
  }
  const candidates = [...new Set(bag || CLUBS)]
    .map((club): AdaptiveClubCandidate => {
      const summary = clubSummary(readings, club);
      const carry = summary.typical;
      const suitability = lieSuitability(club, lie);
      const onCourse = getOnCourseClubAdjustment(rounds, club, carry);
      const learned = getContextEvidence(rounds, {
        phase: lie === "tee" ? "tee" : "approach",
        club,
        distanceM: effectiveDistanceM,
        lie,
        ...learningContext,
      });
      const learnedWeight = learned.reduce((sum, item) => sum + item.weight, 0);
      const learnedPositive = learned.reduce((sum, item) => sum + (item.positive ? item.weight : 0), 0);
      const learnedNegative = learned.reduce((sum, item) => sum + (item.negative ? item.weight : 0), 0);
      const observationCount = learned.length;
      const contextualScore = observationCount >= 2 ? Math.max(-0.18, Math.min(0.18, ((learnedPositive - learnedNegative) / Math.max(learnedWeight, 1)) * Math.min(1, observationCount / 6))) : 0;
      const excluded = !carry || suitability === 0;
      if (excluded) return { club, carryM: carry, lieSuitability: suitability, excluded: true, exclusionReason: !carry ? "No carry data" : "Not suitable from this lie" };
      const gap = Math.abs(carry - (effectiveDistanceM + onCourse.adjustmentM));
      const fit = Math.max(0, 1 - gap / Math.max(effectiveDistanceM, 1));
      const playable = summary.playablePercentage === undefined ? 0.5 : summary.playablePercentage / 100;
      const severe = summary.severeMissPercentage === undefined ? 0.15 : summary.severeMissPercentage / 100;
      const reliability = Math.min(1, summary.readings.length / 10);
      const shortPreference = carry > effectiveDistanceM ? ADAPTIVE_CADDIE_V1.shortBias : 0;
      const utility = fit * ADAPTIVE_CADDIE_V1.distanceFitWeight + playable * ADAPTIVE_CADDIE_V1.playableWeight - severe * ADAPTIVE_CADDIE_V1.severeMissPenalty + reliability * ADAPTIVE_CADDIE_V1.reliabilityWeight + suitability * 0.15 - shortPreference + contextualScore;
      return { club, carryM: carry, distanceGapM: gap, distanceFitScore: fit, playableRate: playable, severeMissRate: severe, lieSuitability: suitability, reliabilityScore: reliability, utility, ...(onCourse.adjustmentM ? { adjustmentM: onCourse.adjustmentM } : {}) };
    });
  const usable = candidates.filter((candidate) => !candidate.excluded).sort((a, b) => (b.utility || -Infinity) - (a.utility || -Infinity));
  const best = usable[0];
  if (!best) return { targetDistanceM, effectiveDistanceM, lie, candidates, reasons: [], status: "no-suitable-club" };
  const reasons: CaddieReason[] = [];
  if (best.carryM !== undefined) reasons.push({ key: "adaptive-carry", label: "Carry", value: `${best.carryM}m carry`, tone: "positive" });
  if (best.playableRate !== undefined) reasons.push({ key: "adaptive-playable", label: "Playable", value: `${Math.round(best.playableRate * 100)}% playable`, tone: "positive" });
  if (best.severeMissRate !== undefined) reasons.push({ key: "adaptive-severe", label: "Severe miss", value: `${Math.round(best.severeMissRate * 100)}% severe miss`, tone: best.severeMissRate > 0.15 ? "warning" : "neutral" });
  reasons.push({ key: "adaptive-fit", label: "Reason", value: best.carryM && best.carryM < effectiveDistanceM ? "Best fit for playing distance" : "Best distance/risk balance", tone: "positive" });
  const adjustment = getOnCourseClubAdjustment(rounds, best.club, best.carryM);
  if (adjustment.adjustmentM) reasons.push({ key: "on-course-adjustment", label: "Recent rounds", value: adjustment.reason, tone: "neutral" });
  return { recommendedClub: best.club, targetDistanceM, effectiveDistanceM, lie, candidates, reasons, status: "recommended" };
}

export function isValidGolfShotContext(distanceM: number, officialHoleDistanceM = 0, gpsAccuracyM?: number) {
  if (!Number.isFinite(distanceM) || distanceM < 0) return false;
  if (gpsAccuracyM !== undefined && (!Number.isFinite(gpsAccuracyM) || gpsAccuracyM > 250)) return false;
  return distanceM <= Math.max(800, officialHoleDistanceM + 500);
}

export function safeRecoveryClub(readings: RangeReading[], bag?: ClubName[]) {
  return ["6i", "7i", "8i", "9i"].find((club) =>
    (bag || CLUBS).includes(club) && Boolean(clubSummary(readings, club).typical),
  );
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

export function formatShortDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    homeCourseId: undefined,
    homeCourseName: undefined,
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
    .slice()
    .sort((a, b) => (a.archivedAt || a.date).localeCompare(b.archivedAt || b.date))
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
  const learnedWeaknesses = new Map<string, { phase: ShotPhase; club?: ClubName; outcome: string; count: number; impact: number }>();
  buildShotEvidence(recent).forEach((shot) => {
    if (!shot.club || !shot.negative || shot.executionIssue || shot.startDistanceM === undefined) return;
    const bucket = Math.floor(shot.startDistanceM / 15) * 15;
    const key = `${shot.phase}|${shot.club}|${bucket}`;
    const current = learnedWeaknesses.get(key) || { phase: shot.phase, club: shot.club, outcome: `distance control from ${bucket}–${bucket + 15}m`, count: 0, impact: 0 };
    current.count += 1;
    current.impact += 1;
    learnedWeaknesses.set(key, current);
  });
  learnedWeaknesses.forEach((item, key) => {
    if (item.count < 3 || groups.has(key)) return;
    groups.set(key, item);
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
          .map((tag) => ({
            tag,
            score: hole.score,
            club: hole.shots?.find((shot) => legacyPhase[tag.category] === shot.phase)?.club,
          })),
      ),
    )
    .forEach(({ tag, score, club }) => {
      const phase = legacyPhase[tag.category];
      const key = `${phase}|${club || "legacy"}|${tag.outcome}`;
      const current = groups.get(key) || {
        phase,
        club,
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
        drill: issueLabel(item.phase, item.outcome, item.club),
        clubGroup: clubGroupForPractice(item.club, item.phase),
        phaseLabel: phaseLabelForPractice(item.phase),
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
        "MyCaddie will use your rounds and practice data to identify your highest-impact priorities.",
      priorities,
    };
  const top = priorities[0];
  return {
    text: `Work on ${top.club ? `${top.club} ` : ""}${top.outcome.toLowerCase()}.`,
    evidence: top.evidence,
    priorities,
  };
}
