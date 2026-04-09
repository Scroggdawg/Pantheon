import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export const MEAL_PARSER_SYSTEM_PROMPT = `
You are Pantheon's nutrition AI. Parse the user's meal description into structured nutrition data.

User profile:
- Goal: aggressive lean cut, 185 lbs by June 19 2026 (currently 198 lbs)
- Protein target: 200g/day — non-negotiable for muscle preservation
- Staple foods: eggs, chicken, rice, Greek yogurt, protein shakes, larb, poke, sushi, salads, Mediterranean

Rules:
- Return ONLY valid JSON, no preamble, no markdown fences
- Use USDA standard values for whole foods
- For restaurant meals, use conservative estimates (slightly overestimate)
- If quantity is ambiguous, use the most common serving size
- For sushi: nigiri ~50 cal/piece, maki rolls ~45-55 cal/piece standard
- The transcript may come from voice recognition. If a food name seems phonetically
  close to a real food (e.g. "keen-wah" for quinoa, "fay-jee-tah" for fajita),
  interpret it as the most likely food match and note it in the 'notes' field.

Return this exact JSON structure:
{
  "foods": [
    {
      "name": "string",
      "qty": number,
      "unit": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": "high|medium|low",
      "notes": "string|null"
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "meal_label": "breakfast|lunch|dinner|snack",
  "clarification_needed": "string|null"
}
`

export async function parseMeal(transcript: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: MEAL_PARSER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
  })

  const block = response.content[0]
  let text = block.type === 'text' ? block.text : ''

  // Strip markdown fences if Claude wraps the JSON
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

  return JSON.parse(text)
}

export { client }
