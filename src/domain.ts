export const CLUBS = ['Dr', '3W', '5W', '6i', '7i', '8i', '9i', 'PW', 'SW'] as const
export const DISTANCE_CLUBS = ['6i', '7i', '8i', '9i', 'PW', 'SW', 'Dr', '3W', '5W'] as const
export type ClubName = typeof CLUBS[number]
export type FocusCategory = 'Tee shot' | 'Approach' | 'Short game' | 'Putting' | 'Course management'
export type Screen = 'today' | 'range' | 'distances' | 'round' | 'progress'

export type RangeReading = {
  id: string
  club: ClubName
  distanceMetres: number
  mishit: boolean
  sessionDate: string
  createdAt: string
}

export type RoundHole = {
  holeNumber: number
  score: number
  focusCategory: FocusCategory
  wentRight: string
  wentWrong: string
  tracking?: {
    samples: { latitude: number; longitude: number; accuracy: number; recordedAt: string }[]
    lastAccuracy?: number
  }
}

export type Round = {
  id: string
  date: string
  courseName: string
  totalScore?: number
  handicapIndex?: number
  overallNote: string
  status: 'in-progress' | 'archived'
  holes: RoundHole[]
  loop?: 'east' | 'north' | 'south'
  roundLength?: 9 | 18
  tee?: 'white' | 'yellow' | 'red'
  archivedAt?: string
}

export type WeeklyPlan = {
  weekStart: string
  practiceAComplete: boolean
  practiceBComplete: boolean
  roundComplete: boolean
}

export type AppData = {
  schemaVersion: number
  handicapHistory: { id: string; date: string; index: number; roundId?: string }[]
  readings: RangeReading[]
  rounds: Round[]
  weeklyPlan: WeeklyPlan
}

export const SEED_READINGS: Array<[ClubName, number[]]> = [
  ['6i', [142, 152, 150, 145, 160]],
  ['7i', [140, 140, 140, 145]],
  ['8i', [137, 138, 142, 135, 128, 130]],
  ['9i', [120, 110, 120, 115, 100, 112]],
  ['PW', [90, 98, 100, 95, 92]],
  ['SW', [80, 86, 88, 85, 80]],
]

export const CATEGORY_GUIDANCE: Record<FocusCategory, string> = {
  'Tee shot': 'Driver contact and fairway-finder practice',
  Approach: 'Iron contact and starting-line practice',
  'Short game': 'Chipping and pitching practice',
  Putting: 'Putting distance-control practice',
  'Course management': 'Conservative targets and club-selection practice',
}

export function median(values: number[]) {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function clubSummary(readings: RangeReading[], club: ClubName) {
  const usable = readings.filter((reading) => reading.club === club && !reading.mishit)
  const distances = usable.map((reading) => reading.distanceMetres)
  return {
    typical: median(distances),
    min: distances.length ? Math.min(...distances) : undefined,
    max: distances.length ? Math.max(...distances) : undefined,
    usableCount: distances.length,
    readings: readings.filter((reading) => reading.club === club).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

export function convertMetres(metres: number, units: 'metres' | 'yards') {
  return units === 'yards' ? Math.round(metres * 1.09361) : metres
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function startOfWeek(date = new Date()) {
  const value = new Date(date)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  return value.toISOString().slice(0, 10)
}

export function seedData(): AppData {
  const createdAt = '2026-09-14T08:00:00.000Z'
  const readings = SEED_READINGS.flatMap(([club, distances]) => distances.map((distanceMetres, index) => ({
    id: `seed-${club}-${index}`,
    club,
    distanceMetres,
    mishit: false,
    sessionDate: '2026-09-14',
    createdAt,
  })))
  return { schemaVersion: 1, handicapHistory: [{ id: 'seed-handicap', date: '2026-09-14', index: 16.5 }], readings, rounds: [], weeklyPlan: { weekStart: startOfWeek(), practiceAComplete: false, practiceBComplete: false, roundComplete: false } }
}

export function roundTotal(round: Round) {
  return round.holes.reduce((total, hole) => total + (hole.score || 0), 0)
}

export function categoryCounts(rounds: Round[]) {
  const counts = {} as Record<FocusCategory, number>
  rounds.flatMap((round) => round.holes).forEach((hole) => {
    if (hole.wentWrong.trim()) counts[hole.focusCategory] = (counts[hole.focusCategory] || 0) + 1
  })
  return counts
}

export function recommendation(rounds: Round[]) {
  const counts = categoryCounts(rounds)
  const [category, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || []
  if (!category || !count) return { text: 'Not enough round feedback yet to recommend a focus.', evidence: '' }
  return { text: CATEGORY_GUIDANCE[category as FocusCategory], evidence: `${category} was tagged as the problem ${count} time${count === 1 ? '' : 's'} in your archived feedback.` }
}
