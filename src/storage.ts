import { seedData } from './domain'
import type { AppData } from './domain'

const STORAGE_KEY = 'golf-tracker-db-v1'
const DB_NAME = 'golf-tracker'
const STORE_NAME = 'app'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function localLoad(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : seedData()
  } catch {
    return seedData()
  }
}

function localSave(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function loadData(): Promise<AppData> {
  if (!('indexedDB' in window)) return localLoad()
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => {
      const transaction = request.result.transaction(STORE_NAME, 'readonly')
      const read = transaction.objectStore(STORE_NAME).get('state')
      read.onsuccess = () => resolve(read.result ? clone(read.result) : seedData())
      read.onerror = () => resolve(localLoad())
    }
    request.onerror = () => resolve(localLoad())
  })
}

export async function saveData(data: AppData) {
  localSave(data)
  if (!('indexedDB' in window)) return
  await new Promise<void>((resolve) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onsuccess = () => {
      const transaction = request.result.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(clone(data), 'state')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    }
    request.onerror = () => resolve()
  })
}

export function exportData(data: AppData) {
  return JSON.stringify({ format: 'golf-tracker-json', schemaVersion: data.schemaVersion, exportedAt: new Date().toISOString(), data }, null, 2)
}

export function validateImport(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppData>
  return candidate.schemaVersion === 1 && Array.isArray(candidate.readings) && Array.isArray(candidate.rounds) && Array.isArray(candidate.handicapHistory) && !!candidate.weeklyPlan
}

export function parseImport(raw: string): AppData {
  const parsed = JSON.parse(raw)
  const data = parsed.data || parsed
  if (!validateImport(data)) throw new Error('This file is not a valid Golf Tracker backup.')
  return data
}
