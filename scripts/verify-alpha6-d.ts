// DANGEROUS one-off verification harness for Op FASTRAK Alpha.6 Sub-fix D —
// searchUserLibrary cascade extension with legacy tier-priority display.
//
// Runs the post-Alpha.6 matcher against canned queries and prints
// the tier assignment + dedup behavior. Exits 0 on success.
//
// This script temporarily mutates production saved_meals.is_favorite.
// Prefer scripts/test-matcher-invariants.ts for normal regression checks.
//
// Run only with explicit opt-in:
//   ALLOW_PROD_MUTATION=1 npx tsx scripts/verify-alpha6-d.ts

import { readFileSync } from 'fs'
import { join } from 'path'

import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  try {
    const path = join(__dirname, '..', '.env.local')
    const content = readFileSync(path, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch (err) {
    console.warn('Could not load .env.local:', (err as Error).message)
  }
}
loadEnvLocal()

import {
  searchUserLibrary,
  type LibrarySearchResult,
} from '../lib/claude/tools/search-user-library'

const USER_ID = 'f1fc7a56-f4c1-4332-9cd1-b7622e782986'
const ALLOW_PROD_MUTATION = process.env.ALLOW_PROD_MUTATION === '1'

function tierFor(r: LibrarySearchResult): number {
  if (r.source === 'saved_meal' && r.is_favorite) return 1
  if (r.source === 'hourly_go_to') return 2
  return 3
}

function tierName(t: number): string {
  return ['', 'FAV', 'HRLY', 'BASE'][t] ?? '?'
}

function fmt(r: LibrarySearchResult): string {
  const t = tierFor(r)
  const score = r.match_confidence.score.toFixed(2)
  const cal = r.total.kcal
  return `  [T${t}=${tierName(t)}] ${r.name.padEnd(35)} score=${score} cal=${cal} src=${r.source}${r.is_favorite ? ' ⭐' : ''}`
}

async function main() {
  if (!ALLOW_PROD_MUTATION) {
    console.error(
      'Refusing to run scripts/verify-alpha6-d.ts because it temporarily mutates production saved_meals.is_favorite.\n'
      + 'Use scripts/test-matcher-invariants.ts for safe checks, or rerun with ALLOW_PROD_MUTATION=1 if you explicitly need this legacy harness.',
    )
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const ctx = { supabase, userId: USER_ID }

  console.log(`\n=== Alpha.6 Sub-fix D verification (currentHour=${new Date().getUTCHours()} UTC) ===\n`)

  // Query 1: "eggs" — note: 3 eggs has source_ref dedup with the
  // hourly_go_tos view, so it surfaces at tier 2 (hourly) instead of
  // tier 4 (saved_meal) when not favorited. After heart, tier 1 wins.
  console.log('Query: "eggs"')
  const eggs = await searchUserLibrary({ query: 'eggs', limit: 10 }, ctx)
  for (const r of eggs.results) console.log(fmt(r))

  // Query 2: "banana" — banana appears in hourly_go_tos and products.
  // Current identity-priority dedup should prefer the canonical product
  // when both surfaces match.
  console.log('\nQuery: "banana"')
  const banana = await searchUserLibrary({ query: 'banana', limit: 10 }, ctx)
  for (const r of banana.results) console.log(fmt(r))

  // Query 3: "guacamole" — logged once via USDA. With recent_foods
  // dropped, ad hoc coverage comes from hourly_go_tos.
  console.log('\nQuery: "guacamole"')
  const guac = await searchUserLibrary({ query: 'guacamole', limit: 10 }, ctx)
  for (const r of guac.results) console.log(fmt(r))

  // Query 4: "double espresso" — saved_meal exists, not favorited.
  // Expect tier 4 only (recent/hourly might dedup to same source_ref).
  console.log('\nQuery: "double espresso"')
  const espresso = await searchUserLibrary({ query: 'double espresso', limit: 10 }, ctx)
  for (const r of espresso.results) console.log(fmt(r))

  // Query 5: "shrimp fajitas" — USDA-sourced single log. Post-Sub-fix-D.1
  // appears at tier 2 via hourly_go_tos.
  console.log('\nQuery: "shrimp fajitas"')
  const fajitas = await searchUserLibrary({ query: 'shrimp fajitas', limit: 10 }, ctx)
  for (const r of fajitas.results) console.log(fmt(r))

  // Query 6: "nonexistent food zzz" — no hits expected.
  console.log('\nQuery: "nonexistent zzz"')
  const none = await searchUserLibrary({ query: 'nonexistent zzz', limit: 10 }, ctx)
  console.log(`  results: ${none.results.length}`)

  // Query 7: HEART 3-eggs, re-run "eggs" query, expect tier 1 promotion,
  // then UN-HEART to clean up.
  console.log('\nQuery: "eggs" with 3-eggs HEARTED (tier 1 promotion test)')
  await supabase
    .from('saved_meals')
    .update({ is_favorite: true })
    .eq('id', 'b4c2ac48-dac4-43f3-b013-318562125661')
  const eggsHearted = await searchUserLibrary({ query: 'eggs', limit: 10 }, ctx)
  for (const r of eggsHearted.results) console.log(fmt(r))
  await supabase
    .from('saved_meals')
    .update({ is_favorite: false })
    .eq('id', 'b4c2ac48-dac4-43f3-b013-318562125661')
  console.log('  (3-eggs un-hearted, baseline restored)')

  console.log('\n=== verification complete ===\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
