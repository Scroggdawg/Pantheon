import { readFileSync } from 'fs'

const TOKEN = 'sbp_c310e68f8505db245fdcf129d9ba009a4338596c'
const PROJECT_REF = 'qlkjgguxjddalbswoxpm'
const URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

// Fix the exercises_own policy syntax issue
let sql = readFileSync('supabase/migrations/001_schema.sql', 'utf-8')

// Fix: "session_id in (...)" doesn't work as RLS — need a proper subquery check
sql = sql.replace(
  `create policy "exercises_own" on workout_exercises for all using (auth.uid() = session_id in (select id from workout_sessions where user_id = auth.uid()));`,
  `create policy "exercises_own" on workout_exercises for all using (session_id in (select id from workout_sessions where user_id = auth.uid()));`
)

const res = await fetch(URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
console.log('Status:', res.status)
console.log('Response:', text)
