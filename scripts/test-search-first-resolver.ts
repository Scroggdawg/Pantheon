// LP-4 resolver proof.
//
// Read-only test harness: builds canonical identity documents, resolves
// golden utterances into Plate drafts, and verifies the first set of
// resolver invariants without calling the parse route or writing caches.

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
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

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const userId = await getCanonicalUserId(supabase)
  const docs = await buildFoodIdentityDocuments(supabase, userId)
  const golden = loadGoldenUtterances()

  let skipExpertCount = 0
  for (const target of golden) {
    const draft = resolvePlateDraftFromIdentities(target.transcript, docs)
    if (draft.can_skip_expert_llm) skipExpertCount += 1

    console.log(`═══ ${target.id} ═══`)
    console.log(`  can_skip_expert_llm: ${draft.can_skip_expert_llm}`)
    for (const item of draft.items) {
      console.log(
        `  ${item.review_pill.padEnd(8)} ${item.query.padEnd(28)} -> ${item.name ?? 'fallback'} `
        + `(${item.outcome})`,
      )
    }

    if (target.id === 'party-chips-guac') {
      assert(draft.items.length === 2, 'chips with guacamole should stage two Plate items')
      assert(
        draft.items[0].review_pill !== 'HIGH',
        'chips must not become a high-confidence chocolate-chip-bar match',
      )
      assert(
        draft.items[1].query === 'guacamole',
        `expected guacamole second item, got ${draft.items[1].query}`,
      )
    }

    if (target.id === 'party-churros-sauce') {
      assert(draft.items.length === 2, 'churros with chocolate sauce should stage two Plate items')
      assert(draft.items[0].query === 'churros', `expected churros query, got ${draft.items[0].query}`)
      assert(
        draft.items[1].query === 'chocolate sauce',
        `expected chocolate sauce query, got ${draft.items[1].query}`,
      )
    }

    if (target.id === 'brand-coffee-overmatch') {
      assert(draft.items.length === 1, 'coffee should remain one Plate item')
      assert(draft.items[0].review_pill !== 'HIGH', 'coffee must not high-confidence match REBBL')
    }

    if (target.id === 'voice-brand-dos-equis') {
      assert(!draft.can_skip_expert_llm, 'Dos Equis still needs data coverage or alias before skipping LLM')
    }
  }

  console.log(`\nLP-4 resolver proof: ${skipExpertCount}/${golden.length} golden utterances can skip expert LLM`)
  assert(skipExpertCount >= 5, `expected at least 5 golden utterances to skip expert LLM, got ${skipExpertCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

