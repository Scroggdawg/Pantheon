// LP-7 data coverage report.
//
// Read-only. Converts golden resolver output into a prioritized pantry
// coverage queue. It never inserts, updates, deletes, clears caches, or
// calls the parse route.

import { readFileSync } from 'fs'
import { join } from 'path'

import { createClient } from '@supabase/supabase-js'

import { buildFoodIdentityDocuments } from '../lib/claude/food-identity'
import { resolvePlateDraftFromIdentities } from '../lib/claude/search-first-resolver'
import { getCanonicalUserId } from '../lib/pantheon-user'

interface GoldenUtterance {
  id: string
  transcript: string
  target_path: string
  notes: string
}

interface CoverageGap {
  phrase: string
  example_id: string
  severity: 'high' | 'medium' | 'low'
  reason: string
  suggested_action: string
}

const KNOWN_TARGETS: Record<string, string> = {
  bacon: 'Add plain bacon product/default serving so bacon does not rely on history.',
  chips: 'Add tortilla chips / restaurant chips with chip-count or ounce defaults.',
  guacamole: 'Add guacamole product/default with tbsp/cup/gram alternatives.',
  'chocolate sauce': 'Add chocolate sauce condiment default with tbsp/gram alternatives.',
  margaritas: 'Add margarita on the rocks default plus skinny/restaurant variants.',
  'dos xx': 'Add Dos Equis 16 oz beer product and voice aliases: dos xx, dos equis.',
  'stevia hazelnut liquid': 'Add hazelnut stevia drops/product default or alias to current product.',
}

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

function loadGoldenUtterances(): GoldenUtterance[] {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'parse-golden-utterances.json'), 'utf8'),
  ) as GoldenUtterance[]
}

function severityFor(reason: string): CoverageGap['severity'] {
  if (reason.includes('fallback')) return 'high'
  if (reason.includes('wrong-looking')) return 'high'
  if (reason.includes('history')) return 'medium'
  return 'low'
}

function gapForItem(exampleId: string, query: string, name: string | null, outcome: string): CoverageGap | null {
  const lowerName = (name ?? '').toLowerCase()
  let reason: string | null = null

  if (outcome === 'fallback_required') {
    reason = 'fallback required: no usable canonical identity'
  } else if (lowerName.includes('yasso') && query === 'chips') {
    reason = 'wrong-looking candidate: generic chips is colliding with chocolate chip product text'
  } else if (outcome === 'needs_review' && !name) {
    reason = 'review required without a named candidate'
  } else if (outcome === 'needs_review' && name && !lowerName.includes(query.split(' ')[0])) {
    reason = 'review required with weak lexical coverage'
  } else if (outcome === 'needs_review' && name) {
    reason = 'history/review-only identity needs canonical pantry coverage'
  }

  if (!reason) return null

  return {
    phrase: query,
    example_id: exampleId,
    severity: severityFor(reason),
    reason,
    suggested_action:
      KNOWN_TARGETS[query] ?? `Add or review canonical pantry identity for "${query}".`,
  }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const userId = await getCanonicalUserId(supabase)
  const docs = await buildFoodIdentityDocuments(supabase, userId)
  const golden = loadGoldenUtterances()

  const gaps = new Map<string, CoverageGap>()
  for (const example of golden) {
    const draft = resolvePlateDraftFromIdentities(example.transcript, docs)
    for (const item of draft.items) {
      const gap = gapForItem(example.id, item.query, item.name, item.outcome)
      if (!gap) continue
      const existing = gaps.get(gap.phrase)
      if (!existing || existing.severity !== 'high') gaps.set(gap.phrase, gap)
    }
  }

  const sorted = [...gaps.values()].sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 }
    return sev[a.severity] - sev[b.severity] || a.phrase.localeCompare(b.phrase)
  })

  console.log('LP-7 Data Coverage Gap Report')
  console.log(`Identity docs scanned: ${docs.length}`)
  console.log(`Gaps: ${sorted.length}`)
  console.log('')
  for (const gap of sorted) {
    console.log(`- [${gap.severity}] ${gap.phrase}`)
    console.log(`  example: ${gap.example_id}`)
    console.log(`  reason: ${gap.reason}`)
    console.log(`  action: ${gap.suggested_action}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

