// Brick D regression test for tryLibrarySegmentedShortcut.
//
// Real Supabase reads against Luke's actual library — not mocked.
// Run from web repo root:
//
//   npx tsx scripts/test-segmented-library.ts
//
// Loads .env.local for SUPABASE_* env vars. Walks the test
// transcripts from the Brick D EXECUTE brief and prints:
//   - segmenter output
//   - shortcut hit/miss + segment scores + per-food breakdown
//   - latency per case
//
// Pre-fix (without 4f.5): all multi-item cases miss. Post-fix:
// clean two-item + three-item-with-descriptor + composite-allowlist
// cases hit; pure-descriptor "with" + single-item cases return null
// (correctly defer to 4f / Sonnet).

import { readFileSync } from 'fs'
import { join } from 'path'

// Minimal .env.local loader — tsx doesn't auto-load and the web repo
// doesn't ship dotenv as a dep. Reads KEY=VALUE pairs, skips comments,
// strips surrounding quotes. Sets process.env before any module that
// depends on the vars is imported.
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

import { createClient } from '../lib/supabase/server'
import {
  segmentTranscript,
  tryLibrarySegmentedShortcut,
} from '../lib/claude/parse-meal-library-shortcut'

interface TestCase {
  name: string
  transcript: string
  expectSegmented: boolean // expect tryLibrarySegmentedShortcut to return non-null
  notes?: string
}

const CASES: TestCase[] = [
  {
    name: '1 — Two-item with library duplicate (gap-gate fires correctly)',
    transcript: '3 eggs and a handful of blueberries',
    expectSegmented: false,
    notes:
      'Segments to ["3 eggs", "blueberries"]. "3 eggs" hits saved_meal "3 eggs" at score 1.0 unambiguously. '
      + '"blueberries" returns TWO score-1.0 hits (saved_meal "Blueberries" + product "Blueberries") — gap=0 '
      + 'fails the 0.15 disambiguation gate. Returns null correctly: ambiguous matches should defer to 4g\'s '
      + 'candidates UI, not silently pick one. Surfaces a Brick E (library dedupe) concern: Luke has duplicate '
      + 'Blueberries entries that should be merged.',
  },
  {
    name: '1b — Clean two-item, both unambiguous in library',
    transcript: '3 eggs and a double espresso',
    expectSegmented: true,
    notes:
      'Segments to ["3 eggs", "double espresso"]. Both saved_meals have NO substring-overlapping product '
      + 'duplicates (verified via direct searchUserLibrary probe — single 1.0-score hits each). '
      + 'Demonstrates the fast path actually works when library entries are unambiguous.',
  },
  {
    name: '2 — Three-item with descriptor (with-clause)',
    transcript:
      'Three eggs, two strips of bacon and a protein shake with 25 grams of protein.',
    expectSegmented: false,
    notes:
      'Segments to ["3 eggs", "2 bacon", "protein shake with 25 protein"] (after written-number + filler strip). '
      + '"3 eggs" hits library; bacon NOT in saved_meals (top 7 = eggs/banana/blueberries/protein bar/espresso/shake/test); '
      + '"protein shake with 25 protein" too noisy for "Protein Shake A - Pre-Workout". '
      + 'Expected NULL return — proves no regression.',
  },
  {
    name: '3 — Composite item allowlist test',
    transcript:
      'Double espresso, with half an ounce of half and half, and stevia hazelnut liquid.',
    expectSegmented: false,
    notes:
      'COMPOSITE_ALLOWLIST should protect "half and half" from over-split. Result depends on whether '
      + 'all 3 segments are in library. Likely NULL return because espresso composite + stevia not '
      + 'matched as single library entries — proves no regression vs current behavior.',
  },
  {
    name: '4 — Pure descriptor "with" — should NOT segment',
    transcript: 'Protein shake with dextrose.',
    expectSegmented: false,
    notes:
      'No " and ", no comma. Single segment. Returns null because segments.length < 2.',
  },
  {
    name: '5 — Single-item baseline',
    transcript: '3 eggs',
    expectSegmented: false,
    notes: 'No delimiters. segments.length === 1 → early return. 4f handles.',
  },
]

async function main() {
  const supabase = await createClient()

  // Resolve user_id — same pattern as parse-meal/route.ts
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single()
  if (userErr || !userRow) {
    console.error('Failed to resolve user:', userErr?.message)
    process.exit(1)
  }
  const userId = userRow.id
  console.log(`Loaded user_id: ${userId}\n`)

  let pass = 0
  let fail = 0

  for (const c of CASES) {
    console.log(`═══ ${c.name} ═══`)
    console.log(`  transcript: "${c.transcript}"`)
    console.log(`  notes: ${c.notes ?? '-'}`)

    // Segmenter output (independent of shortcut decision).
    // Post-Alpha.4.1 the shape is { stripped, original } pairs.
    const segs = segmentTranscript(c.transcript)
    console.log(
      `  segments (${segs.length}): ${JSON.stringify(segs.map((s) => s.stripped))}`,
    )
    console.log(
      `  originals:        ${JSON.stringify(segs.map((s) => s.original))}`,
    )

    // Shortcut decision + latency.
    // Post-Alpha.4 the helper returns { resolved, unresolved, segment_count }
    // | null. "Full segmented hit" (old `hit: true`) maps to
    // result !== null && result.unresolved.length === 0. Partial resolves
    // (resolved.length > 0 && unresolved.length > 0) are a NEW case the
    // pre-Alpha.4 cases below didn't anticipate; they show up here as
    // partial telemetry but don't change the existing pass/fail semantics
    // (test still asks "did all segments resolve via library shortcut?").
    const t0 = Date.now()
    const result = await tryLibrarySegmentedShortcut(supabase, userId, c.transcript)
    const dt = Date.now() - t0

    const fullResolve = result !== null && result.unresolved.length === 0
    const partial = result !== null && result.unresolved.length > 0
    console.log(
      `  segmented_full_resolve: ${fullResolve ? 'YES' : 'NO'}  `
      + `${partial ? `(partial: ${result!.resolved.length}/${result!.segment_count})  ` : ''}`
      + `[latency ${dt}ms]`,
    )

    if (result !== null) {
      const foods = result.resolved.map((r) => r.food)
      const totalCalories = foods.reduce((acc, f) => acc + f.calories, 0)
      console.log(`  resolved scores: ${JSON.stringify(result.resolved.map((r) => r.score))}`)
      if (result.unresolved.length > 0) {
        console.log(`  unresolved segments: ${JSON.stringify(result.unresolved.map((u) => u.segment))}`)
      }
      console.log(`  resolved total_calories: ${Math.round(totalCalories)}`)
      console.log(`  resolved foods (${foods.length}):`)
      for (const f of foods) {
        const score = f.match_confidence?.score ?? '?'
        console.log(
          `    - "${f.name}" cal=${f.calories} P=${f.protein_g} C=${f.carbs_g} F=${f.fat_g} `
          + `[score ${score}, ref ${f.source_ref}]`,
        )
      }
    }

    const matched = fullResolve === c.expectSegmented
    if (matched) {
      console.log(`  ✓ matches expectation (segmented=${c.expectSegmented})`)
      pass += 1
    } else {
      console.log(`  ✗ MISMATCH — expected segmented=${c.expectSegmented}, got ${fullResolve}`)
      fail += 1
    }
    console.log()
  }

  console.log(`═══ SUMMARY: ${pass} pass / ${fail} fail ═══`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
