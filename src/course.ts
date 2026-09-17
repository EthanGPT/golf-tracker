export type CourseLoop = 'east' | 'north' | 'south'
export type RoundLength = 9 | 18
export type Tee = 'white' | 'yellow' | 'red'
export type Coordinate = [number, number]
export type CourseTarget = { name: string; coordinate: Coordinate }
export type HoleGeometry = {
  tee?: Partial<Record<Tee, Coordinate>>
  green?: { front?: Coordinate; centre?: Coordinate; back?: Coordinate; polygon?: Coordinate[] }
  targets?: CourseTarget[]
}

// Official Hermanus sequence. Coordinates are deliberately kept separate: we will
// digitise tees/greens from the satellite view and improve them from played rounds.
export const HERMANUS_PARS = [4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4, 5] as const
export const HERMANUS_LOOPS: Record<CourseLoop, number[]> = {
  east: Array.from({ length: 18 }, (_, i) => i + 1),
  north: [...Array.from({ length: 9 }, (_, i) => i + 19), ...Array.from({ length: 9 }, (_, i) => i + 1)],
  south: [...Array.from({ length: 9 }, (_, i) => i + 10), ...Array.from({ length: 9 }, (_, i) => i + 19)],
}
export const loopLabel = (loop: CourseLoop) => ({ east: 'East · 1–18', north: 'North · 19–27 + 1–9', south: 'South · 10–18 + 19–27' }[loop])
export const holePar = (hole: number) => HERMANUS_PARS[hole - 1] || 4

// Deliberately empty until each hole is checked against current imagery. This
// prevents the app from presenting made-up GPS distances as if they were exact.
export const HERMANUS_GEOMETRY: Record<number, HoleGeometry> = {}
