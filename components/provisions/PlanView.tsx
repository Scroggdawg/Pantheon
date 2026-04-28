'use client'

import { useEffect, useState } from 'react'
import type {
  MealPlan,
  MealPlanEntry,
  Product,
  Recipe,
} from '@/types/database'
import PlanDay from './PlanDay'

const GOLD_LIGHT = '#c9a03c'
const TEXT_MUTED = '#8a7a60'

type PlanState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | {
      kind: 'loaded'
      plan: MealPlan
      entries: MealPlanEntry[]
      nameMap: Map<string, string>
      cookDate: string | null
      dates: string[]
    }
  | { kind: 'error'; message: string }

export interface PlanViewProps {
  /** Recipes loaded by the parent /provisions page (shared, no double-fetch). */
  recipes: Recipe[]
  recipesLoading: boolean
  /** True once useUser has resolved a real user (gates fetching). */
  userReady: boolean
}

/**
 * Determine the cook day for a plan.
 *
 *   1. If plan.cook_date is set, use it.
 *   2. Otherwise, gather all dinner entries with source_type='recipe',
 *      group by source_id, sum servings. Pick the source_id with the
 *      max total. Among entries for that source_id, return the
 *      earliest meal_date.
 *   3. If no recipe dinners exist, return null.
 *
 * Matches the V10 plan: cook_date null + all 4 dinners are Bolognese ×
 * 1.5 → Bolognese wins (sum 6.0) → earliest date 2026-04-27.
 */
function detectCookDate(
  plan: MealPlan,
  entries: MealPlanEntry[],
): string | null {
  if (plan.cook_date) return plan.cook_date

  const dinners = entries.filter(
    (e) => e.slot === 'dinner' && e.source_type === 'recipe',
  )
  if (dinners.length === 0) return null

  const totals = new Map<string, number>()
  for (const e of dinners) {
    totals.set(
      e.source_id,
      (totals.get(e.source_id) ?? 0) + Number(e.servings),
    )
  }

  let bestId: string | null = null
  let bestTotal = -Infinity
  for (const [id, total] of totals) {
    if (total > bestTotal) {
      bestId = id
      bestTotal = total
    }
  }
  if (!bestId) return null

  const dates = dinners
    .filter((e) => e.source_id === bestId)
    .map((e) => e.meal_date)
    .sort()
  return dates[0] ?? null
}

/**
 * Top-level view for the active meal plan, rendered above the recipe
 * library on /provisions.
 *
 * Fetch sequence (single useEffect once user + recipes are ready):
 *   1. GET /api/meal-plans?status=in_hole,up
 *      → empty: render empty state
 *      → else: take data[0]
 *   2. Promise.all([GET /api/meal-plans/[id], GET /api/products])
 *   3. Build name map from recipes prop + fetched products
 *   4. Detect cook day, derive sorted distinct dates, render
 */
export default function PlanView({
  recipes,
  recipesLoading,
  userReady,
}: PlanViewProps) {
  const [state, setState] = useState<PlanState>({ kind: 'loading' })

  useEffect(() => {
    if (!userReady || recipesLoading) return

    let cancelled = false

    async function load() {
      try {
        const listRes = await fetch('/api/meal-plans?status=in_hole,up')
        if (!listRes.ok) {
          const body = await listRes.json().catch(() => ({}))
          throw new Error(body?.error ?? `Failed to load plans (${listRes.status})`)
        }
        const list = (await listRes.json()) as MealPlan[]
        if (cancelled) return
        if (!list || list.length === 0) {
          setState({ kind: 'empty' })
          return
        }

        const planId = list[0].id
        const [planRes, productsRes] = await Promise.all([
          fetch(`/api/meal-plans/${planId}`),
          fetch('/api/products'),
        ])
        if (!planRes.ok) {
          const body = await planRes.json().catch(() => ({}))
          throw new Error(body?.error ?? `Failed to load plan (${planRes.status})`)
        }
        if (!productsRes.ok) {
          const body = await productsRes.json().catch(() => ({}))
          throw new Error(body?.error ?? `Failed to load products (${productsRes.status})`)
        }
        const planPayload = (await planRes.json()) as {
          plan: MealPlan
          entries: MealPlanEntry[]
        }
        const products = (await productsRes.json()) as Product[]
        if (cancelled) return

        const nameMap = new Map<string, string>()
        for (const r of recipes) nameMap.set(r.id, r.name)
        for (const p of products) nameMap.set(p.id, p.name)

        const cookDate = detectCookDate(planPayload.plan, planPayload.entries)
        const dates = Array.from(
          new Set(planPayload.entries.map((e) => e.meal_date)),
        ).sort()

        setState({
          kind: 'loaded',
          plan: planPayload.plan,
          entries: planPayload.entries,
          nameMap,
          cookDate,
          dates,
        })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setState({ kind: 'error', message })
      }
    }

    setState({ kind: 'loading' })
    load()

    return () => {
      cancelled = true
    }
  }, [userReady, recipesLoading, recipes])

  return (
    <div>
      {state.kind === 'loading' && (
        <div className="flex items-center justify-center py-10">
          <div
            className="h-6 w-6 animate-spin rounded-full border-4"
            style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: GOLD_LIGHT }}
          />
        </div>
      )}

      {state.kind === 'error' && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            background: 'rgba(180,40,40,0.08)',
            border: '1px solid rgba(180,40,40,0.2)',
            color: '#7a2222',
          }}
        >
          {state.message}
        </div>
      )}

      {state.kind === 'empty' && (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{
            background: 'rgba(255,253,249,0.45)',
            border: '1px solid rgba(201,160,60,0.15)',
            color: TEXT_MUTED,
          }}
        >
          No meal plan yet.
        </div>
      )}

      {state.kind === 'loaded' && (
        <div className="space-y-3">
          {state.dates.map((date) => (
            <PlanDay
              key={date}
              date={date}
              entries={state.entries.filter((e) => e.meal_date === date)}
              nameMap={state.nameMap}
              cookDate={state.cookDate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
