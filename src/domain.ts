export const CLUBS = ['Dr', '3W', '4W-Hybrid', '6i', '7i', '8i', '9i', 'PW', 'SW'] as const
export const DISTANCE_CLUBS = ['6i', '7i', '8i', '9i', 'PW', 'SW', 'Dr', '3W', '4W-Hybrid'] as const
export type ClubName = typeof CLUBS[number]
export type FocusCategory = 'Tee shot' | 'Approach' | 'Short game' | 'Putting' | 'Course management'
export type RoundCategory = 'drive' | 'wood' | 'iron' | 'chip' | 'putt'
export type RoundTag = { category: RoundCategory; outcome: string; type: 'went-right' | 'went-wrong' }
export type Screen = 'today' | 'range' | 'distances' | 'round' | 'progress'

export type RangeReading = {
  id: string
  club: ClubName
  distanceMetres: number
  mishit: boolean
  playable?: boolean
  severeMiss?: boolean
  sessionDate: string
  createdAt: string
}

export type RoundHole = {
  holeNumber: number
  score: number
  focusCategory: FocusCategory
  wentRight: string
  wentWrong: string
  tags?: RoundTag[]
  note?: string
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
  weeklyHistory?: WeeklyPlan[]
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
  const usable = readings.filter((reading) => reading.club === club && !reading.severeMiss)
  const distances = usable.map((reading) => reading.distanceMetres)
  return {
    typical: median(distances),
    min: distances.length ? Math.min(...distances) : undefined,
    max: distances.length ? Math.max(...distances) : undefined,
    usableCount: distances.length,
    playableCount: readings.filter((reading) => reading.club === club && reading.playable !== false).length,
    playablePercentage: readings.filter((reading) => reading.club === club).length ? Math.round(readings.filter((reading) => reading.club === club && reading.playable !== false).length / readings.filter((reading) => reading.club === club).length * 100) : undefined,
    severeMissPercentage: readings.filter((reading) => reading.club === club).length ? Math.round(readings.filter((reading) => reading.club === club && reading.severeMiss === true).length / readings.filter((reading) => reading.club === club).length * 100) : undefined,
    readings: readings.filter((reading) => reading.club === club).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

export function caddiePlan(readings: RangeReading[], par: number, targetDistance: number) {
  const clubs = CLUBS.map((club) => ({ club, summary: clubSummary(readings, club) })).filter(({ summary }) => summary.typical)
  if (!clubs.length) return undefined
  const stats = clubs.map(({ club, summary }) => {
    const clubReadings = readings.filter((reading) => reading.club === club)
    const recent = clubReadings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
    const rate = (items: RangeReading[], key: 'playable' | 'severeMiss', inverse = false) => items.length ? items.filter((item) => inverse ? item[key] !== true : item[key] === true || (key === 'playable' && item[key] === undefined)).length / items.length : 0
    const playable = rate(clubReadings, 'playable') * 0.7 + (recent.length >= 5 ? rate(recent, 'playable') : rate(clubReadings, 'playable')) * 0.3
    const severe = rate(clubReadings, 'severeMiss') * 0.7 + (recent.length >= 5 ? rate(recent, 'severeMiss') : rate(clubReadings, 'severeMiss')) * 0.3
    return { club, carry: summary.typical!, playable, severe }
  }).sort((a, b) => b.carry - a.carry)
  const teePool = stats.filter((item) => ['Dr', '3W', '4W-Hybrid'].includes(item.club))
  // Maximise progress while heavily discounting clubs that bring a ball out of play.
  // Severe-miss risk is squared so it outweighs small carry or playable-rate gains.
  const teeScore = (item: typeof stats[number]) => item.carry * (1 - item.severe) ** 2 * (0.85 + item.playable * 0.15)
  const tee = (teePool.length ? teePool : stats).slice().sort((a, b) => teeScore(b) - teeScore(a))[0]
  // Driver and 3W are tee clubs. 4W-Hybrid remains available from the fairway.
  const fairwayClubs = stats.filter((item) => !['Dr', '3W'].includes(item.club))
  const sequence: typeof stats = []
  let remaining = targetDistance
  if (par === 3) sequence.push(stats.slice().sort((a, b) => Math.abs(a.carry - targetDistance) - Math.abs(b.carry - targetDistance))[0])
  else {
    sequence.push(tee); remaining -= tee.carry
    if (par === 5 && remaining > 25) {
      const layup = fairwayClubs.filter((item) => item.club !== tee.club && item.carry <= remaining).sort((a, b) => b.carry - a.carry)[0]
      if (layup) { sequence.push(layup); remaining -= layup.carry }
    }
    const approach = fairwayClubs.filter((item) => !sequence.some((shot) => shot.club === item.club)).sort((a, b) => Math.abs(remaining - a.carry) - Math.abs(remaining - b.carry))[0]
    if (approach) sequence.push(approach)
  }
  return { tee, sequence }
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
    playable: true,
    sessionDate: '2026-09-14',
    createdAt,
  })))
  return { schemaVersion: 1, handicapHistory: [{ id: 'seed-handicap', date: '2026-09-14', index: 16.5 }], readings, rounds: [], weeklyPlan: { weekStart: startOfWeek(), practiceAComplete: false, practiceBComplete: false, roundComplete: false }, weeklyHistory: [] }
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
  const recent = rounds.filter((round) => round.status === 'archived').slice(-3)
  const problems = recent.flatMap((round) => round.holes.map((hole) => (hole.tags || []).filter((tag) => tag.type === 'went-wrong'))).filter((tags) => tags.length)
  if (problems.length < 2) {
    return { text: 'Not enough repeated feedback yet.', evidence: 'Complete more rounds using the quick tags to reveal a reliable pattern.' }
  }
  const groups = problems.reduce<Record<string, { count: number; outcomes: Record<string, number> }>>((all, tags) => { const categories = new Set(tags.map((tag) => tag.category)); categories.forEach((category) => { const group = all[category] || { count: 0, outcomes: {} }; group.count += 1; tags.filter((tag) => tag.category === category).forEach((tag) => { group.outcomes[tag.outcome] = (group.outcomes[tag.outcome] || 0) + 1 }); all[category] = group }); return all }, {})
  const [category, group] = Object.entries(groups).sort((a, b) => b[1].count - a[1].count)[0]
  const [outcome, outcomeCount] = Object.entries(group.outcomes).sort((a, b) => b[1] - a[1])[0]
  const label = category[0].toUpperCase() + category.slice(1)
  const focus = category === 'drive' ? 'contact and finding playable fairways' : category === 'iron' ? 'distance control' : category === 'putt' ? 'green reading and speed' : `${category} consistency`
  return { text: `${label} is the main leak right now.`, evidence: `You recorded ${outcomeCount} ${outcome.toLowerCase()} problem${outcomeCount === 1 ? '' : 's'} across your last ${recent.length} rounds. Focus your next practice on ${focus}.` }
}
