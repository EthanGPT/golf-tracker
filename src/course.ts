import { mergeImportedGeometry, readCachedCourse } from "./courseIngestion";
import { HERMANUS_IMPORTED_GEOMETRY } from "./hermanusImportedGeometry";
import { HERMANUS_PROVISUALIZER_GEOMETRY } from "./hermanusProVisualizerGeometry";

export type CourseLoop = "east" | "north" | "south";
export type RoundLength = 9 | 18 | 27;
/** Tee and loop IDs are course data, not a global enum. */
export type Tee = string;
export type Coordinate = [number, number];
export type LatLng = { latitude: number; longitude: number };
export type TeeDefinition = {
  id: string;
  name: string;
  shortName?: string;
  colour?: string;
};
export type TeeBox = { teeId: string; distanceM: number; position?: LatLng };
export type GreenGeometry = {
  front?: LatLng;
  centre?: LatLng;
  back?: LatLng;
  polygon?: LatLng[];
};
export type HazardType =
  "bunker" | "water" | "penalty-area" | "out-of-bounds" | "trees" | "other";
export type HazardDefinition = {
  id: string;
  name?: string;
  type: HazardType;
  position?: LatLng;
  polygon?: LatLng[];
  notes?: string;
};
export type HoleCentreline = LatLng[];
export type TeeTargetKind = "tee-landing" | "fairway" | "dogleg" | "layup" | "green" | "safe";
export type VerifiedCourseTarget = {
  id: string;
  name: string;
  position: LatLng;
  kind?: TeeTargetKind;
  source?: string;
  verified?: boolean;
};
export type HoleDefinition = {
  number: number;
  par: number;
  teeBoxes: TeeBox[];
  green?: GreenGeometry;
  hazards?: HazardDefinition[];
  targets?: VerifiedCourseTarget[];
  centreline?: HoleCentreline;
  diagram?: string;
};
export type CourseLoopDefinition = {
  id: string;
  name: string;
  holeNumbers: number[];
};
export type CourseDefinition = {
  id: string;
  name: string;
  shortName?: string;
  locationName?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  holes: HoleDefinition[];
  tees: TeeDefinition[];
  loops?: CourseLoopDefinition[];
};
export type CourseTarget = { name: string; coordinate: Coordinate };
export type HoleGeometry = {
  tee?: Partial<Record<Tee, Coordinate>>;
  green?: {
    front?: Coordinate;
    centre?: Coordinate;
    back?: Coordinate;
    polygon?: Coordinate[];
  };
  targets?: CourseTarget[];
  centreline?: Coordinate[];
  hazards?: HazardDefinition[];
};
export type CourseLocation = { latitude: number; longitude: number };
export const HERMANUS_LOCATION: CourseLocation = {
  latitude: -34.417,
  longitude: 19.245,
};

// Official Hermanus sequence. Coordinates are deliberately kept separate: we will
// digitise tees/greens from the satellite view and improve them from played rounds.
export const HERMANUS_PARS = [
  4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4,
  5,
] as const;
export const HERMANUS_LOOPS: Record<CourseLoop, number[]> = {
  east: [
    ...Array.from({ length: 18 }, (_, i) => i + 1),
    ...Array.from({ length: 9 }, (_, i) => i + 19),
  ],
  north: [
    ...Array.from({ length: 9 }, (_, i) => i + 19),
    ...Array.from({ length: 18 }, (_, i) => i + 1),
  ],
  south: [
    ...Array.from({ length: 9 }, (_, i) => i + 10),
    ...Array.from({ length: 9 }, (_, i) => i + 19),
    ...Array.from({ length: 9 }, (_, i) => i + 1),
  ],
};
export const loopLabel = (loop: CourseLoop, length: 9 | 18 | 27 = 27) => {
  const sequence = HERMANUS_LOOPS[loop].slice(0, length);
  const ranges: string[] = [];
  let start = sequence[0];
  let previous = sequence[0];
  sequence.slice(1).forEach((hole) => {
    if (hole === previous + 1) previous = hole;
    else {
      ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
      start = previous = hole;
    }
  });
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return `${loop[0].toUpperCase()}${loop.slice(1)} · ${ranges.join(" + ")}`;
};
export const holePar = (hole: number, courseId = "hermanus-golf-club") =>
  COURSES[courseId]?.holes.find((item) => item.number === hole)?.par || HERMANUS_PARS[hole - 1] || 4;
// White-tee distances from the official Hermanus Golf Club hole-by-hole course guide.
export const HERMANUS_WHITE_DISTANCES = [
  312, 460, 394, 146, 357, 480, 371, 329, 136, 332, 433, 360, 150, 320, 327,
  155, 446, 283, 398, 347, 124, 476, 329, 139, 311, 302, 488,
] as const;
export const HERMANUS_TEE_DISTANCES = {
  yellow: [
    326, 466, 412, 169, 363, 493, 394, 352, 144, 348, 468, 384, 158, 326, 337,
    163, 464, 299, 425, 361, 142, 489, 343, 148, 342, 320, 531,
  ],
  white: HERMANUS_WHITE_DISTANCES,
  red: [
    270, 379, 338, 114, 283, 398, 320, 284, 110, 302, 375, 297, 110, 270, 283,
    114, 380, 246, 329, 290, 96, 425, 261, 110, 252, 251, 434,
  ],
} as const;
export const HERMANUS_YELLOW_DISTANCES = HERMANUS_TEE_DISTANCES.yellow;
export const HERMANUS_RED_DISTANCES = HERMANUS_TEE_DISTANCES.red;
export const holeDistance = (hole: number, tee: Tee = "white", courseId = "hermanus-golf-club") => {
  const course = COURSES[courseId];
  return course?.holes.find((item) => item.number === hole)?.teeBoxes.find((box) => box.teeId === tee)?.distanceM || 0;
};

// Deliberately empty until each hole is checked against current imagery. This
// prevents the app from presenting made-up GPS distances as if they were exact.
export const HERMANUS_GEOMETRY: Record<number, HoleGeometry> = {};

export const HERMANUS_HOLE_DIAGRAMS: Record<number, string> = {
  1: "⛳\n  \\\n   \\  🟡\n    \\\n     \\\n   🟡 \\  \n       \\\n        │\n        │\n       🟩",
  2: "⛳\n│\n│  🟡\n│\n🟡\n│\n│\n🟩",
  3: "⛳  🟡\n│\n│\n│\n│\n🟩",
  4: "    ⛳\n   /\n  /\n /  🟡\n/\n│\n🟩",
  5: "⛳\n│\n│  🔵\n│\n│\n🟩",
  6: "⛳  🟡\n│\n│  🟡\n│\n🟩",
  7: "⛳\n│\n│\n🟡\n│\n│\n🟩",
  8: "⛳  🟡\n│\n│  🟡\n│\n🟩",
  9: "⛳\n│  \\\n│   \\  🟡\n│    \\\n🟡   │\n     🟩",
  10: "⛳\n│\n│  🟡\n│\n🟡\n│\n│\n🟩",
  11: "⛳  🟡\n│\n│\n│\n│\n🟩",
  12: "  ⛳\n /\n/  🟡\n\\\n \\  🟡\n  \\\n  │\n  🟩",
  13: "⛳\n│  🟡\n│\n│  🔵\n│\n🟩",
  14: "⛳  🟡\n│\n│  🟡\n│\n🟩",
  15: "    ⛳\n   /\n  /  🟡\n /\n/  🟡\n│\n🟩",
  16: "⛳\n│\n│  🔵\n│\n│\n🟩",
  17: "⛳  🟡\n│\n│\n│\n│\n🟩",
  18: "⛳\n│\n│  🟡\n│\n🟡\n│\n│\n🟩",
  19: "⛳  🟡\n│\n│  🟡\n│\n🟩",
  20: "⛳\n  \\\n   \\  🟡\n    \\\n     \\\n   🟡 \\  \n       \\\n        │\n        │\n       🟩",
  21: "⛳  🟡\n│\n│\n│\n│\n🟩",
  22: "⛳\n│\n│  🔵\n│\n🟡\n│\n│\n🟩",
  23: "    ⛳\n   /\n  /  🟡\n /\n/\n│\n🟩",
  24: "⛳  🟡\n│\n│  🟡\n│\n🟩",
  25: "⛳\n│\n│  🟡\n│\n│\n🟩",
  26: "⛳  🟡\n│\n│  🔵\n│\n🟩",
  27: "⛳\n│  \\\n│   \\  🟡\n│    \\\n🟡   │\n     🟩",
};

const hermanusTeeDefinitions: TeeDefinition[] = [
  { id: "yellow", name: "Yellow", shortName: "Yellow", colour: "yellow" },
  { id: "white", name: "White", shortName: "White", colour: "white" },
  { id: "red", name: "Red", shortName: "Red", colour: "red" },
];

const hermanusHoles: HoleDefinition[] = HERMANUS_PARS.map((par, index) => {
  const number = index + 1;
  return {
    number,
    par,
    teeBoxes: hermanusTeeDefinitions.map((tee) => ({
      teeId: tee.id,
      distanceM:
        HERMANUS_TEE_DISTANCES[tee.id as keyof typeof HERMANUS_TEE_DISTANCES][
          index
        ],
    })),
    // Geometry is intentionally absent until verified course data is available.
    diagram: HERMANUS_HOLE_DIAGRAMS[number],
  };
});

export const HERMANUS_COURSE: CourseDefinition = {
  id: "hermanus-golf-club",
  name: "Hermanus Golf Club",
  shortName: "Hermanus",
  locationName: "Hermanus, South Africa",
  latitude: HERMANUS_LOCATION.latitude,
  longitude: HERMANUS_LOCATION.longitude,
  timezone: "Africa/Johannesburg",
  tees: hermanusTeeDefinitions,
  holes: hermanusHoles,
  loops: [
    { id: "east", name: "East · 1–18", holeNumbers: HERMANUS_LOOPS.east },
    {
      id: "north",
      name: "North · 19–27 + 1–9",
      holeNumbers: HERMANUS_LOOPS.north,
    },
    {
      id: "south",
      name: "South · 10–18 + 19–27",
      holeNumbers: HERMANUS_LOOPS.south,
    },
  ],
};

const yardsToMetres = (yards: readonly number[]) => yards.map((yardsValue) => Math.round(yardsValue * 0.9144));
const ARABELLA_PARS = [4, 5, 4, 4, 3, 4, 3, 5, 4, 4, 4, 4, 5, 3, 4, 4, 3, 5] as const;
const ARABELLA_YARDAGES = {
  yellow: [336, 457, 444, 400, 153, 386, 181, 499, 285, 353, 367, 327, 489, 170, 384, 322, 167, 502],
  white: [307, 438, 417, 378, 147, 355, 170, 476, 251, 340, 352, 316, 443, 130, 369, 294, 159, 471],
  blue: [280, 412, 389, 369, 138, 330, 151, 441, 208, 324, 340, 302, 421, 119, 343, 267, 140, 432],
  red: [234, 383, 357, 319, 129, 311, 117, 435, 203, 284, 307, 280, 412, 99, 339, 251, 136, 412],
} as const;
const arabellaTeeDefinitions: TeeDefinition[] = [
  { id: "yellow", name: "Yellow", shortName: "Yellow", colour: "yellow" },
  { id: "white", name: "White", shortName: "White", colour: "white" },
  { id: "blue", name: "Blue", shortName: "Blue", colour: "blue" },
  { id: "red", name: "Red", shortName: "Red", colour: "red" },
];
const arabellaHoles: HoleDefinition[] = ARABELLA_PARS.map((par, index) => ({
  number: index + 1,
  par,
  teeBoxes: arabellaTeeDefinitions.map((tee) => ({ teeId: tee.id, distanceM: yardsToMetres(ARABELLA_YARDAGES[tee.id as keyof typeof ARABELLA_YARDAGES])[index] })),
}));
export const ARABELLA_COURSE: CourseDefinition = {
  id: "arabella-golf-club",
  name: "Arabella Golf Club",
  shortName: "Arabella",
  locationName: "Kleinmond, Western Cape",
  latitude: -34.317069,
  longitude: 19.133842,
  timezone: "Africa/Johannesburg",
  tees: arabellaTeeDefinitions,
  holes: arabellaHoles,
};

const scorecardCourse = (input: { id: string; name: string; shortName: string; locationName: string; latitude: number; longitude: number; tees: TeeDefinition[]; pars: readonly number[]; distances: Record<string, readonly number[]> }): CourseDefinition => ({
  ...input,
  timezone: "Africa/Johannesburg",
  holes: input.pars.map((par, index) => ({ number: index + 1, par, teeBoxes: input.tees.map((tee) => ({ teeId: tee.id, distanceM: input.distances[tee.id][index] })) })),
});
const zimbaliTees: TeeDefinition[] = [
  { id: "yellow", name: "Yellow", shortName: "Yellow", colour: "yellow" },
  { id: "white", name: "White", shortName: "White", colour: "white" },
  { id: "blue", name: "Blue", shortName: "Blue", colour: "blue" },
  { id: "red", name: "Red", shortName: "Red", colour: "red" },
];
export const ZIMBALI_LAKES_COURSE = scorecardCourse({
  id: "zimbali-lakes",
  name: "Zimbali Lakes",
  shortName: "Zimbali Lakes",
  locationName: "Ballito, KwaZulu-Natal",
  latitude: -29.538,
  longitude: 31.204,
  tees: zimbaliTees,
  pars: [4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 4, 5, 3, 4, 5, 3, 4],
  distances: {
    yellow: yardsToMetres([381, 329, 478, 409, 191, 456, 361, 370, 219, 369, 191, 526, 377, 159, 357, 370, 441, 483]),
    white: yardsToMetres([365, 304, 457, 398, 167, 446, 355, 349, 193, 349, 167, 500, 375, 135, 356, 344, 416, 415]),
    blue: yardsToMetres([330, 280, 434, 373, 145, 420, 330, 320, 164, 314, 142, 475, 373, 126, 316, 318, 380, 386]),
    red: yardsToMetres([290, 242, 375, 328, 145, 386, 237, 290, 160, 290, 138, 410, 326, 109, 296, 235, 330, 286]),
  },
});
const simbithiTees: TeeDefinition[] = [
  { id: "yellow", name: "Yellow", shortName: "Yellow", colour: "yellow" },
  { id: "white", name: "White", shortName: "White", colour: "white" },
  { id: "blue", name: "Blue", shortName: "Blue", colour: "blue" },
];
const simbithiBlue = yardsToMetres([105, 108, 313, 123, 163, 111, 249, 153, 154, 152, 142, 434, 149, 360, 174, 93, 76, 340]);
const simbithiWhite = yardsToMetres([107, 123, 325, 131, 174, 119, 264, 156, 160, 167, 147, 472, 150, 384, 192, 115, 82, 388]);
const simbithiYellow = yardsToMetres([117, 148, 341, 143, 195, 140, 272, 158, 164, 174, 160, 481, 161, 414, 205, 129, 87, 404]);
export const SIMBITHI_COURSE = scorecardCourse({
  id: "simbithi-country-club",
  name: "Simbithi Country Club",
  shortName: "Simbithi",
  locationName: "Ballito, KwaZulu-Natal",
  latitude: -29.505,
  longitude: 31.216,
  tees: simbithiTees,
  pars: [3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 5, 3, 4, 3, 3, 3, 4],
  distances: { yellow: simbithiYellow, white: simbithiWhite, blue: simbithiBlue },
});
const hartfordTees: TeeDefinition[] = [
  { id: "white", name: "White", shortName: "White", colour: "white" },
  { id: "green", name: "Green", shortName: "Green", colour: "green" },
  { id: "orange", name: "Orange", shortName: "Orange", colour: "orange" },
  { id: "purple", name: "Purple", shortName: "Purple", colour: "purple" },
  { id: "blue", name: "Blue", shortName: "Blue", colour: "blue" },
];
export const HARTFORD_COURSE = scorecardCourse({
  id: "hartford-golf-club",
  name: "Hartford Golf Club",
  shortName: "Hartford",
  locationName: "Northwich, Cheshire, England",
  latitude: 53.242,
  longitude: -2.521,
  tees: hartfordTees,
  // Hartford is a 9-hole layout played twice: the second nine has different
  // tee yardages, but the same hole pars as the first nine.
  pars: [5, 3, 5, 4, 3, 4, 3, 4, 4, 5, 3, 5, 4, 3, 4, 3, 4, 4],
  distances: {
    white: yardsToMetres([482, 173, 503, 255, 177, 259, 187, 349, 381, 399, 173, 503, 255, 166, 259, 187, 354, 381]),
    green: yardsToMetres([466, 165, 488, 246, 125, 247, 172, 340, 353, 466, 165, 488, 246, 125, 247, 172, 340, 353]),
    orange: yardsToMetres([400, 154, 397, 236, 127, 222, 160, 320, 308, 343, 154, 397, 246, 127, 222, 160, 320, 308]),
    purple: yardsToMetres([343, 103, 159, 208, 104, 222, 145, 235, 240, 343, 103, 159, 208, 104, 222, 145, 235, 240]),
    blue: yardsToMetres([212, 103, 159, 208, 104, 140, 88, 186, 240, 212, 103, 159, 208, 104, 140, 88, 186, 240]),
  },
});

export const COURSES: Record<string, CourseDefinition> = {
  [HERMANUS_COURSE.id]: HERMANUS_COURSE,
  [ARABELLA_COURSE.id]: ARABELLA_COURSE,
  [ZIMBALI_LAKES_COURSE.id]: ZIMBALI_LAKES_COURSE,
  [SIMBITHI_COURSE.id]: SIMBITHI_COURSE,
  [HARTFORD_COURSE.id]: HARTFORD_COURSE,
};

export function getRuntimeCourse(courseId: string): CourseDefinition | undefined {
  const course = COURSES[courseId];
  if (!course) return undefined;
  const bundled = courseId === "hermanus-golf-club"
    ? {
        ...course,
        holes: course.holes.map((hole) => ({
          ...hole,
          green: hole.green || HERMANUS_IMPORTED_GEOMETRY[hole.number],
          centreline: hole.centreline || HERMANUS_PROVISUALIZER_GEOMETRY[hole.number]?.centreline,
          targets: hole.targets || HERMANUS_PROVISUALIZER_GEOMETRY[hole.number]?.targets.map((position, index) => ({
            id: `provisualizer-target-${hole.number}-${index + 1}`,
            name: `Route target ${index + 1}`,
            position,
            kind: "fairway" as const,
            source: HERMANUS_PROVISUALIZER_GEOMETRY[hole.number].source,
            verified: false,
          })),
          teeBoxes: hole.teeBoxes.map((tee) => tee.teeId === "white"
            ? { ...tee, position: tee.position || HERMANUS_PROVISUALIZER_GEOMETRY[hole.number]?.tee }
            : tee),
        })),
      }
    : course;
  const cached = readCachedCourse(courseId);
  return cached ? mergeImportedGeometry(bundled, cached) : bundled;
}

export function getCourse(courseId: string): CourseDefinition | undefined {
  return getRuntimeCourse(courseId);
}

export function getCourseHole(courseId: string, holeNumber: number) {
  return getRuntimeCourse(courseId)?.holes.find((hole) => hole.number === holeNumber);
}

export function getRuntimeCourseHole(courseId: string, holeNumber: number) {
  return getRuntimeCourse(courseId)?.holes.find((hole) => hole.number === holeNumber);
}

export function getCourseTee(courseId: string, teeId: string) {
  return getCourse(courseId)?.tees.find((tee) => tee.id === teeId);
}

export function getHoleDistance(
  courseId: string,
  holeNumber: number,
  teeId: string,
) {
  return (
    getCourseHole(courseId, holeNumber)?.teeBoxes.find(
      (tee) => tee.teeId === teeId,
    )?.distanceM || 0
  );
}

export function getCourseLoops(courseId: string) {
  return getCourse(courseId)?.loops || [];
}

export function getCourseTees(courseId: string) {
  return getCourse(courseId)?.tees || [];
}

export function getHoleTarget(courseId: string, holeNumber: number) {
  const hole = getRuntimeCourseHole(courseId, holeNumber);
  if (hole?.green?.centre)
    return { position: hole.green.centre, targetType: "green-centre" as const };
  const target = hole?.targets?.[0];
  if (target)
    return { position: target.position, targetType: "target" as const };
  return undefined;
}

export function getHoleTeeOrigin(courseId: string, holeNumber: number, teeId = "white") {
  return getRuntimeCourseHole(courseId, holeNumber)?.teeBoxes.find((tee) => tee.teeId === teeId)?.position;
}

export function getTeeTarget(courseId: string, holeNumber: number, teeId = "white") {
  const hole = getRuntimeCourseHole(courseId, holeNumber);
  const teeOrigin = getHoleTeeOrigin(courseId, holeNumber, teeId);
  if (!hole || !teeOrigin) return undefined;
  const selected = selectTeeTarget({ hole, teeCoordinate: teeOrigin });
  if (selected) return { position: selected.targetCoordinate, targetType: "target" as const, name: selected.targetName };
  return hole.green?.centre
    ? { position: hole.green.centre, targetType: "green-centre" as const, name: "Green centre" }
    : undefined;
}

export type TeeTargetSelection = {
  targetCoordinate: LatLng;
  targetName: string;
  targetDistanceMetres: number;
  source: string;
  reason: string;
};

export type TeeLandingCandidate = {
  id: string;
  position: LatLng;
  distanceFromTeeM: number;
  remainingToGreenM?: number;
  bearingDeg: number;
  hazardClearanceM: number;
  routeFraction: number;
};

export function selectReachableTeeLandingCandidate(
  candidates: TeeLandingCandidate[],
  clubCarryM: number,
  effectiveDistance: (candidate: TeeLandingCandidate) => number,
  toleranceM = 15,
) {
  return candidates
    .map((candidate) => ({ candidate, effectiveDistanceM: effectiveDistance(candidate) }))
    .filter(({ effectiveDistanceM }) => Math.abs(clubCarryM - effectiveDistanceM) <= toleranceM)
    .sort((a, b) =>
      b.candidate.hazardClearanceM - a.candidate.hazardClearanceM ||
      b.candidate.distanceFromTeeM - a.candidate.distanceFromTeeM ||
      a.candidate.id.localeCompare(b.candidate.id),
    )[0];
}

const bearingDegrees = (from: LatLng, to: LatLng) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const degrees = (value: number) => (value * 180) / Math.PI;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const dLon = radians(to.longitude - from.longitude);
  return (degrees(Math.atan2(Math.sin(dLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon))) + 360) % 360;
};

/**
 * Generates route-following landing points. It deliberately requires a
 * verified tee and centreline; a straight tee-to-green guess is not course
 * geometry and must never be silently presented as one.
 */
export function generateTeeLandingCandidates(input: {
  teeOrigin?: LatLng;
  centreline?: LatLng[];
  hazards?: HazardDefinition[];
  greenCentre?: LatLng;
  intervalM?: number;
  maxDistanceM?: number;
}): TeeLandingCandidate[] {
  const { teeOrigin, centreline, hazards = [], greenCentre } = input;
  if (!teeOrigin || !centreline || centreline.length < 2) return [];
  const route = [teeOrigin, ...centreline];
  const candidates: TeeLandingCandidate[] = [];
  let travelled = 0;
  const interval = input.intervalM || 12;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const segment = distanceMetres(start, end);
    const steps = Math.max(1, Math.floor(segment / interval));
    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      const position = {
        latitude: start.latitude + (end.latitude - start.latitude) * fraction,
        longitude: start.longitude + (end.longitude - start.longitude) * fraction,
      };
      const distanceFromTeeM = travelled + segment * fraction;
      if (input.maxDistanceM !== undefined && distanceFromTeeM > input.maxDistanceM) continue;
      const hazardClearanceM = hazards.length
        ? Math.min(...hazards.map((hazard) => hazard.position ? distanceMetres(position, hazard.position) : Infinity))
        : Infinity;
      candidates.push({
        id: `route-${candidates.length + 1}`,
        position,
        distanceFromTeeM: Math.round(distanceFromTeeM),
        remainingToGreenM: greenCentre ? Math.round(distanceMetres(position, greenCentre)) : undefined,
        bearingDeg: Math.round(bearingDegrees(start, end)),
        hazardClearanceM: Math.round(hazardClearanceM),
        routeFraction: distanceFromTeeM / Math.max(distanceMetres(teeOrigin, route[route.length - 1]), 1),
      });
    }
    travelled += segment;
  }
  return candidates;
}

const distanceMetres = (a: LatLng, b: LatLng) => {
  const radius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

/** Selects a verified landing/aim target only; it never chooses a club. */
export function selectTeeTarget(input: {
  hole: HoleDefinition;
  teeCoordinate?: LatLng;
}): TeeTargetSelection | undefined {
  if (!input.teeCoordinate) return undefined;
  const explicit = input.hole.targets?.find((target) =>
    (target.verified || target.source === "provisualizer-kml") && target.kind !== "green",
  );
  if (explicit)
    return {
      targetCoordinate: explicit.position,
      targetName: explicit.name,
      targetDistanceMetres: Math.round(distanceMetres(input.teeCoordinate, explicit.position)),
      source: explicit.source || "verified-course-target",
      reason: "Verified tee landing target",
    };
  if (input.hole.par === 3 && input.hole.green?.centre)
    return {
      targetCoordinate: input.hole.green.centre,
      targetName: "Green centre",
      targetDistanceMetres: Math.round(distanceMetres(input.teeCoordinate, input.hole.green.centre)),
      source: "verified-green-centre",
      reason: "Par 3 green-centre target",
    };
  return undefined;
}

export type CourseGeometryValidation = {
  mappedGreenCentres: number;
  valid: boolean;
  duplicateGreenCentres: number;
};

/** Broad sanity check only; it does not claim that a coordinate is verified. */
export function validateCourseGeometry(
  course: CourseDefinition,
): CourseGeometryValidation {
  const centres = course.holes
    .map((hole) => hole.green?.centre)
    .filter(Boolean) as LatLng[];
  const duplicateGreenCentres =
    centres.length -
    new Set(
      centres.map(
        (point) => `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`,
      ),
    ).size;
  const valid = centres.every(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= course.latitude - 0.1 &&
      point.latitude <= course.latitude + 0.1 &&
      point.longitude >= course.longitude - 0.1 &&
      point.longitude <= course.longitude + 0.1,
  );
  return { mappedGreenCentres: centres.length, valid, duplicateGreenCentres };
}
