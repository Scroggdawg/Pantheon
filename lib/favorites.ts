// Op FASTRAK Alpha.6 Sub-fix F — favorites lookup helpers, mirrors the
// two-path lookup in app/api/saved_meals/heart/route.ts (Sub-fix C.1).
//
//   Path A — food.source_ref === 'lib:saved_meal:<uuid>' → check
//            favorites.savedMealIds. Used when a logged food's source_ref
//            points back at its origin saved_meal (re-log path via the
//            matcher's library_id pass-through).
//
//   Path B — canonical source_ref match against single-food favorited
//            saved_meals' inner food keys. This keeps product-backed
//            favorites hearted across quantities and display-name drift.
//
//   Path C — name + source_ref match for legacy/null-source entries.
//
// useDailyLog (web) and Pantheon.tsx (native) each build the Favorites
// shape from a saved_meals query in their data-fetching layer; consumers
// (TodayLog) call isFavoriteFood for per-render heart-state checks.

import type { FoodItem } from '@/types/database'

export interface Favorites {
  /** Saved_meal ids where is_favorite=true (regardless of foods_json shape). */
  savedMealIds: Set<string>
  /** Canonical source_refs for single-food favorited saved_meals' inner food. */
  sourceRefs: Set<string>
  /** "lower(trim(name))|source_ref" keys for single-food favorited saved_meals' inner food. */
  foodKeys: Set<string>
}

export function emptyFavorites(): Favorites {
  return { savedMealIds: new Set(), sourceRefs: new Set(), foodKeys: new Set() }
}

export function favoriteFoodKey(name: string | null | undefined, sourceRef: string | null | undefined): string {
  return `${(name ?? '').toLowerCase().trim()}|${sourceRef ?? ''}`
}

/** Build a Favorites lookup from raw saved_meals rows where is_favorite=true. */
export function buildFavorites(
  rows: Array<{ id: string; name: string | null; foods_json: FoodItem[] | null }>,
): Favorites {
  const savedMealIds = new Set<string>()
  const sourceRefs = new Set<string>()
  const foodKeys = new Set<string>()
  for (const row of rows) {
    savedMealIds.add(row.id)
    const foods = row.foods_json
    if (Array.isArray(foods) && foods.length === 1) {
      const f = foods[0]
      if (f.source_ref) sourceRefs.add(f.source_ref)
      foodKeys.add(favoriteFoodKey(f.name, f.source_ref))
    }
  }
  return { savedMealIds, sourceRefs, foodKeys }
}

export function isFavoriteFood(food: FoodItem, favorites: Favorites): boolean {
  // Path A — direct saved_meal id lookup
  const ref = food.source_ref ?? ''
  if (ref.startsWith('lib:saved_meal:')) {
    const id = ref.slice('lib:saved_meal:'.length)
    if (favorites.savedMealIds.has(id)) return true
  }
  // Path B — canonical source_ref match. This intentionally ignores
  // quantity and display-name differences for product-backed foods.
  if (ref && favorites.sourceRefs.has(ref)) return true
  // Path C — name + source_ref dedup key for legacy/null-source entries.
  return favorites.foodKeys.has(favoriteFoodKey(food.name, food.source_ref))
}
