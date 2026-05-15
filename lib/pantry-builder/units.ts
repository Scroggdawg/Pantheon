import type { UnitAlternative } from '@/types/database'

import { normalizeFoodText } from './normalize'

const WEIGHT_UNITS: UnitAlternative[] = [
  { unit: 'g', grams: 1, source: 'standard', confidence: 'high' },
  { unit: 'gram', grams: 1, source: 'standard', confidence: 'high' },
  { unit: 'grams', grams: 1, source: 'standard', confidence: 'high' },
  { unit: 'kg', grams: 1000, source: 'standard', confidence: 'high' },
  { unit: 'oz', grams: 28.35, source: 'standard', confidence: 'high' },
  { unit: 'ounce', grams: 28.35, source: 'standard', confidence: 'high' },
  { unit: 'ounces', grams: 28.35, source: 'standard', confidence: 'high' },
  { unit: 'lb', grams: 453.59, source: 'standard', confidence: 'high' },
  { unit: 'lbs', grams: 453.59, source: 'standard', confidence: 'high' },
  { unit: 'pound', grams: 453.59, source: 'standard', confidence: 'high' },
  { unit: 'pounds', grams: 453.59, source: 'standard', confidence: 'high' },
]

const UNIT_SYNONYMS: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  ounce: 'oz',
  ounces: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  slices: 'slice',
  strips: 'strip',
  pieces: 'piece',
  chips: 'chip',
  strawberries: 'strawberry',
  bananas: 'banana',
  eggs: 'egg',
  tortillas: 'tortilla',
  bars: 'bar',
  bottles: 'bottle',
  cans: 'can',
  scoops: 'scoop',
}

export function normalizeUnit(unit: string): string {
  const normalized = normalizeFoodText(unit)
  return UNIT_SYNONYMS[normalized] ?? normalized
}

export function dedupeUnitAlternatives(alternatives: UnitAlternative[]): UnitAlternative[] {
  const byUnit = new Map<string, UnitAlternative>()
  for (const alt of alternatives) {
    if (!Number.isFinite(alt.grams) || alt.grams <= 0) continue
    const unit = normalizeUnit(alt.unit)
    const next = {
      ...alt,
      unit,
      grams: Math.round(alt.grams * 100) / 100,
    }
    const existing = byUnit.get(unit)
    if (!existing) {
      byUnit.set(unit, next)
      continue
    }
    const rank = { high: 3, medium: 2, low: 1 }
    if (rank[next.confidence] > rank[existing.confidence]) byUnit.set(unit, next)
  }
  return [...byUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit))
}

export function withStandardUnits(
  alternatives: UnitAlternative[],
  countUnitGrams: Record<string, number>,
  query: string,
): UnitAlternative[] {
  const countUnits: UnitAlternative[] = []
  const normalizedQuery = normalizeFoodText(query)
  const queryUnits = new Set(
    normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => normalizeUnit(token)),
  )
  for (const [unit, grams] of Object.entries(countUnitGrams)) {
    const normalizedUnit = normalizeUnit(unit)
    if (
      normalizedQuery === normalizedUnit ||
      normalizeUnit(normalizedQuery) === normalizedUnit ||
      queryUnits.has(normalizedUnit) ||
      normalizedQuery.includes(normalizedUnit) ||
      normalizedQuery.includes(`${normalizedUnit}s`)
    ) {
      countUnits.push({
        unit: normalizedUnit,
        grams,
        source: 'standard',
        confidence: 'medium',
      })
    }
  }
  return dedupeUnitAlternatives([...WEIGHT_UNITS, ...alternatives, ...countUnits])
}

export function resolveUnitGrams(
  unit: string,
  alternatives: UnitAlternative[],
): { grams: number; confidence: 'high' | 'medium' | 'low' } | null {
  const normalized = normalizeUnit(unit)
  const alt = dedupeUnitAlternatives(alternatives).find((entry) => entry.unit === normalized)
  if (!alt) return null
  return { grams: alt.grams, confidence: alt.confidence }
}
