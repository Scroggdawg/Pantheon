// Brick D regression test for tryLibrarySegmentedShortcut, refreshed
// post-Op-FASTRAK-Alpha.6 (Sub-fix G — CASES rewrite).
//
// Real Supabase reads against Luke's actual library — not mocked.
// Run from web repo root:
//
//   npx tsx scripts/test-segmented-library.ts
//
// Loads .env.local for SUPABASE_* env vars. Walks transcripts that
// exercise the post-Alpha.6 cascade (saved_meals favorited + non-
// favorited tiers, hourly_go_tos tier, partial-resolve, gap-gate,
// composite allowlist, single-segment early return, full miss) and
// prints:
//   - segmenter output (stripped + original pairs)
//   - shortcut hit/miss + segment scores + per-food breakdown
//   - latency per case
//
// Pre-Alpha.4 (no partial resolve): multi-item cases were all-or-
// nothing — any non-library segment killed the fast path. Post-
// Alpha.4 the helper reports {resolved, unresolved, segment_count}
// so multi-item cases with one library + one LLM segment still
// surface a partial win. Cases below cover both modes.

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
  runtimeCompositeNames?: string[]
  expectOriginals?: string[]
  expectSegmented: boolean // expect tryLibrarySegmentedShortcut to return non-null
  notes?: string
}

const CASES: TestCase[] = [
  {
    name: 'M3.1 — Runtime saved_meal protects "&" compound from "and" split',
    transcript: "One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's",
    runtimeCompositeNames: ["McDonald's Bacon Egg & Cheese Biscuit"],
    expectOriginals: [
      "One Bacon Egg and Cheese Biscuit from McDonald's",
      "one Sausage Burrito from McDonald's",
    ],
    expectSegmented: false,
    notes:
      'M.3 direct segmenter regression. Saved meal uses "&"; voice says "and". The segmenter should keep '
      + '"Bacon Egg and Cheese Biscuit" intact and only split between the two foods.',
  },
  {
    name: 'M3/M4 — Runtime compound protect + generic coffee overmatch guard',
    transcript: "McDonald's Bacon Egg and Cheese Biscuit and a coffee",
    runtimeCompositeNames: ["McDonald's Bacon Egg & Cheese Biscuit"],
    expectOriginals: ["McDonald's Bacon Egg and Cheese Biscuit", 'a coffee'],
    expectSegmented: false,
    notes:
      'M.3 direct segmenter regression. Restaurant-prefixed library name should protect the full compound '
      + 'food while still allowing the outer "and a coffee" delimiter to split. M.4 guardrail: generic '
      + '"coffee" should not fully resolve to a specific branded product like REBBL Hazelnut Coffee Elixir.',
  },
  {
    name: 'M3.3/M5 — True two-food "and" splits and banana resolves',
    transcript: '3 eggs and a banana',
    expectOriginals: ['3 eggs', 'a banana'],
    expectSegmented: true,
    notes:
      'Guardrail: runtime compound protection must not weaken ordinary multi-food segmentation. M.5 now '
      + 'also lets the banana segment resolve after singular/plural duplicate collapse.',
  },
  {
    name: '1 — Two saved_meals resolve after Beta cascade cleanup',
    transcript: '3 eggs and a double espresso',
    expectSegmented: true,
    notes:
      'Segments to ["3 eggs", "double espresso"]. Current Beta cascade cleanup resolves both saved meals '
      + 'cleanly. This guards against regressing the source_ref / hourly_go_to canonical collapse work.',
  },
  {
    name: '2 — Cross-tier with "Churro" saved_meal having same variant issue',
    transcript: 'scrambled eggs and a Churro',
    expectSegmented: true,
    notes:
      'Segments to ["scrambled eggs", "churro"]. Current Beta-1 matcher state resolves both segments cleanly: '
      + '"scrambled eggs" through hourly_go_tos and "Churro" through saved_meals. This case is kept as a '
      + 'current-reality regression guard for cross-tier full segmented resolution.',
  },
  {
    name: '3 — Hearted saved_meal exhibits same variant issue',
    transcript: "McDonald's sausage burrito and a Churro",
    expectSegmented: true,
    notes:
      "Segments to [\"mcdonald's sausage burrito\", \"churro\"]. Current Beta-1 matcher state resolves both "
      + 'saved_meals cleanly. This case guards the improved cascade behavior after the source_ref and '
      + 'hourly_go_to canonicalization fixes.',
  },
  {
    name: '4 — M5 singular/plural cascade resolves banana variants',
    transcript: '3 eggs and a banana',
    expectSegmented: true,
    notes:
      'Segments to ["3 eggs", "banana"]. M.5 collapses simple singular/plural hourly_go_to variants '
      + '("banana" / "Bananas") into the canonical saved_meal/product when one exists, so the gap-gate no '
      + 'longer fails on 1.0/1.0 plural duplicates.',
  },
  {
    name: '5 — Composite-allowlist protection ("half and half")',
    transcript:
      'Double espresso, with half an ounce of half and half, and stevia hazelnut liquid.',
    expectSegmented: false,
    notes:
      'COMPOSITE_ALLOWLIST protects "half and half" from over-split on " and ". Three segments: '
      + '["double espresso", "with half an ounce of half and half", "stevia hazelnut liquid"]. Espresso '
      + 'is a saved_meal (Tier 4) but the other two segments are LLM-only. Helper returns partial resolve '
      + '(1/3). Full-resolve FALSE — not a regression; proves composite handling + Alpha.4 partial mode '
      + 'still work post-Alpha.6.',
  },
  {
    name: '6 — Pure descriptor "with" — single segment, early return',
    transcript: 'Protein shake with dextrose.',
    expectSegmented: false,
    notes:
      'No comma, no " and ". segmentTranscript returns 1 segment → tryLibrarySegmentedShortcut early-returns '
      + 'null because segments.length < 2. Proves the helper correctly defers single-item utterances to the '
      + 'single-hit shortcut (tryLibraryShortcut) or the LLM path.',
  },
  {
    name: '7 — Partial resolve: 1 saved_meal + 1 unresolvable',
    transcript: '3 eggs and a totally nonexistent food xyz123',
    expectSegmented: false,
    notes:
      'Segments to ["3 eggs", "totally nonexistent food xyz123"]. "3 eggs" resolves; xyz123 has no library '
      + 'or hourly hit → unresolved. Helper returns {resolved: 1, unresolved: 1}. Full-resolve assertion '
      + 'FALSE; the partial telemetry should show resolved=1/2. This is the Alpha.4 partial-resolve happy '
      + 'path: the route-side cascade hands the unresolved segment to the LLM tool-loop separately.',
  },
  {
    name: '8 — Full miss: zero segments resolve',
    transcript: 'nonexistent xyz123 and nonexistent abc456',
    expectSegmented: false,
    notes:
      'Segments to ["nonexistent xyz123", "nonexistent abc456"]. Neither has any library or hourly hit. '
      + 'Helper returns null (zero resolves → caller falls through to 4g/Sonnet unchanged). Proves no-hit '
      + 'segmented utterances correctly defer the entire transcript to the LLM path.',
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
    const segs = segmentTranscript(c.transcript, c.runtimeCompositeNames)
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

    const originals = segs.map((s) => s.original)
    const originalsMatched = c.expectOriginals === undefined
      || JSON.stringify(originals) === JSON.stringify(c.expectOriginals)
    if (c.expectOriginals !== undefined) {
      console.log(
        `  expected originals matched: ${originalsMatched ? 'YES' : 'NO'}`,
      )
    }

    const matched = fullResolve === c.expectSegmented && originalsMatched
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
