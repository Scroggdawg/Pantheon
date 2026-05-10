// Op FASTRAK — Greek God Bod pantry bulk-add automation.
//
// Parses GREEK_GOD_BOD_PANTRY_LIBRARY_EXPANSION.md by category, runs each
// non-RECIPE-ANCHORS category in batches of 25 against /api/admin/pantry/
// search, applies a tiered auto-pick strategy, and (optionally) saves the
// picked rows via /api/admin/pantry/save.
//
// Auto-pick rules (per Phase 0 §2):
//   Tier 1: USDA Foundation/FNDDS, kcal != null, token-overlap ≥ threshold
//   Tier 2 (only if Tier 1 returns nothing): OFF with nutriscore_grade,
//           token-overlap ≥ threshold
//   Otherwise: 'eyeball' (Luke handles via /admin/pantry UI)
//   already_exists: 'dedup-skip'
//   Category 'RECIPE ANCHORS': 'composite-manual' (skip without searching)
//
// Auth: POST /api/auth/login with PANTHEON_PASSWORD → captures
// pantheon_session=1 cookie. Subsequent requests include cookie.
//
// Run:
//   npx tsx scripts/bulk-add-greek-god-bod.ts \
//     --category="LEAN PROTEINS" --dry-run
//
// Flags:
//   --doc=<path>          override pantry doc path
//   --api-base=<url>      override API base (default: pantheon.guru)
//   --category=<name>     run a single category (else all non-anchor)
//   --dry-run             print picks; don't save
//   --threshold=<float>   token-overlap floor (default 0.6)
//   --batch-size=<int>    names per /search call (default 25)
//   --limit=<int>         cap entries processed per category

import { readFileSync } from 'fs'
import { join } from 'path'

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
loadEnvLocal()

// ---------------------------------------------------------------------
// Config + arg parsing
// ---------------------------------------------------------------------

interface Args {
  docPath: string
  apiBase: string
  categories: string[] | null  // null = all non-anchor; comma-separated supported
  dryRun: boolean
  threshold: number
  batchSize: number
  limit: number | null
}

const DEFAULT_DOC =
  '/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon/GREEK_GOD_BOD_PANTRY_LIBRARY_EXPANSION.md'

function parseArgs(argv: string[]): Args {
  let docPath = DEFAULT_DOC
  let apiBase = process.env.EXPO_PUBLIC_API_BASE ?? 'https://pantheon.guru'
  let categories: string[] | null = null
  let dryRun = false
  let threshold = 0.6
  let batchSize = 25
  let limit: number | null = null

  for (const a of argv.slice(2)) {
    if (a === '--dry-run') dryRun = true
    else if (a.startsWith('--doc=')) docPath = a.slice('--doc='.length)
    else if (a.startsWith('--api-base=')) apiBase = a.slice('--api-base='.length).replace(/\/+$/, '')
    else if (a.startsWith('--category=')) {
      // Comma-separated for multi-category runs (wave dry-runs)
      categories = a
        .slice('--category='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    }
    else if (a.startsWith('--threshold=')) threshold = Number(a.slice('--threshold='.length))
    else if (a.startsWith('--batch-size=')) batchSize = parseInt(a.slice('--batch-size='.length), 10)
    else if (a.startsWith('--limit=')) limit = parseInt(a.slice('--limit='.length), 10)
  }
  return { docPath, apiBase, categories, dryRun, threshold, batchSize, limit }
}

// ---------------------------------------------------------------------
// Parse pantry doc → categories
// ---------------------------------------------------------------------

const RECIPE_ANCHORS_NAME = 'RECIPE ANCHORS'

interface ParsedDoc {
  categories: Map<string, string[]>
  order: string[]
}

function parsePantryDoc(path: string): ParsedDoc {
  const content = readFileSync(path, 'utf8')
  const lines = content.split('\n')
  const categories = new Map<string, string[]>()
  const order: string[] = []

  let currentCategory: string | null = null
  let inCodeBlock = false

  for (const raw of lines) {
    const trimmed = raw.trim()

    // Top-level `## ` header resets currentCategory — bounds the
    // category section. Without this, code blocks under later sections
    // (e.g., "## TERMINAL INSTRUCTIONS" with its embedded paste-ready
    // brief) leak into the last ### category. NB: must precede the
    // `### ` check below since `### ` also starts with `## `.
    if (
      !inCodeBlock &&
      trimmed.startsWith('## ') &&
      !trimmed.startsWith('### ')
    ) {
      currentCategory = null
      continue
    }

    // Detect category header. Headers under "## THE LIST" use ###; we
    // pick up everything that starts with "### " and treat the line up
    // to the first " (" or end as the category name.
    if (trimmed.startsWith('### ') && !inCodeBlock) {
      const heading = trimmed.slice(4).trim()
      // Strip parenthetical clarifications, e.g.
      // "EGG / DAIRY (Mediterranean utility)" → "EGG / DAIRY"
      const parenIdx = heading.indexOf('(')
      const name = (parenIdx >= 0 ? heading.slice(0, parenIdx) : heading).trim()
      currentCategory = name
      if (!categories.has(name)) {
        categories.set(name, [])
        order.push(name)
      }
      continue
    }

    if (trimmed === '```' || trimmed === '```text') {
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock && currentCategory && trimmed.length > 0) {
      categories.get(currentCategory)!.push(trimmed)
    }
  }

  return { categories, order }
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

async function authenticate(apiBase: string): Promise<string> {
  const password = process.env.PANTHEON_PASSWORD
  if (!password) throw new Error('PANTHEON_PASSWORD missing from env')
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = /pantheon_session=([^;]+)/.exec(setCookie)
  if (!match) throw new Error('login response missing pantheon_session cookie')
  return `pantheon_session=${match[1]}`
}

async function fetchUserId(apiBase: string, cookie: string): Promise<string> {
  const res = await fetch(`${apiBase}/api/user`, {
    headers: { cookie },
  })
  if (!res.ok) throw new Error(`/api/user failed: ${res.status}`)
  const u = (await res.json()) as { id?: string }
  if (!u.id) throw new Error('/api/user returned no id')
  return u.id
}

// ---------------------------------------------------------------------
// Search + save shapes (mirror of api/admin/pantry endpoints)
// ---------------------------------------------------------------------

interface OffProductLite {
  code: string
  brands?: string
  product_name?: string
  serving_size?: string
  serving_quantity?: number
  serving_quantity_unit?: string
  nutriments?: Record<string, number | undefined>
  nutriscore_grade?: string
}

interface UsdaCandidate {
  fdc_id: number
  description: string
  data_type: string
  brand: string | null
  per_serving: {
    kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }
}

interface SearchResultRow {
  input_name: string
  already_exists?: { product_id: string; existing_name: string }
  off: OffProductLite[]
  usda: UsdaCandidate[]
  off_error?: string
  usda_error?: string
  dedup_error?: string
}

interface SearchResponse {
  results: SearchResultRow[]
}

interface PickedRowOff {
  source: 'off'
  input_name: string
  off_index: number
}
interface PickedRowUsda {
  source: 'usda'
  input_name: string
  fdc_id: number
  description: string
  brand: string | null
  per_serving: UsdaCandidate['per_serving']
}
type PickedRow = PickedRowOff | PickedRowUsda

interface SaveResultRow {
  input_name: string
  status: 'saved' | 'failed'
  product_id?: string
  error?: string
}

async function postSearch(
  apiBase: string,
  cookie: string,
  names: string[],
): Promise<SearchResponse> {
  const res = await fetch(`${apiBase}/api/admin/pantry/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ names }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/search ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as SearchResponse
}

async function postSave(
  apiBase: string,
  cookie: string,
  userId: string,
  rows: PickedRow[],
): Promise<SaveResultRow[]> {
  const res = await fetch(`${apiBase}/api/admin/pantry/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ user_id: userId, rows }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/save ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results: SaveResultRow[] }
  return data.results
}

// ---------------------------------------------------------------------
// Token-overlap heuristic
// ---------------------------------------------------------------------

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'with', 'in', 'and', 'or'])

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  )
}

function overlapRatio(input: Set<string>, candidate: Set<string>): number {
  if (input.size === 0) return 0
  let intersection = 0
  for (const t of input) if (candidate.has(t)) intersection += 1
  return intersection / input.size
}

// R.1 — strong-descriptor token presence rule.
//
// When input contains a "strong descriptor" (e.g. "ground", "lean", "raw"),
// the candidate description MUST also contain that token (or a synonym).
// Catches "Ground venison" → "Venison, steak" miss surfaced in the LEAN
// PROTEINS dry-run: token-overlap was 0.50 (passes 0.5 floor) but the
// candidate is a different cut entirely (steak vs ground).
//
// Synonyms map covers cases where USDA's description uses a related but
// not identical token. Conservative — only well-established equivalences.
const STRONG_DESCRIPTORS: Record<string, string[]> = {
  ground:        ['ground', 'minced'],
  whole:         ['whole'],
  raw:           ['raw', 'uncooked'],
  lean:          ['lean'],
  'reduced-fat': ['reduced-fat', 'reduced', 'low-fat', 'lowfat'],
  'low-sodium':  ['low-sodium', 'low', 'unsalted'],
  frozen:        ['frozen'],
  dried:         ['dried', 'dehydrated'],
}

function passesDescriptorCheck(input: Set<string>, candidate: Set<string>): {
  ok: boolean
  failedDescriptor?: string
} {
  for (const [desc, synonyms] of Object.entries(STRONG_DESCRIPTORS)) {
    if (!input.has(desc)) continue
    const candidateHasOne = synonyms.some((syn) => candidate.has(syn))
    if (!candidateHasOne) {
      return { ok: false, failedDescriptor: desc }
    }
  }
  return { ok: true }
}

// R.2 — meat-source check.
//
// When input contains a meat-source token (beef/pork/chicken/turkey/etc.),
// the candidate description MUST contain that exact token. Catches
// "Lean ground beef 93%" → "Turkey, ground, 93% lean" miss surfaced in
// post-Path-B re-dry-run: token-overlap was 0.75 (passes 0.6) and R.1
// descriptor check passed (both have "lean", "ground"), but candidate
// is a different protein entirely (turkey vs beef).
//
// 'fish' is a soft-generic: when input has 'fish', any specific fish
// (salmon/tuna/cod/etc.) in candidate is acceptable.
const MEAT_SOURCES = new Set([
  'beef', 'pork', 'chicken', 'turkey', 'lamb', 'venison',
  'bison', 'duck', 'goose', 'rabbit', 'veal',
  'salmon', 'tuna', 'cod', 'halibut', 'shrimp', 'swordfish',
  'tilapia', 'mackerel', 'trout', 'sardine', 'sardines',
  'fish',
])
const SPECIFIC_FISH = new Set([
  'salmon', 'tuna', 'cod', 'halibut', 'shrimp', 'swordfish',
  'tilapia', 'mackerel', 'trout', 'sardine', 'sardines',
])

function passesMeatSourceCheck(input: Set<string>, candidate: Set<string>): {
  ok: boolean
  failedSource?: string
} {
  for (const source of MEAT_SOURCES) {
    if (!input.has(source)) continue
    if (candidate.has(source)) continue
    // Soft-generic: input "fish" passes if candidate has any specific fish.
    if (source === 'fish') {
      const anyFishInCandidate = [...SPECIFIC_FISH].some((s) => candidate.has(s))
      if (anyFishInCandidate) continue
    }
    return { ok: false, failedSource: source }
  }
  return { ok: true }
}

// R.2.5 — inverse meat-source check.
//
// When candidate contains any meat token but input contains none, the
// candidate is structurally a different food category (e.g.,
// "Spaghetti squash" → "Sweet Chilli Chicken with Butternut Squash
// Spaghetti" — overlap 1.00 because spaghetti+squash both appear, but
// the candidate is a chicken dish). R.2 only catches the symmetric case
// (input-has-meat + candidate-doesnt); inverse catches this asymmetric
// failure mode.
function passesInverseMeatCheck(input: Set<string>, candidate: Set<string>): {
  ok: boolean
  foundCandidateMeat?: string
} {
  // Skip if input has any meat-source token at all.
  for (const source of MEAT_SOURCES) {
    if (input.has(source)) return { ok: true }
  }
  // Input has no meat — candidate must have none either.
  for (const source of MEAT_SOURCES) {
    if (source === 'fish') continue  // 'fish' as a generic isn't a strong rejector signal
    if (candidate.has(source)) return { ok: false, foundCandidateMeat: source }
  }
  return { ok: true }
}

// R.3 — preparation-state / dish-class filter.
//
// Wave 1 LEAN PROTEINS dry-run was clean, but wave 1 vegetables/dairy/
// med-greek surfaced ~17 wrong picks where the matcher couldn't tell the
// candidate was a different dish entirely (Lime → "Lime souffle", Eggplant
// → "Eggplant dip", etc.) or had unwanted preparation (Beets → "Beets,
// pickled"). R.3 covers both with two layers:
//
//   DISH_CLASS_TOKENS — hard reject. Candidate that's a bread/dip/sauce/
//   salad/cake/etc. is structurally a different food category from a
//   generic produce/dairy/protein input. The matcher should never auto-
//   pick across food categories.
//
//   PREPARATION_TOKENS — soft reject only when input doesn't carry the
//   same prep token. E.g., "Crushed tomatoes (canned)" matches
//   "Tomatoes, canned, ..." but "Spaghetti squash" should NOT match
//   "Spaghetti squash, cooked" if Luke's logging raw weight.
//
// Doesn't yet handle primary-noun mismatches (Ricotta → Mozzarella);
// V20 deferred R.4 unless residual wrong-picks emerge.
const DISH_CLASS_TOKENS = new Set([
  'bread', 'crackers', 'cracker', 'dip', 'sauce', 'salad',
  'souffle', 'tots', 'spreadable', 'spread',
  'cake', 'cookie', 'cookies', 'pie', 'muffin', 'pancake', 'pancakes',
  'roll', 'rolls', 'bagel', 'pastry', 'casserole',
  'soup', 'stew', 'chili',
  // Path E additions (wave 1 dry-run #2 residuals):
  'mayo', 'mayonnaise',
  'mix', 'wrap', 'burrito', 'taco', 'burger',
  'pizza', 'nuggets', 'patty', 'patties', 'lasagna',
  'smoothie', 'sandwich', 'sushi',
  // Path E.1 additions (wave 1 dry-run #3 residuals):
  'pickles', 'kimchi', 'sauerkraut',
])

// R.3.5 — inherently-prepared input override.
//
// Some Pantheon inputs ARE intrinsically a prepared-dish category
// (Pita, Tzatziki, Hummus). When input contains one of these tokens,
// skip the dish-class rejection — the candidate having "bread" / "dip"
// is correct semantics, not a wrong-category match.
const INHERENTLY_PREPARED_INPUTS = new Set([
  'pita', 'tzatziki', 'hummus', 'falafel', 'naan',
  'lavash', 'tortilla', 'sushi',
  'baba', 'ganoush',  // baba ganoush split across tokenize
])

// Returns the matched token (so R.3.5b can require candidate to contain it),
// or null when input has no inherently-prepared token.
function inputPreparedToken(input: Set<string>): string | null {
  for (const tok of INHERENTLY_PREPARED_INPUTS) {
    if (input.has(tok)) return tok
  }
  return null
}

// Tokens indicating preparation/cooking method that change macros.
// 'with' + 'added' catch combinations like "cooked with oil" / "fat added".
// 'crumbles' catches FNDDS pan-broiled cooked-as-eaten variants.
const PREPARATION_TOKENS = new Set([
  'cooked', 'pickled', 'fried', 'baked', 'broiled',
  'grilled', 'roasted', 'steamed', 'boiled', 'sauteed',
  'stuffed', 'crumbles', 'with', 'added',
  // Path E.1 additions (Green beans → "canned, drained" miss):
  'canned', 'drained', 'frozen',
])

// R.6 — anti-flour rule.
//
// Wave 1 + 2 surfaced 4 wrong picks of the same class: input is a specific
// carb/grain item (Tortillas, Brown rice, Couscous, Pasta) and USDA returns
// "Flour, X" entries with high token overlap. R.3.5b only catches a curated
// list of inherently-prepared inputs (pita, tortilla, etc.) and doesn't
// generalize. R.6 catches the dual: any candidate whose description LEADS
// with "flour" must be matched against an input that explicitly mentions
// "flour" — otherwise reject.
//
// Operates on the raw description string (not tokenized) so it can inspect
// position. USDA Foundation conventions: "Flour, whole wheat" / "Flour,
// rice, brown" — flour is always position-0. OFF brand-prefixed entries
// like "Bob's Red Mill ..." don't lead with flour, so don't false-positive.
function passesAntiFlourCheck(input: Set<string>, candidateDescription: string): boolean {
  if (input.has('flour')) return true  // input wants flour, ok
  const firstTokens = candidateDescription
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t.length > 0)
    .slice(0, 2)
  return !firstTokens.includes('flour')
}

// R.7 — OFF brand-fluff anti-pattern.
//
// Three occurrences across waves 1-2 of the same OFF failure class:
//   Lime    → "Tourtel 27.5 cl Tourtel Twist Lime 0.0 DEGRE ALCOOL" (alcoholic beverage)
//   Orange  → "Biscuit soja orange" (soy biscuit)
//   Papaya  → "Mango Papaya Passion Fruit Yogurt" (yogurt mix)
//
// Pattern: short generic-produce input (1-2 tokens), OFF returns a
// long branded composite where the input keyword is just one ingredient
// in a multi-component product. R.1-R.6 don't catch because tokens
// overlap and dish-class doesn't include yogurt/biscuit/beverage variants.
//
// R.7 heuristic: when input is short (≤2 tokens), candidate is long
// (≥4 tokens after stopword filter), AND candidate's first non-stopword
// token isn't in input → reject. This protects:
//   - Hummus → "Hummus Classic" (2 candidate tokens, short → pass)
//   - Cheerios → "Cheerios Aveia" (first candidate token in input → pass)
//   - Mango → "Mango ohne Zuckerzusatz" (3 candidate tokens, leads with input → pass)
// While catching:
//   - Lime/Orange/Papaya brand-fluff cases above (≥4 tokens, first token not in input)
//
// Apply ONLY to OFF Tier 2. USDA Foundation/FNDDS conventions are
// food-first ("Mango, raw") so they don't exhibit this pattern.
function passesOffBrandFluffCheck(input: Set<string>, candidateName: string): boolean {
  if (input.size > 2) return true  // multi-token input is specific enough
  const tokens = candidateName
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
  if (tokens.length < 4) return true  // short candidate likely real match
  const firstToken = tokens[0]
  if (input.has(firstToken)) return true  // candidate leads with input token
  return false  // brand-fluff: long candidate, first token unrelated
}

function passesPrepCheck(input: Set<string>, candidate: Set<string>): {
  ok: boolean
  rejected?: string
  layer?: 'dish-class' | 'preparation'
} {
  // R.3.5 / R.3.5b — when input has an inherently-prepared token (Pita,
  // Tzatziki, etc.), the candidate MUST also contain that token. If yes,
  // skip dish-class rejection (Tzatziki "dip" / Pita "bread" are correct
  // semantics). If no, REJECT — Pita-input → "Flour..." candidate is a
  // primary-noun mismatch (soft R.4 for inherently-prepared inputs only).
  const inputPrep = inputPreparedToken(input)
  if (inputPrep !== null) {
    if (!candidate.has(inputPrep)) {
      return { ok: false, rejected: inputPrep, layer: 'dish-class' }
    }
    // candidate has the token → skip dish-class check entirely
  } else {
    for (const tok of candidate) {
      if (DISH_CLASS_TOKENS.has(tok)) {
        return { ok: false, rejected: tok, layer: 'dish-class' }
      }
    }
  }
  for (const tok of candidate) {
    if (PREPARATION_TOKENS.has(tok) && !input.has(tok)) {
      return { ok: false, rejected: tok, layer: 'preparation' }
    }
  }
  return { ok: true }
}

// Per-row force-eyeball overrides.
//
// When dry-run review surfaces an auto-pick that's protein/cut-correct but
// has a different precision-class mismatch (fat-percentage delta etc.),
// drop the input name here to force eyeball regardless of strategy outcome.
// Cleaner than save-then-delete: prevents transient bad data in production.
const OVERRIDE_EYEBALL = new Set<string>([
  // Smoke 3 review (Luke + V20): auto-picked Turkey ground 93% which has
  // ~40% different kcal vs the requested 99%. Manual at /admin/pantry.
  'Ground turkey 99% lean',
  // Wave 1 dry-run #2: auto-picked Yogurt, Greek, plain, NONFAT — Luke
  // logged 2%. Fat-percentage precision class isn't covered by R.1-R.3.
  'Greek yogurt 2% plain (Fage)',
])

// Category-level scope pruning (Luke 2026-05-09).
//
// Some categories live inside recipe-level macros, not voice-logged
// individually. Skip them entirely.
const SKIP_CATEGORIES = new Set<string>([
  'HERBS + SPICES',  // 24 entries — zero/negligible kcal; recipe-internal
])

// Per-category entry keepers. When a category appears here, only the
// listed entries from that category are processed; the rest are skipped.
// Categories not in this map are processed in full (subject to SKIP_CATEGORIES).
const KEEP_ENTRIES: Record<string, Set<string>> = {
  'ASIAN PANTRY': new Set([
    'Soy sauce low-sodium',
    'Sesame oil',
    'Gochujang',
    'Sriracha',
    'Kimchi',
  ]),
  'CONDIMENTS / DRESSING BUILDING BLOCKS': new Set([
    'Dijon mustard',
    'Anchovy paste',
    'Hot sauce',
  ]),
}

// ---------------------------------------------------------------------
// Auto-pick strategy
// ---------------------------------------------------------------------

interface AutoPickOutcome {
  pick: PickedRow | null
  reason:
    | 'usda'
    | 'off'
    | 'no-match'
    | 'no-candidates'
    | 'descriptor-fail'
    | 'meat-source-fail'
    | 'inverse-meat-fail'
    | 'dish-class-fail'
    | 'preparation-fail'
    | 'anti-flour-fail'
    | 'off-brand-fluff'
    | 'override'
  matched: { name: string; source: string; overlap: number } | null
  rejectedDescriptor?: string  // surface which descriptor failed for eyeball context
  rejectedMeatSource?: string  // surface which meat-source failed for eyeball context
  rejectedInverseMeat?: string  // surface which candidate-meat triggered inverse rejection
  rejectedPrep?: string  // surface which dish-class / prep token rejected
}

function autoPickStrategy(
  input: string,
  result: SearchResultRow,
  threshold: number,
): AutoPickOutcome {
  // Per-row override: force eyeball before any candidate scoring runs.
  if (OVERRIDE_EYEBALL.has(input)) {
    return { pick: null, reason: 'override', matched: null }
  }

  const inputTokens = tokenize(input)

  // Tier 1: USDA Foundation/FNDDS with non-null kcal
  const tier1 = result.usda.filter(
    (u) =>
      (u.data_type === 'Foundation' || u.data_type === 'Survey (FNDDS)') &&
      u.per_serving.kcal !== null,
  )
  let bestUsda:
    | {
        u: UsdaCandidate
        overlap: number
        descriptorOk: boolean
        failedDesc?: string
        meatOk: boolean
        failedMeat?: string
        invMeatOk: boolean
        failedInvMeat?: string
        prepOk: boolean
        prepRejected?: string
        prepLayer?: 'dish-class' | 'preparation'
        flourOk: boolean
      }
    | null = null
  for (const u of tier1) {
    const candTokens = tokenize(u.description)
    const overlap = overlapRatio(inputTokens, candTokens)
    if (overlap < threshold) continue
    const descCheck = passesDescriptorCheck(inputTokens, candTokens)
    const meatCheck = passesMeatSourceCheck(inputTokens, candTokens)
    const invMeatCheck = passesInverseMeatCheck(inputTokens, candTokens)
    const prepCheck = passesPrepCheck(inputTokens, candTokens)
    const flourOk = passesAntiFlourCheck(inputTokens, u.description)
    if (!bestUsda || overlap > bestUsda.overlap) {
      bestUsda = {
        u,
        overlap,
        descriptorOk: descCheck.ok,
        failedDesc: descCheck.failedDescriptor,
        meatOk: meatCheck.ok,
        failedMeat: meatCheck.failedSource,
        invMeatOk: invMeatCheck.ok,
        failedInvMeat: invMeatCheck.foundCandidateMeat,
        prepOk: prepCheck.ok,
        prepRejected: prepCheck.rejected,
        prepLayer: prepCheck.layer,
        flourOk,
      }
    }
  }
  if (bestUsda && bestUsda.descriptorOk && bestUsda.meatOk && bestUsda.invMeatOk && bestUsda.prepOk && bestUsda.flourOk) {
    return {
      pick: {
        source: 'usda',
        input_name: input,
        fdc_id: bestUsda.u.fdc_id,
        description: bestUsda.u.description,
        brand: bestUsda.u.brand,
        per_serving: bestUsda.u.per_serving,
      },
      reason: 'usda',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
    }
  }

  // Path δ cascade (smoke-3 → variance-halt fix): when USDA Tier 1 has no
  // clean pick (empty OR R.1/R.2-rejected), fall through to OFF Tier 2
  // unconditionally. R.2 should reject wrong-protein USDA candidates AND
  // give OFF a chance to provide a correct alternative; previously OFF
  // only ran when tier1 was empty, so a USDA Turkey pick rejected by R.2
  // for "Lean ground beef 93%" masked the correct OFF "Ground Beef 93%
  // Lean 7% Fat" branded match.
  const ranked = result.off.filter(
    (p) => p.nutriscore_grade && p.nutriscore_grade !== 'unknown',
  )
  let bestOff:
    | {
        p: OffProductLite
        idx: number
        overlap: number
        descriptorOk: boolean
        failedDesc?: string
        meatOk: boolean
        failedMeat?: string
        invMeatOk: boolean
        failedInvMeat?: string
        prepOk: boolean
        prepRejected?: string
        prepLayer?: 'dish-class' | 'preparation'
        flourOk: boolean
        brandFluffOk: boolean
      }
    | null = null
  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i]
    const offDescription = `${p.brands ?? ''} ${p.product_name ?? ''}`
    const candTokens = tokenize(offDescription)
    const overlap = overlapRatio(inputTokens, candTokens)
    if (overlap < threshold) continue
    const descCheck = passesDescriptorCheck(inputTokens, candTokens)
    const meatCheck = passesMeatSourceCheck(inputTokens, candTokens)
    const invMeatCheck = passesInverseMeatCheck(inputTokens, candTokens)
    const prepCheck = passesPrepCheck(inputTokens, candTokens)
    const flourOk = passesAntiFlourCheck(inputTokens, offDescription)
    const brandFluffOk = passesOffBrandFluffCheck(inputTokens, offDescription)
    if (!bestOff || overlap > bestOff.overlap) {
      const origIdx = result.off.indexOf(p)
      bestOff = {
        p,
        idx: origIdx,
        overlap,
        descriptorOk: descCheck.ok,
        failedDesc: descCheck.failedDescriptor,
        meatOk: meatCheck.ok,
        failedMeat: meatCheck.failedSource,
        invMeatOk: invMeatCheck.ok,
        failedInvMeat: invMeatCheck.foundCandidateMeat,
        prepOk: prepCheck.ok,
        prepRejected: prepCheck.rejected,
        prepLayer: prepCheck.layer,
        flourOk,
        brandFluffOk,
      }
    }
  }
  if (bestOff && bestOff.descriptorOk && bestOff.meatOk && bestOff.invMeatOk && bestOff.prepOk && bestOff.flourOk && bestOff.brandFluffOk) {
    return {
      pick: {
        source: 'off',
        input_name: input,
        off_index: bestOff.idx,
      },
      reason: 'off',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
    }
  }

  // Both tiers failed — surface the most informative eyeball reason.
  // Prefer USDA's failure reason since it's the higher-tier candidate;
  // fall back to OFF's failure reason if USDA had no candidate at all.
  if (bestUsda && !bestUsda.descriptorOk) {
    return {
      pick: null,
      reason: 'descriptor-fail',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
      rejectedDescriptor: bestUsda.failedDesc,
    }
  }
  if (bestUsda && !bestUsda.meatOk) {
    return {
      pick: null,
      reason: 'meat-source-fail',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
      rejectedMeatSource: bestUsda.failedMeat,
    }
  }
  if (bestUsda && !bestUsda.invMeatOk) {
    return {
      pick: null,
      reason: 'inverse-meat-fail',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
      rejectedInverseMeat: bestUsda.failedInvMeat,
    }
  }
  if (bestUsda && !bestUsda.prepOk) {
    return {
      pick: null,
      reason: bestUsda.prepLayer === 'dish-class' ? 'dish-class-fail' : 'preparation-fail',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
      rejectedPrep: bestUsda.prepRejected,
    }
  }
  if (bestUsda && !bestUsda.flourOk) {
    return {
      pick: null,
      reason: 'anti-flour-fail',
      matched: {
        name: bestUsda.u.description,
        source: `usda/${bestUsda.u.data_type}`,
        overlap: bestUsda.overlap,
      },
    }
  }
  if (bestOff && !bestOff.descriptorOk) {
    return {
      pick: null,
      reason: 'descriptor-fail',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
      rejectedDescriptor: bestOff.failedDesc,
    }
  }
  if (bestOff && !bestOff.meatOk) {
    return {
      pick: null,
      reason: 'meat-source-fail',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
      rejectedMeatSource: bestOff.failedMeat,
    }
  }
  if (bestOff && !bestOff.invMeatOk) {
    return {
      pick: null,
      reason: 'inverse-meat-fail',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
      rejectedInverseMeat: bestOff.failedInvMeat,
    }
  }
  if (bestOff && !bestOff.prepOk) {
    return {
      pick: null,
      reason: bestOff.prepLayer === 'dish-class' ? 'dish-class-fail' : 'preparation-fail',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
      rejectedPrep: bestOff.prepRejected,
    }
  }
  if (bestOff && !bestOff.flourOk) {
    return {
      pick: null,
      reason: 'anti-flour-fail',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
    }
  }
  if (bestOff && !bestOff.brandFluffOk) {
    return {
      pick: null,
      reason: 'off-brand-fluff',
      matched: {
        name: bestOff.p.product_name ?? '(unnamed)',
        source: `off/nutriscore=${bestOff.p.nutriscore_grade}`,
        overlap: bestOff.overlap,
      },
    }
  }

  if (result.off.length === 0 && result.usda.length === 0) {
    return { pick: null, reason: 'no-candidates', matched: null }
  }
  return { pick: null, reason: 'no-match', matched: null }
}

// ---------------------------------------------------------------------
// Per-row decision logging
// ---------------------------------------------------------------------

type Decision =
  | 'auto-saved'
  | 'auto-pick (dry-run)'
  | 'eyeball'
  | 'dedup-skip'
  | 'composite-manual'
  | 'search-failed'
  | 'save-failed'

interface RowLog {
  inputName: string
  decision: Decision
  matched?: { name: string; source: string; overlap: number }
  reason?: string
  productId?: string
}

function fmtDecision(d: Decision): string {
  switch (d) {
    case 'auto-saved':           return '✓ saved   '
    case 'auto-pick (dry-run)':  return '~ would-pick'
    case 'eyeball':              return '? eyeball '
    case 'dedup-skip':           return '· dedup   '
    case 'composite-manual':     return '· manual  '
    case 'search-failed':        return '✗ search-x'
    case 'save-failed':          return '✗ save-x  '
  }
}

function printRowLog(row: RowLog) {
  let line = `  ${fmtDecision(row.decision)} ${row.inputName.padEnd(45)}`
  if (row.matched) {
    line += ` → ${row.matched.name.slice(0, 50).padEnd(50)} [${row.matched.source}, ${row.matched.overlap.toFixed(2)}]`
  } else if (row.reason) {
    line += ` (${row.reason})`
  }
  console.log(line)
}

// ---------------------------------------------------------------------
// Process a single category
// ---------------------------------------------------------------------

interface CategoryStats {
  total: number
  autoSaved: number
  autoPickDryRun: number
  eyeball: number
  dedupSkip: number
  compositeManual: number
  searchFailed: number
  saveFailed: number
  rows: RowLog[]
}

async function processCategory(
  cat: string,
  names: string[],
  args: Args,
  cookie: string,
  userId: string,
): Promise<CategoryStats> {
  const stats: CategoryStats = {
    total: names.length,
    autoSaved: 0,
    autoPickDryRun: 0,
    eyeball: 0,
    dedupSkip: 0,
    compositeManual: 0,
    searchFailed: 0,
    saveFailed: 0,
    rows: [],
  }

  console.log(`\n=== ${cat} (${names.length} entries) ===`)

  if (cat === RECIPE_ANCHORS_NAME) {
    for (const n of names) {
      const log: RowLog = {
        inputName: n,
        decision: 'composite-manual',
        reason: 'recipe anchor → manual LLM-fill at /admin/pantry',
      }
      stats.rows.push(log)
      stats.compositeManual += 1
      printRowLog(log)
    }
    return stats
  }

  for (let i = 0; i < names.length; i += args.batchSize) {
    const batch = names.slice(i, i + args.batchSize)
    let response: SearchResponse
    try {
      response = await postSearch(args.apiBase, cookie, batch)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      for (const n of batch) {
        const log: RowLog = { inputName: n, decision: 'search-failed', reason: msg }
        stats.rows.push(log)
        stats.searchFailed += 1
        printRowLog(log)
      }
      continue
    }

    const picks: PickedRow[] = []
    const pendingByName = new Map<string, RowLog>()

    for (const result of response.results) {
      if (result.already_exists) {
        const log: RowLog = {
          inputName: result.input_name,
          decision: 'dedup-skip',
          reason: `existing: ${result.already_exists.existing_name}`,
        }
        stats.rows.push(log)
        stats.dedupSkip += 1
        printRowLog(log)
        continue
      }

      const outcome = autoPickStrategy(result.input_name, result, args.threshold)
      if (outcome.pick) {
        picks.push(outcome.pick)
        const log: RowLog = {
          inputName: result.input_name,
          decision: args.dryRun ? 'auto-pick (dry-run)' : 'auto-saved',
          matched: outcome.matched ?? undefined,
        }
        pendingByName.set(result.input_name, log)
        if (!args.dryRun) {
          // Will populate productId after save response; print after.
        } else {
          // Dry-run: print immediately
          stats.rows.push(log)
          stats.autoPickDryRun += 1
          printRowLog(log)
        }
      } else {
        let reason: string
        if (outcome.reason === 'no-candidates') {
          reason = `0 candidates (OFF=${result.off.length}, USDA=${result.usda.length})`
        } else if (outcome.reason === 'descriptor-fail') {
          reason = `descriptor "${outcome.rejectedDescriptor}" missing in candidate "${outcome.matched?.name ?? '?'}"`
        } else if (outcome.reason === 'meat-source-fail') {
          reason = `meat-source "${outcome.rejectedMeatSource}" missing in candidate "${outcome.matched?.name ?? '?'}"`
        } else if (outcome.reason === 'inverse-meat-fail') {
          reason = `candidate has unrelated meat "${outcome.rejectedInverseMeat}" not in input ("${outcome.matched?.name ?? '?'}")`
        } else if (outcome.reason === 'dish-class-fail') {
          reason = `dish-class "${outcome.rejectedPrep}" in candidate "${outcome.matched?.name ?? '?'}"`
        } else if (outcome.reason === 'preparation-fail') {
          reason = `preparation "${outcome.rejectedPrep}" in candidate "${outcome.matched?.name ?? '?'}" not in input`
        } else if (outcome.reason === 'anti-flour-fail') {
          reason = `R.6 anti-flour: candidate "${outcome.matched?.name ?? '?'}" leads with "flour", input doesn't`
        } else if (outcome.reason === 'off-brand-fluff') {
          reason = `R.7 OFF brand-fluff: candidate "${outcome.matched?.name ?? '?'}" is long composite; input keyword not its primary noun`
        } else if (outcome.reason === 'override') {
          reason = `manual override → /admin/pantry`
        } else {
          reason = `no token-overlap ≥ ${args.threshold} (OFF=${result.off.length}, USDA=${result.usda.length})`
        }
        const log: RowLog = {
          inputName: result.input_name,
          decision: 'eyeball',
          reason,
        }
        stats.rows.push(log)
        stats.eyeball += 1
        printRowLog(log)
      }
    }

    if (!args.dryRun && picks.length > 0) {
      let saveResults: SaveResultRow[]
      try {
        saveResults = await postSave(args.apiBase, cookie, userId, picks)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        for (const p of picks) {
          const log = pendingByName.get(p.input_name)
          if (log) {
            log.decision = 'save-failed'
            log.reason = msg
            stats.rows.push(log)
            stats.saveFailed += 1
            printRowLog(log)
          }
        }
        continue
      }
      for (const sr of saveResults) {
        const log = pendingByName.get(sr.input_name)
        if (!log) continue
        if (sr.status === 'saved') {
          log.decision = 'auto-saved'
          log.productId = sr.product_id
          stats.autoSaved += 1
        } else {
          log.decision = 'save-failed'
          log.reason = sr.error ?? 'unknown'
          stats.saveFailed += 1
        }
        stats.rows.push(log)
        printRowLog(log)
      }
    }
  }

  return stats
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)
  console.log(
    `\n=== Greek God Bod bulk-add ${args.dryRun ? '(DRY RUN)' : '(LIVE)'} ===`,
  )
  console.log(
    `target: ${args.apiBase}, threshold: ${args.threshold}, batch-size: ${args.batchSize}`,
  )

  const parsed = parsePantryDoc(args.docPath)
  const rawCount = [...parsed.categories.values()].reduce((acc, n) => acc + n.length, 0)

  // Apply category-level + entry-level scope pruning.
  let prunedSkippedCats = 0
  let prunedSkippedEntries = 0
  for (const cat of [...parsed.categories.keys()]) {
    if (SKIP_CATEGORIES.has(cat)) {
      prunedSkippedEntries += parsed.categories.get(cat)!.length
      parsed.categories.delete(cat)
      prunedSkippedCats += 1
      continue
    }
    const keep = KEEP_ENTRIES[cat]
    if (keep) {
      const original = parsed.categories.get(cat)!
      const kept = original.filter((n) => keep.has(n))
      prunedSkippedEntries += original.length - kept.length
      parsed.categories.set(cat, kept)
    }
  }
  parsed.order = parsed.order.filter((c) => !SKIP_CATEGORIES.has(c))
  const postCount = [...parsed.categories.values()].reduce((acc, n) => acc + n.length, 0)

  console.log(
    `parsed ${parsed.order.length} categories, ${postCount} entries (raw=${rawCount}, pruned=${prunedSkippedEntries} entries across ${prunedSkippedCats} skip-cats + per-cat keepers)`,
  )

  const cookie = await authenticate(args.apiBase)
  const userId = await fetchUserId(args.apiBase, cookie)
  console.log(`auth ✓ user_id=${userId}`)

  const targets = args.categories
    ? args.categories
    : parsed.order.filter((c) => c !== RECIPE_ANCHORS_NAME)

  const allStats: { cat: string; stats: CategoryStats }[] = []
  for (const cat of targets) {
    const names = parsed.categories.get(cat)
    if (!names) {
      console.log(`\n[skip] category "${cat}" not found in doc`)
      continue
    }
    const limited = args.limit !== null ? names.slice(0, args.limit) : names
    const stats = await processCategory(cat, limited, args, cookie, userId)
    allStats.push({ cat, stats })
  }

  // Final summary
  console.log('\n=== summary ===')
  let totalAutoSaved = 0
  let totalAutoPickDry = 0
  let totalEyeball = 0
  let totalDedup = 0
  let totalManual = 0
  let totalSearchFail = 0
  let totalSaveFail = 0
  let totalEntries = 0

  for (const { cat, stats } of allStats) {
    totalEntries += stats.total
    totalAutoSaved += stats.autoSaved
    totalAutoPickDry += stats.autoPickDryRun
    totalEyeball += stats.eyeball
    totalDedup += stats.dedupSkip
    totalManual += stats.compositeManual
    totalSearchFail += stats.searchFailed
    totalSaveFail += stats.saveFailed
    const decided = args.dryRun ? stats.autoPickDryRun : stats.autoSaved
    console.log(
      `  ${cat.padEnd(35)} total=${stats.total}  ${args.dryRun ? 'would-pick' : 'saved'}=${decided}  eyeball=${stats.eyeball}  dedup=${stats.dedupSkip}  manual=${stats.compositeManual}  fail=${stats.searchFailed + stats.saveFailed}`,
    )
  }

  console.log()
  console.log(`total entries processed:   ${totalEntries}`)
  if (args.dryRun) {
    console.log(`  would auto-pick:         ${totalAutoPickDry} (${totalEntries > 0 ? Math.round((totalAutoPickDry / totalEntries) * 100) : 0}%)`)
  } else {
    console.log(`  auto-saved:              ${totalAutoSaved} (${totalEntries > 0 ? Math.round((totalAutoSaved / totalEntries) * 100) : 0}%)`)
  }
  console.log(`  eyeball needed:          ${totalEyeball}`)
  console.log(`  dedup-skip:              ${totalDedup}`)
  console.log(`  composite-manual:        ${totalManual}`)
  console.log(`  search/save failures:    ${totalSearchFail + totalSaveFail}`)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
