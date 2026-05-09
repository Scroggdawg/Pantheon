// Op FASTRAK Brick Gamma C.2 — eval harness for the LLM-fill prompt.
//
// Runs llmFillPortions over a curated 15-food set spanning categories
// (produce, generic packaged, branded packaged, supplements, beverages).
// For foods with USDA/OFF ground-truth gram weights, asserts ±50%
// tolerance per Phase 0 §P0.3.
//
// Pass threshold: 80% on the GROUND-TRUTH subset (10 of the 12 with
// known canonical weights). Foods without ground truth (supplements,
// niche brands) are EXEMPT — printed for manual review but don't fail
// the threshold.
//
// Run:  npx tsx scripts/eval-llm-fill.ts
//
// Output: per-food pass/fail + final summary. Exit 1 if <80%.

import { readFileSync } from 'fs'
import { join } from 'path'

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

import { llmFillPortions } from '../lib/llm-fill/portions'
import type { UnitAlternative } from '../types/database'

interface EvalCase {
  name: string
  brand: string | null
  category: 'produce' | 'generic' | 'branded' | 'supplement' | 'beverage'
  groundTruth?: {
    // Map of unit → expected grams. Tolerance ±50%.
    // Only set when canonical USDA/OFF data exists.
    [unit: string]: number
  }
}

const CASES: EvalCase[] = [
  // Produce (5) — USDA Foundation/FNDDS ground truth
  { name: 'Bananas', brand: null, category: 'produce', groundTruth: { banana: 118, cup: 150 } },
  { name: 'Strawberries', brand: null, category: 'produce', groundTruth: { cup: 152, strawberry: 12 } },
  { name: 'Apple', brand: null, category: 'produce', groundTruth: { apple: 182, cup: 125 } },
  { name: 'Bell Peppers', brand: null, category: 'produce', groundTruth: { cup: 217 } },
  { name: 'Avocado', brand: null, category: 'produce', groundTruth: { avocado: 200, cup: 150 } },

  // Generic packaged (5) — USDA Survey ground truth
  { name: 'Eggs - Large', brand: null, category: 'generic', groundTruth: { egg: 50 } },
  { name: 'Cottage Cheese', brand: null, category: 'generic', groundTruth: { cup: 226 } },
  { name: 'Greek Yogurt', brand: null, category: 'generic', groundTruth: { cup: 245, container: 150 } },
  { name: 'Rolled Oats', brand: null, category: 'generic', groundTruth: { cup: 81 } },
  { name: 'Whole Milk', brand: null, category: 'generic', groundTruth: { cup: 244, 'fl oz': 30 } },

  // Branded packaged (3) — OFF ground truth where available
  { name: 'Yasso Greek Yogurt Bar', brand: 'Yasso', category: 'branded', groundTruth: { bar: 65 } },
  { name: 'Cheerios', brand: 'General Mills', category: 'branded', groundTruth: { cup: 28 } },
  { name: 'Magic Spoon Cereal Strawberry', brand: 'Magic Spoon', category: 'branded' /* no canonical */ },

  // Supplements (1) — no ground truth, manual review
  { name: 'Whey Protein Powder', brand: null, category: 'supplement' },

  // Beverages (1) — USDA ground truth
  { name: 'Coconut Water', brand: null, category: 'beverage', groundTruth: { cup: 240, 'fl oz': 30 } },
]

interface CaseResult {
  case: EvalCase
  output: UnitAlternative[]
  passed: boolean
  failReason?: string
  exempt: boolean
}

function evalCase(c: EvalCase, output: UnitAlternative[]): CaseResult {
  const exempt = !c.groundTruth
  // Empty array on a known-canonical food = fail; exempt foods can be empty.
  if (output.length === 0) {
    if (exempt) return { case: c, output, passed: true, exempt }
    return { case: c, output, passed: false, exempt, failReason: 'returned []' }
  }
  if (exempt) return { case: c, output, passed: true, exempt }

  // Check that at least one ground-truth unit is present + within ±50%.
  const gt = c.groundTruth!
  let anyMatch = false
  const failures: string[] = []
  for (const [gtUnit, gtGrams] of Object.entries(gt)) {
    const found = output.find((o) => o.unit === gtUnit)
    if (!found) continue
    const ratio = found.grams / gtGrams
    if (ratio >= 0.5 && ratio <= 1.5) {
      anyMatch = true
    } else {
      failures.push(`unit "${gtUnit}" = ${found.grams}g (expected ~${gtGrams}g, ratio ${ratio.toFixed(2)})`)
    }
  }
  if (anyMatch) return { case: c, output, passed: true, exempt }
  if (failures.length > 0) {
    return { case: c, output, passed: false, exempt, failReason: failures.join('; ') }
  }
  return {
    case: c,
    output,
    passed: false,
    exempt,
    failReason: `none of expected units (${Object.keys(gt).join(', ')}) appeared in output`,
  }
}

function fmtConfidence(c: UnitAlternative['confidence']): string {
  return c === 'medium' ? 'med' : 'low'
}

async function main() {
  console.log(`\n=== Gamma C.2 LLM-fill eval — ${CASES.length} cases ===\n`)
  const results: CaseResult[] = []
  for (const c of CASES) {
    const t0 = Date.now()
    const output = await llmFillPortions(c.name, c.brand)
    const dt = Date.now() - t0
    const result = evalCase(c, output)
    results.push(result)
    const status = result.exempt ? 'EXEMPT' : result.passed ? '✓ PASS' : '✗ FAIL'
    console.log(`[${c.category}] ${c.name}${c.brand ? ` (${c.brand})` : ''} — ${status} [${dt}ms]`)
    if (output.length === 0) {
      console.log(`  → []`)
    } else {
      for (const u of output) {
        console.log(`  → ${u.unit}=${u.grams}g [${fmtConfidence(u.confidence)}]`)
      }
    }
    if (!result.passed && result.failReason) {
      console.log(`  reason: ${result.failReason}`)
    }
  }

  console.log('\n=== summary ===')
  const groundTruth = results.filter((r) => !r.exempt)
  const exempts = results.filter((r) => r.exempt)
  const passed = groundTruth.filter((r) => r.passed).length
  const total = groundTruth.length
  const passRate = total > 0 ? (passed / total) * 100 : 0
  console.log(`ground-truth cases: ${passed}/${total} pass (${passRate.toFixed(1)}%)`)
  console.log(`exempt cases:       ${exempts.length} (manual review only)`)
  console.log(`pass threshold:     80% (${Math.ceil(0.8 * total)}/${total})`)
  if (passRate >= 80) {
    console.log(`\n✅ THRESHOLD MET — prompt ready to ship`)
    process.exit(0)
  } else {
    console.log(`\n❌ THRESHOLD MISSED — surface failures + iterate prompt before backfill`)
    console.log('\nfailed cases:')
    for (const r of groundTruth.filter((r) => !r.passed)) {
      console.log(`  - ${r.case.name}: ${r.failReason}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
