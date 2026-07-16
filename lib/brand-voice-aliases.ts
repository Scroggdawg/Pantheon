// S26 Step 4i — Code-level map of brand names to known voice
// variants. Voice-to-text systematically mangles unusual brand
// names ("Yasso" → "yes so" / "yeah so" / "yea so"; "Fage" →
// "fudge"; etc.). Library search applies alias substitution
// before scoring so the existing token-based scorer sees the
// canonical brand name.
//
// Single-tenant, manually maintained — add new entries when
// voice-mangle patterns surface in production telemetry.
//
// Format: canonical brand name (lowercase) → array of voice
// variants (lowercase). Substitution is case-insensitive and
// treats whitespace + common dictation punctuation as token
// boundaries (both around the alias AND between its words),
// because voice-to-text often inserts pause-commas between
// utterances ("yea, so bar").

export const BRAND_VOICE_ALIASES: Record<string, string[]> = {
  nutricost: ['nutri cost', 'nutri-cost', 'nutri cust', 'nutri-cust'],
  yasso: ['yes so', 'yeah so', 'yea so'],
  // Future entries to consider as voice-mangle patterns are
  // discovered in real transcripts:
  //   fage:       ['fudge', 'fadge'],
  //   quinoa:     ['keen wah', 'keen oh ah'],
  //   acai:       ['a sigh', 'a sigh ee'],
  //   'la croix': ['la kwah', 'la croy'],
}

// Characters treated as token-boundary equivalents (both around
// the alias and between its words). Whitespace + common
// dictation punctuation.
const BOUNDARY_CLASS = '[\\s.,!?;:]'

/**
 * Apply brand alias substitution to a query string. For each
 * brand in BRAND_VOICE_ALIASES, scan for any of its aliases
 * (longer aliases first to handle compound substitutions
 * correctly), and replace each match with the canonical brand
 * name.
 *
 * Match semantics:
 *   - Whole-token: alias must be bounded by string edges,
 *     whitespace, or punctuation. Prevents partial-word matches
 *     like "yes so" → "yes solely" → "yasso lely".
 *   - Internal-flexible: spaces inside the alias literal also
 *     match punctuation+whitespace runs, so "yea, so" matches
 *     the alias "yea so" (voice transcripts commonly insert
 *     pause-commas between words).
 *
 * Returns the (lowercased) substituted query plus a flag
 * indicating whether any substitution was applied (for telemetry).
 */
export function applyBrandAliases(query: string): {
  substituted: string
  aliasApplied: string | null
} {
  let result = query.toLowerCase()
  let aliasApplied: string | null = null

  for (const [brand, aliases] of Object.entries(BRAND_VOICE_ALIASES)) {
    // Sort aliases by length descending so longer aliases match
    // before any prefix overlap.
    const sortedAliases = [...aliases].sort((a, b) => b.length - a.length)

    for (const alias of sortedAliases) {
      // Split alias on whitespace, escape each word, rejoin with
      // the boundary class so internal punctuation also matches.
      const internalPattern = alias
        .split(/\s+/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join(`${BOUNDARY_CLASS}+`)

      const pattern = new RegExp(
        `(^|${BOUNDARY_CLASS})${internalPattern}(${BOUNDARY_CLASS}|$)`,
        'gi',
      )

      const replaced = result.replace(pattern, `$1${brand}$2`)
      if (replaced !== result) {
        aliasApplied = brand
        result = replaced
      }
    }
  }

  return { substituted: result, aliasApplied }
}
