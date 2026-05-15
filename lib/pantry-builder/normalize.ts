export function normalizeFoodText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function candidateKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => normalizeFoodText(String(part ?? '')))
    .filter(Boolean)
    .join(':')
}

export function simpleAliases(name: string): string[] {
  const normalized = normalizeFoodText(name)
  const aliases = new Set<string>([normalized])
  const tokens = normalized.split(' ')
  const last = tokens[tokens.length - 1]
  if (last && last.endsWith('ies') && last.length > 4) {
    aliases.add([...tokens.slice(0, -1), `${last.slice(0, -3)}y`].join(' '))
  } else if (last && last.endsWith('s') && last.length > 4) {
    aliases.add([...tokens.slice(0, -1), last.slice(0, -1)].join(' '))
  } else if (last && last.length > 3) {
    aliases.add([...tokens.slice(0, -1), `${last}s`].join(' '))
  }
  return [...aliases].filter(Boolean)
}
