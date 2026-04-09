export interface ExtractedCorrection {
  heard: string
  corrected: string
}

export interface SavedCorrection {
  id: string
  heard: string
  corrected: string
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

export function isPhoneticallySimilar(heard: string, corrected: string): boolean {
  const a = heard.toLowerCase().replace(/-/g, '')
  const b = corrected.toLowerCase().replace(/-/g, '')
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return true
  return levenshteinDistance(a, b) / maxLen <= 0.4
}

export function extractParentheticalCorrections(text: string): {
  corrections: ExtractedCorrection[]
  cleanedText: string
} {
  const corrections: ExtractedCorrection[] = []
  const regex = /([\w][\w-]*(?:\s+[\w][\w-]*)*)\s*\(([^)]+)\)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    corrections.push({
      heard: match[1].trim(),
      corrected: match[2].trim(),
    })
  }

  // Replace "heard (corrected)" with just "corrected"
  const cleanedText = text.replace(regex, (_match, _heard, corrected) => corrected.trim())

  return { corrections, cleanedText }
}

export function applySavedCorrections(
  text: string,
  corrections: SavedCorrection[]
): { correctedText: string; appliedIds: string[] } {
  let correctedText = text
  const appliedIds: string[] = []

  for (const c of corrections) {
    const escaped = c.heard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi')
    if (pattern.test(correctedText)) {
      correctedText = correctedText.replace(pattern, c.corrected)
      appliedIds.push(c.id)
    }
  }

  return { correctedText, appliedIds }
}
