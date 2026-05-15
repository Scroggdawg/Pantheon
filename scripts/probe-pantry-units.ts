// Read-only unit intelligence probe for Pantry Builder artifacts.
//
// Usage:
//   npx tsx scripts/probe-pantry-units.ts
//   npx tsx scripts/probe-pantry-units.ts --artifact=scripts/output/pantry-builder-<run-id>.json
//   npx tsx scripts/probe-pantry-units.ts --strict

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import type { PantryCandidate } from '../lib/pantry-builder/types'
import { resolveUnitGrams } from '../lib/pantry-builder/units'

interface Args {
  artifactPath: string | null
  dir: string
  strict: boolean
}

interface RunArtifact {
  run_id: string
  generated_at: string
  profile_path?: string
  candidates: PantryCandidate[]
}

interface Probe {
  phrase: string
  foodQuery: string
  qty: number
  unit: string
  expected: 'resolved' | 'missing'
  note: string
}

const PROBES: Probe[] = [
  {
    phrase: '1 apple',
    foodQuery: 'apple',
    qty: 1,
    unit: 'apple',
    expected: 'missing',
    note: 'Count-unit gap unless USDA/profile adds apple as a count unit.',
  },
  {
    phrase: '1 medium apple',
    foodQuery: 'apple',
    qty: 1,
    unit: 'medium',
    expected: 'resolved',
    note: 'USDA household size should resolve.',
  },
  {
    phrase: '5 oz apple',
    foodQuery: 'apple',
    qty: 5,
    unit: 'oz',
    expected: 'resolved',
    note: 'Explicit weight wins.',
  },
  {
    phrase: '2 cups spinach',
    foodQuery: 'spinach',
    qty: 2,
    unit: 'cup',
    expected: 'resolved',
    note: 'USDA volume should resolve when present.',
  },
  {
    phrase: '1 medium sweet potato',
    foodQuery: 'sweet potato',
    qty: 1,
    unit: 'medium',
    expected: 'missing',
    note: 'Current first-batch candidate only has weight units.',
  },
  {
    phrase: '250g sweet potato',
    foodQuery: 'sweet potato',
    qty: 250,
    unit: 'g',
    expected: 'resolved',
    note: 'Explicit grams should always resolve.',
  },
  {
    phrase: '1 cup cooked white rice',
    foodQuery: 'white rice cooked',
    qty: 1,
    unit: 'cup cooked',
    expected: 'resolved',
    note: 'USDA cooked-rice household unit should resolve.',
  },
  {
    phrase: '1 bowl cooked white rice',
    foodQuery: 'white rice cooked',
    qty: 1,
    unit: 'bowl',
    expected: 'missing',
    note: 'Unknown household unit should stay review/estimate.',
  },
]

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactPath: null,
    dir: 'scripts/output',
    strict: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--strict') args.strict = true
    else if (arg.startsWith('--artifact=')) args.artifactPath = arg.slice('--artifact='.length)
    else if (arg.startsWith('--dir=')) args.dir = arg.slice('--dir='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }

  return args
}

function latestArtifact(dirArg: string) {
  const dir = resolve(dirArg)
  if (!existsSync(dir)) throw new Error(`Artifact directory not found: ${dir}`)
  const [latest] = readdirSync(dir)
    .filter((file) => /^pantry-builder-.*\.json$/.test(file))
    .map((file) => join(dir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  if (!latest) throw new Error(`No pantry-builder artifacts found in ${dir}`)
  return latest
}

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as RunArtifact
}

function scoreCandidateForProbe(candidate: PantryCandidate, probe: Probe) {
  const haystack = normalizeFoodText(
    [
      candidate.target_query,
      candidate.display_name,
      candidate.normalized_name,
      ...candidate.aliases,
    ].join(' '),
  )
  const tokens = normalizeFoodText(probe.foodQuery).split(/\s+/).filter(Boolean)
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

function findCandidate(candidates: PantryCandidate[], probe: Probe) {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidateForProbe(candidate, probe) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.target_query.localeCompare(b.candidate.target_query))[0]
    ?.candidate ?? null
}

function main() {
  const args = parseArgs(process.argv)
  const artifactPath = args.artifactPath ?? latestArtifact(args.dir)
  const artifact = readArtifact(artifactPath)
  let mismatches = 0

  console.log(`Pantry unit probe`)
  console.log(`artifact: ${artifactPath}`)
  console.log(`run_id: ${artifact.run_id}`)
  console.log(`profile: ${artifact.profile_path ?? 'unknown'}`)
  console.log(`generated_at: ${artifact.generated_at}`)

  for (const probe of PROBES) {
    const candidate = findCandidate(artifact.candidates, probe)
    if (!candidate) {
      mismatches += probe.expected === 'resolved' ? 1 : 0
      console.log(`\nMISS ${probe.phrase}`)
      console.log(`  candidate: none`)
      console.log(`  expected: ${probe.expected}`)
      console.log(`  note: ${probe.note}`)
      continue
    }

    const resolved = resolveUnitGrams(probe.unit, candidate.unit_alternatives)
    const outcome = resolved ? 'resolved' : 'missing'
    if (outcome !== probe.expected) mismatches++
    console.log(`\n${outcome === probe.expected ? 'OK' : 'CHECK'} ${probe.phrase}`)
    console.log(`  candidate: ${candidate.target_query} -> ${candidate.display_name} (${candidate.decision})`)
    console.log(`  unit: ${probe.unit}`)
    console.log(
      `  result: ${
        resolved
          ? `${probe.qty} x ${resolved.grams}g = ${Math.round(probe.qty * resolved.grams * 100) / 100}g (${resolved.confidence})`
          : 'no matching unit'
      }`,
    )
    console.log(`  expected: ${probe.expected}`)
    console.log(`  note: ${probe.note}`)
  }

  console.log(`\nSummary: ${PROBES.length - mismatches}/${PROBES.length} probes matched expectation`)
  if (args.strict && mismatches > 0) {
    throw new Error(`${mismatches} unit probes did not match expectation`)
  }
}

main()
