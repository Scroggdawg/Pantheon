import { client } from './claude'

const WORKOUT_PARSER_SYSTEM_PROMPT = `
You are Pantheon's workout AI. Parse the user's workout description into structured data.

User context:
- Training for body recomposition (cutting from 198 to 185 lbs)
- Typical lifts: push/pull/legs split, compound movements
- Also does BJJ and Zone 2 cardio

Rules:
- Return ONLY valid JSON, no preamble, no markdown fences
- Infer session_type from exercises: barbell/dumbbell work = "lift", rolling/sparring = "bjj", running/cycling/rowing = "zone2", other = "other"
- For each exercise, provide sets as an array of {reps, weight_lbs} objects
- Calculate total_volume_lbs = sum of (reps * weight) across all sets of all exercises
- Infer muscle_groups from exercise names (e.g., bench press = ["chest", "triceps", "shoulders"])
- If duration is mentioned, include it. Otherwise estimate based on exercise count.
- Use common exercise name conventions (e.g., "bench" = "Barbell Bench Press")

Return this exact JSON structure:
{
  "session_type": "lift|bjj|zone2|other",
  "duration_min": number|null,
  "exercises": [
    {
      "exercise_name": "string",
      "muscle_groups": ["string"],
      "sets": [
        { "reps": number, "weight_lbs": number }
      ],
      "total_volume_lbs": number,
      "notes": "string|null"
    }
  ],
  "total_volume_lbs": number,
  "notes": "string|null",
  "clarification_needed": "string|null"
}
`

export interface ParsedExercise {
  exercise_name: string
  muscle_groups: string[]
  sets: { reps: number; weight_lbs: number }[]
  total_volume_lbs: number
  notes: string | null
}

export interface ParsedWorkoutResponse {
  session_type: 'lift' | 'bjj' | 'zone2' | 'other'
  duration_min: number | null
  exercises: ParsedExercise[]
  total_volume_lbs: number
  notes: string | null
  clarification_needed: string | null
  imageUrl?: string | null
}

export async function parseWorkout(transcript: string): Promise<ParsedWorkoutResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: WORKOUT_PARSER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
  })

  const block = response.content[0]
  let text = block.type === 'text' ? block.text : ''
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

  return JSON.parse(text)
}
