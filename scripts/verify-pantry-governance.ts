import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const content = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
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
}

function formatSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  const parts = [error.message, error.code, error.details, error.hint].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error)
}

const REQUIRED_PRODUCT_PROVENANCE_COLUMNS = [
  'provenance_source_kind',
  'provenance_dataset',
  'provenance_external_id',
  'provenance_release',
  'provenance_import_run_id',
  'import_confidence',
  'canonical_category',
]

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  const supabase = createClient(url, key)

  const checks = [
    ['pantry_import_runs', supabase.from('pantry_import_runs').select('id', { head: true, count: 'exact' })],
    [
      'pantry_import_candidates',
      supabase.from('pantry_import_candidates').select('id,target_query', { head: true, count: 'exact' }),
    ],
    [
      'food_identity_aliases',
      supabase.from('food_identity_aliases').select('id,normalized_alias', { head: true, count: 'exact' }),
    ],
    [
      'food_identity_rejections',
      supabase.from('food_identity_rejections').select('id,normalized_phrase', { head: true, count: 'exact' }),
    ],
  ] as const

  for (const [label, promise] of checks) {
    const { error } = await promise
    if (error) throw new Error(`${label}: ${formatSupabaseError(error)}`)
    console.log(`ok ${label}`)
  }

  const missingProductColumns: string[] = []
  const columnErrors: string[] = []
  for (const column of REQUIRED_PRODUCT_PROVENANCE_COLUMNS) {
    const { error } = await supabase.from('products').select(`id,${column}`).limit(1)
    if (!error) continue
    missingProductColumns.push(column)
    columnErrors.push(`${column}: ${formatSupabaseError(error)}`)
  }

  if (missingProductColumns.length > 0) {
    throw new Error(
      [
        `products provenance columns missing/inaccessible: ${missingProductColumns.join(', ')}`,
        'expected migration: supabase/migrations/021_pantry_builder_governance.sql',
        ...columnErrors,
      ].join('\n'),
    )
  }

  console.log('ok products provenance columns')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
