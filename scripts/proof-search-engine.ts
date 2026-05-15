// LP-2 search-engine proof.
//
// Builds the canonical identity read-model from current Supabase tables,
// then runs a local lexical proof over the LP-0 golden utterances. This is
// intentionally read-only: no cache clears, no parse route calls, no writes.

import { readFileSync } from 'fs'
import { join } from 'path'
import { performance } from 'perf_hooks'

import { createClient } from '@supabase/supabase-js'

import {
  buildFoodIdentityDocuments,
  searchFoodIdentityDocuments,
  type FoodIdentityDocument,
  type IdentitySearchHit,
} from '../lib/claude/food-identity'
import {
  relaxedSegmentQuery,
  segmentTranscript,
} from '../lib/claude/parse-meal-library-shortcut'
import { getCanonicalUserId } from '../lib/pantheon-user'

interface GoldenUtterance {
  id: string
  transcript: string
  target_path: string
  notes: string
}

interface ProofRow {
  id: string
  transcript: string
  target_path: string
  latency_ms: number
  raw_outcome: string
  top: Array<{
    name: string
    type: string
    ref: string | null
    authority: string
    score: number
    text_score: number
  }>
  segments: Array<{
    query: string
    original: string
    outcome: string
    top: ProofRow['top']
  }>
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

function parseArgs(): { json: boolean; limit: number | null } {
  let json = false
  let limit: number | null = null

  for (const arg of process.argv.slice(2)) {
    if (arg === '--json') json = true
    else if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }

  return { json, limit }
}

function loadGoldenUtterances(limit: number | null): GoldenUtterance[] {
  const fixturePath = join(__dirname, 'fixtures', 'parse-golden-utterances.json')
  const rows = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenUtterance[]
  return limit == null ? rows : rows.slice(0, limit)
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

function summarizeDocs(docs: FoodIdentityDocument[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const doc of docs) counts[doc.identity_type] = (counts[doc.identity_type] ?? 0) + 1
  return counts
}

function serializeHits(hits: IdentitySearchHit[]): ProofRow['top'] {
  return hits.slice(0, 5).map((hit) => ({
    name: hit.document.display_name,
    type: hit.document.identity_type,
    ref: hit.document.canonical_source_ref,
    authority: hit.document.authority,
    score: hit.score,
    text_score: hit.text_score,
  }))
}

function printHuman(rows: ProofRow[], docs: FoodIdentityDocument[], buildMs: number) {
  const latencies = rows.map((row) => row.latency_ms)
  console.log('LP-2 Search Engine Proof')
  console.log('Mode: canonical identity read-model + local lexical scorer')
  console.log(`Identity docs: ${docs.length}`)
  console.log('Doc counts:', summarizeDocs(docs))
  console.log(`Build latency: ${Math.round(buildMs)}ms`)
  console.log(
    `Search latency: p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms`,
  )
  console.log('')

  for (const row of rows) {
    console.log(`- ${row.id} (${row.latency_ms}ms, raw=${row.raw_outcome})`)
    console.log(`  "${row.transcript}"`)
    if (row.top.length === 0) {
      console.log('  raw top: none')
    } else {
      for (const hit of row.top.slice(0, 3)) {
        console.log(
          `  raw ${hit.score.toFixed(3)} ${hit.type} ${hit.authority} ${hit.name} ${hit.ref ?? ''}`,
        )
      }
    }

    for (const segment of row.segments) {
      const first = segment.top[0]
      if (!first) {
        console.log(`  seg "${segment.query}" -> none`)
        continue
      }
      console.log(
        `  seg "${segment.query}" -> ${segment.outcome} ${first.score.toFixed(3)} ${first.type} ${first.name}`,
      )
    }
  }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const userId = await getCanonicalUserId(supabase)
  const targets = loadGoldenUtterances(args.limit)

  const buildStart = performance.now()
  const docs = await buildFoodIdentityDocuments(supabase, userId)
  const buildMs = performance.now() - buildStart

  const rows: ProofRow[] = []
  for (const target of targets) {
    const start = performance.now()
    const hits = searchFoodIdentityDocuments(target.transcript, docs, { minScore: 0.5, limit: 5 })
    const segments = segmentTranscript(target.transcript).map((segment) => {
      const relaxed = relaxedSegmentQuery(segment.stripped) || segment.stripped
      const segmentHits = searchFoodIdentityDocuments(relaxed, docs, { minScore: 0.5, limit: 5 })
      return {
        query: relaxed,
        original: segment.original,
        outcome: segmentHits[0]?.outcome ?? 'fallback_required',
        top: serializeHits(segmentHits),
      }
    })
    const latencyMs = Math.round(performance.now() - start)
    rows.push({
      id: target.id,
      transcript: target.transcript,
      target_path: target.target_path,
      latency_ms: latencyMs,
      raw_outcome: hits[0]?.outcome ?? 'fallback_required',
      top: serializeHits(hits),
      segments,
    })
  }

  if (args.json) {
    console.log(JSON.stringify({ docs: summarizeDocs(docs), build_ms: buildMs, rows }, null, 2))
  } else {
    printHuman(rows, docs, buildMs)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
