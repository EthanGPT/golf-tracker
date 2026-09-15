import { describe, expect, it } from 'vitest'
import { CLUBS, DISTANCE_CLUBS, SEED_READINGS, categoryCounts, clubSummary, convertMetres, median, recommendation, roundTotal, seedData } from './domain'

describe('distance calculations', () => {
  const data = seedData()
  it('calculates the median and excludes mishits', () => {
    expect(median([1, 5, 3])).toBe(3)
    const readings = [...data.readings, { id: 'mishit', club: '6i' as const, distanceMetres: 200, mishit: true, sessionDate: '2026-09-14', createdAt: '2026-09-15' }]
    expect(clubSummary(readings, '6i').typical).toBe(150)
    expect(clubSummary(readings, '6i').max).toBe(160)
  })
  it.each([['6i', 150], ['7i', 140], ['8i', 136], ['9i', 114], ['PW', 95], ['SW', 85]] as const)('%s seed data has a %sm median', (club, expected) => expect(clubSummary(data.readings, club).typical).toBe(expected))
  it('converts metres to yards only for display', () => expect(convertMetres(100, 'yards')).toBe(109))
  it('keeps empty clubs empty in bag order', () => { expect(CLUBS.slice(0, 3)).toEqual(['Dr', '3W', '5W']); expect(CLUBS.slice(0, 3).every((club) => !clubSummary(data.readings, club).typical)).toBe(true) })
  it('starts the on-course distance list at the lowest iron', () => expect(DISTANCE_CLUBS).toEqual(['6i', '7i', '8i', '9i', 'PW', 'SW', 'Dr', '3W', '5W']))
  it('contains the requested seed readings', () => expect(SEED_READINGS).toHaveLength(6))
})

describe('round feedback', () => {
  const rounds = [{ id: 'r1', date: '2026-09-15', courseName: 'Hermanus Golf Club', totalScore: 45, overallNote: '', status: 'archived' as const, holes: [{ holeNumber: 1, score: 5, focusCategory: 'Approach' as const, wentRight: 'Good tempo', wentWrong: 'Missed green' }] }]
  it('totals scores', () => expect(roundTotal(rounds[0])).toBe(5))
  it('counts problem categories and explains recommendations', () => { expect(categoryCounts(rounds).Approach).toBe(1); expect(recommendation(rounds).text).toContain('Iron contact') })
})
