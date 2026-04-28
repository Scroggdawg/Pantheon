// Standard Unicode fraction glyphs keyed by fractional part rounded
// to 3 decimal places. Covers all 16 vulgar fractions defensively;
// the V10 plan only ever exercises quarter-step values, but if a
// non-quarter ever drifts through (e.g., a future model run), this
// table catches the common ones before falling back to '<n>+<a>/<b>'.
const FRACTION_GLYPHS: Record<string, string> = {
  '0.250': '\u00BC', // ¼
  '0.500': '\u00BD', // ½
  '0.750': '\u00BE', // ¾
  '0.333': '\u2153', // ⅓
  '0.667': '\u2154', // ⅔
  '0.200': '\u2155', // ⅕
  '0.400': '\u2156', // ⅖
  '0.600': '\u2157', // ⅗
  '0.800': '\u2158', // ⅘
  '0.167': '\u2159', // ⅙
  '0.833': '\u215A', // ⅚
  '0.125': '\u215B', // ⅛
  '0.375': '\u215C', // ⅜
  '0.625': '\u215D', // ⅝
  '0.875': '\u215E', // ⅞
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Format a servings value as a human-readable string with Unicode
 * fraction glyphs.
 *
 *   1     → '1'
 *   0.5   → '½'
 *   1.25  → '1¼'
 *   1.6   → '1+3/5'  (fallback — not expected in current data)
 */
export function formatServings(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n)

  const whole = Math.floor(n)
  const frac = n - whole
  if (frac < 1e-6) return String(whole)

  const key = frac.toFixed(3)
  const glyph = FRACTION_GLYPHS[key]
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`

  // Fallback: <whole>+<num>/<den> via 1000-denom + gcd reduce.
  const denom = 1000
  const numer = Math.round(frac * denom)
  const g = gcd(numer, denom)
  const num = numer / g
  const den = denom / g
  return whole === 0 ? `${num}/${den}` : `${whole}+${num}/${den}`
}

const DAY_HEADER_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/**
 * Format a YYYY-MM-DD date string as 'MON · APR 27'.
 *
 * Uses Intl 'short' weekday + month formatting, then joins with the
 * middle-dot separator and uppercases. Treats the input as a calendar
 * date (no timezone shifting).
 */
export function formatDayHeader(ymd: string): string {
  // Parse as local date components to avoid UTC drift on YYYY-MM-DD.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Intl emits 'Mon, Apr 27' → split on ', ' and re-join with ' · '.
  const parts = DAY_HEADER_FORMATTER.formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${weekday} \u00B7 ${month} ${day}`.toUpperCase()
}
