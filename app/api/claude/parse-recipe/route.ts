import { parseRecipe } from '@/lib/claude/recipe'

const MAX_RECIPE_TEXT_CHARS = 12000
const MAX_HINT_NAME_CHARS = 160

export async function POST(request: Request) {
  try {
    const { text, hint_name } = await request.json()

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length > MAX_RECIPE_TEXT_CHARS) {
      return Response.json(
        { error: `text must be ${MAX_RECIPE_TEXT_CHARS} characters or less` },
        { status: 413 },
      )
    }

    if (hint_name !== undefined && typeof hint_name !== 'string') {
      return Response.json(
        { error: 'hint_name must be a string when provided' },
        { status: 400 },
      )
    }
    if (typeof hint_name === 'string' && hint_name.length > MAX_HINT_NAME_CHARS) {
      return Response.json(
        { error: `hint_name must be ${MAX_HINT_NAME_CHARS} characters or less` },
        { status: 413 },
      )
    }

    console.log('[parse-recipe] Parsing:', text.slice(0, 120))
    const parsed = await parseRecipe(text, hint_name)

    // Log _estimation_notes server-side for debugging visibility
    // (dev console + Vercel function logs), then strip from the
    // response so the API contract matches the brief verbatim.
    if (parsed && typeof parsed === 'object' && '_estimation_notes' in parsed) {
      console.log('[parse-recipe] estimation_notes:', parsed._estimation_notes)
      delete parsed._estimation_notes
    }

    console.log('[parse-recipe] Success:', JSON.stringify(parsed).slice(0, 200))
    return Response.json(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[parse-recipe] FULL ERROR:', message)
    if (stack) console.error('[parse-recipe] Stack:', stack)
    return Response.json({ error: message }, { status: 500 })
  }
}
