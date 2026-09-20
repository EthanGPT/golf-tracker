export type CourseLoop = "east" | "north" | "south";
export type RoundLength = 9 | 18;
export type Tee = "white" | "yellow" | "red";
export type Coordinate = [number, number];
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
  east: Array.from({ length: 18 }, (_, i) => i + 1),
  north: [
    ...Array.from({ length: 9 }, (_, i) => i + 19),
    ...Array.from({ length: 9 }, (_, i) => i + 1),
  ],
  south: [
    ...Array.from({ length: 9 }, (_, i) => i + 10),
    ...Array.from({ length: 9 }, (_, i) => i + 19),
  ],
};
export const loopLabel = (loop: CourseLoop) =>
  ({
    east: "East · 1–18",
    north: "North · 19–27 + 1–9",
    south: "South · 10–18 + 19–27",
  })[loop];
export const holePar = (hole: number) => HERMANUS_PARS[hole - 1] || 4;
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
export const holeDistance = (hole: number, tee: Tee = "white") =>
  HERMANUS_TEE_DISTANCES[tee][hole - 1] || 0;

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
