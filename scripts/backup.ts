// Pantheon Data Backup
// Run: npm run backup
// Schedule: before every coding session, or at minimum once per week.
// Store backup files in a safe location (Google Drive, etc).
// These are your only local copy of all nutrition/fitness data.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse .env.local manually (no dotenv dependency)
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx)
  const val = trimmed.slice(eqIdx + 1)
  if (!process.env[key]) process.env[key] = val
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const TABLES = [
  'users',
  'food_log_entries',
  'saved_meals',
  'workout_sessions',
  'workout_exercises',
  'weight_readings',
  'voice_corrections',
]

async function backup() {
  const timestamp = new Date().toISOString().split('T')[0]
  const backupDir = join(__dirname, '..', 'backups')
  mkdirSync(backupDir, { recursive: true })

  const data: Record<string, unknown[]> = {}
  let totalRows = 0

  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*')

    if (error) {
      console.warn(`  [SKIP] ${table}: ${error.message}`)
      data[table] = []
      continue
    }

    data[table] = rows || []
    const count = (rows || []).length
    totalRows += count
    console.log(`  ${table}: ${count} rows`)
  }

  const filename = `pantheon-backup-${timestamp}.json`
  const filepath = join(backupDir, filename)

  const output = JSON.stringify(data, null, 2)
  writeFileSync(filepath, output)

  const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1)
  console.log(`\nBackup saved: ${filepath}`)
  console.log(`Total: ${totalRows} rows, ${sizeKB} KB`)
}

backup().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})
