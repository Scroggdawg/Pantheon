// Op FASTRAK Brick Gamma C — LLM-fill for unit_alternatives data.
//
// For products without USDA (Gamma A) or OFF (Gamma B) coverage, generate
// plausible unit-to-grams conversions via Haiku. Single-shot per food;
// caller (backfill script) writes results to products.unit_alternatives.
//
// Architecture sibling to lib/usda/portions.ts and lib/off/search.ts.
// Used by:
//   - scripts/backfill-products-llm.ts (Gamma C.3 one-time backfill)
//   - future Gamma E bulk-add UI fall-through path
//
// Confidence capped at 'medium' server-side regardless of LLM output —
// LLM-fill always ranks BELOW user_corrected and below OFF/USDA per
// V20's locked source priority.

import Anthropic from '@anthropic-ai/sdk'
import type { UnitAlternative } from '@/types/database'

// Lazy-init: the Anthropic SDK reads ANTHROPIC_API_KEY at construction.
// In Vercel runtime the env var is set before any module loads. In
// scripts that load .env.local at runtime (eval-llm-fill, backfill-
// products-llm), import-hoisting would run `new Anthropic()` BEFORE
// the env loader fires, leaving the client with no API key.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 500

const SYSTEM_PROMPT = `You are Pantheon's unit-conversion assistant. Given a food name + brand,
output plausible unit-to-grams conversions for that food.

Output schema (JSON ONLY, no preamble, no markdown fences):
[
  {"unit": "<canonical lowercase unit name>", "grams": <number>, "confidence": "<low|medium>"},
  ...
]

Rules:
- Output 1-4 entries per food. More entries for foods with multiple
  common units (e.g., "1 banana" + "1 cup mashed" + "1 slice");
  fewer for foods with one canonical serving (e.g., "1 bar").
- Use lowercase unit names. Examples: "cup", "tbsp", "tsp", "fl oz",
  "bar", "scoop", "egg", "banana", "slice", "container", "bottle".
- For supplements/powders, "scoop" is canonical; check the brand
  for typical scoop size.
- Confidence: "medium" for foods with established conventions (eggs,
  bananas, common pantry items); "low" for branded products where
  exact serving sizes vary (Magic Spoon SKUs, niche brands, supplement
  scoop sizes).
- If you have NO confidence in any unit (truly unknown food, ambiguous
  name), return [] (empty array).
- Never output "high" confidence. The user's own correction overrides
  always rank above your output regardless.

Few-shot examples:
1. "Bananas" (brand: null) → [
     {"unit": "banana", "grams": 118, "confidence": "medium"},
     {"unit": "cup", "grams": 150, "confidence": "medium"},
     {"unit": "slice", "grams": 6, "confidence": "low"}
   ]
2. "Eggs - Large" (brand: null) → [
     {"unit": "egg", "grams": 50, "confidence": "medium"}
   ]
3. "Magic Spoon Cereal - Strawberry" (brand: Magic Spoon) → [
     {"unit": "cup", "grams": 35, "confidence": "low"}
   ]
4. "Quaker Rolled Oats" (brand: Quaker) → [
     {"unit": "cup", "grams": 80, "confidence": "low"},
     {"unit": "scoop", "grams": 40, "confidence": "low"}
   ]
5. "Manuka Honey" (brand: null) → [
     {"unit": "tbsp", "grams": 21, "confidence": "medium"},
     {"unit": "tsp", "grams": 7, "confidence": "medium"}
   ]
6. "Random unknown XYZ" (brand: null) → []`

interface LlmEntry {
  unit: unknown
  grams: unknown
  confidence: unknown
}

function parseAndValidate(rawText: string): UnitAlternative[] {
  // Strip markdown fences if the LLM ignored the "no markdown" instruction.
  let text = rawText.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  text = text.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: UnitAlternative[] = []
  for (const raw of parsed as LlmEntry[]) {
    if (!raw || typeof raw !== 'object') continue
    const unit = typeof raw.unit === 'string' ? raw.unit.toLowerCase().trim() : ''
    const gramsNum = typeof raw.grams === 'number' ? raw.grams : Number(raw.grams)
    const confidence = raw.confidence
    if (unit.length === 0) continue
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) continue

    // Cap confidence: LLM never gets 'high'. Default to 'low' on
    // anything we don't recognize.
    const cappedConfidence: UnitAlternative['confidence'] =
      confidence === 'medium' ? 'medium' : 'low'

    out.push({
      unit,
      grams: Math.round(gramsNum * 100) / 100,
      source: 'llm_estimated',
      confidence: cappedConfidence,
    })
  }
  return out
}

/**
 * Generate plausible unit_alternatives via Haiku for a single food.
 * Returns [] on any failure (network, parse, validation) — caller
 * falls through to "skip; hand-resolve" path.
 */
export async function llmFillPortions(
  name: string,
  brand: string | null,
): Promise<UnitAlternative[]> {
  if (!name || name.trim().length === 0) return []
  const userMessage = `Produce JSON for: "${name}" (brand: ${brand ?? 'null'})`
  try {
    const resp = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = resp.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return []
    return parseAndValidate(block.text)
  } catch (err) {
    console.warn(`[llmFillPortions] error for "${name}":`, (err as Error).message)
    return []
  }
}
