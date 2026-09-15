import { describe, expect, it } from 'vitest'
import { seedData } from './domain'
import { exportData, parseImport, validateImport } from './storage'

describe('database backup format', () => {
  it('exports and restores the complete versioned state', () => {
    const data = seedData()
    const restored = parseImport(exportData(data))
    expect(restored.schemaVersion).toBe(1)
    expect(restored.readings).toHaveLength(31)
    expect(restored.weeklyPlan.practiceAComplete).toBe(false)
  })
  it('rejects malformed imports', () => {
    expect(validateImport({})).toBe(false)
    expect(() => parseImport('{"data":{"schemaVersion":99}}')).toThrow()
  })
})
