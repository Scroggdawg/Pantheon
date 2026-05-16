import { normalizeFoodText, simpleAliases } from './normalize'

export interface AliasProductTarget {
  id: string
  name: string
  brand: string | null
}

export interface ExistingIdentityAlias {
  target_source_ref: string
  normalized_alias: string
}

export interface AliasRouteInput {
  candidate_key: string
  target_query: string | null
  display_name: string
}

export type AliasRoutePlan =
  | {
      type: 'propose_alias'
      candidate_key: string
      alias: string
      normalized_alias: string
      target_source_ref: string
      target_id: string
      target_name: string
      confidence: 'high' | 'medium'
      reason: string
    }
  | {
      type: 'already_exists'
      candidate_key: string
      alias: string
      target_source_ref: string
      target_name: string
      reason: string
    }
  | {
      type: 'ambiguous'
      candidate_key: string
      alias: string
      matches: Array<{ target_source_ref: string; target_name: string; score: number }>
      reason: string
    }
  | {
      type: 'no_match'
      candidate_key: string
      alias: string
      reason: string
    }
  | {
      type: 'not_aliasable'
      candidate_key: string
      alias: string
      reason: string
    }

const STOP_TOKENS = new Set([
  'and',
  'cooked',
  'fresh',
  'large',
  'low',
  'medium',
  'plain',
  'raw',
  'regular',
  'small',
  'with',
])

const COMPOSITE_TOKENS = new Set([
  'bar',
  'bolognese',
  'bowl',
  'plate',
  'sandwich',
  'shake',
  'smoothie',
  'soup',
  'taco',
  'wrap',
])
const PRODUCT_SPECIFIC_TOKENS = new Set([
  'aicha',
  'extra',
  'old',
  'quaker',
  'virgin',
])

function singularize(token: string) {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('s') && token.length > 4) return token.slice(0, -1)
  return token
}

function tokensFor(value: string) {
  return normalizeFoodText(value)
    .split(' ')
    .map(singularize)
    .filter((token) => token.length > 1 && !STOP_TOKENS.has(token))
}

function tokenSetFor(value: string) {
  return new Set(tokensFor(value))
}

function modifierTokenSetFor(value: string) {
  return new Set(normalizeFoodText(value).split(' ').filter(Boolean).map(singularize))
}

function aliasVariants(value: string) {
  return new Set([normalizeFoodText(value), ...simpleAliases(value).map(normalizeFoodText)])
}

function productNames(product: AliasProductTarget) {
  const names = new Set<string>()
  for (const value of [product.name, product.brand ? `${product.brand} ${product.name}` : null]) {
    if (!value) continue
    for (const alias of aliasVariants(value)) names.add(alias)
  }
  return names
}

function isCompositeAlias(alias: string) {
  const tokens = tokensFor(alias)
  return tokens.some((token) => COMPOSITE_TOKENS.has(token))
}

function hasAnyToken(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value))
}

function productSpecificConflictReason(alias: string, product: AliasProductTarget) {
  const aliasTokens = tokenSetFor(alias)
  const productTokens = tokenSetFor(product.brand ? `${product.brand} ${product.name}` : product.name)
  const missingSpecificTokens = [...PRODUCT_SPECIFIC_TOKENS].filter(
    (token) => productTokens.has(token) && !aliasTokens.has(token),
  )
  if (missingSpecificTokens.length > 0) {
    return `existing product has specific token(s) not present in alias: ${missingSpecificTokens.join(', ')}`
  }
  return null
}

function modifierConflictReason(alias: string, product: AliasProductTarget) {
  const aliasTokens = modifierTokenSetFor(alias)
  const productTokens = modifierTokenSetFor(product.brand ? `${product.brand} ${product.name}` : product.name)

  if (hasAnyToken(aliasTokens, ['cooked']) && hasAnyToken(productTokens, ['raw'])) {
    return 'alias says cooked but existing product is raw'
  }
  if (hasAnyToken(aliasTokens, ['raw']) && hasAnyToken(productTokens, ['cooked'])) {
    return 'alias says raw but existing product is cooked'
  }
  if (hasAnyToken(aliasTokens, ['nonfat']) && hasAnyToken(productTokens, ['lowfat', 'whole', '2'])) {
    return 'alias says nonfat but existing product has a different fat level'
  }
  if (hasAnyToken(aliasTokens, ['lowfat']) && hasAnyToken(productTokens, ['nonfat', 'whole'])) {
    return 'alias says lowfat but existing product has a different fat level'
  }
  if (!aliasTokens.has('protein') && productTokens.has('protein')) {
    return 'existing product has protein-specific formulation not present in alias'
  }
  return null
}

function scoreProduct(alias: string, displayName: string, product: AliasProductTarget) {
  const modifierConflict = modifierConflictReason(alias, product)
  if (modifierConflict) return { score: 0, reason: modifierConflict }
  const productSpecificConflict = productSpecificConflictReason(alias, product)
  if (productSpecificConflict) return { score: 0, reason: productSpecificConflict }

  const normalizedAlias = normalizeFoodText(alias)
  const normalizedDisplay = normalizeFoodText(displayName)
  const names = productNames(product)
  if (names.has(normalizedAlias)) return { score: 100, reason: 'alias exactly matches existing product name' }
  if (names.has(normalizedDisplay)) return { score: 95, reason: 'candidate display exactly matches existing product name' }

  const aliasTokens = tokensFor(alias)
  if (aliasTokens.length < 2) return { score: 0, reason: 'single-token alias needs exact product match' }

  const productTokens = tokenSetFor(product.name)
  const brandProductTokens = tokenSetFor(product.brand ? `${product.brand} ${product.name}` : product.name)
  const productContainsAll = aliasTokens.every((token) => productTokens.has(token))
  const brandProductContainsAll = aliasTokens.every((token) => brandProductTokens.has(token))
  if (productContainsAll || brandProductContainsAll) {
    return { score: 85, reason: 'all meaningful alias tokens appear in one existing product' }
  }

  return { score: 0, reason: 'not a confident product match' }
}

export function planAlreadyCoveredAliasRoute(
  input: AliasRouteInput,
  products: AliasProductTarget[],
  existingAliases: ExistingIdentityAlias[],
): AliasRoutePlan {
  const alias = input.target_query?.trim() || input.display_name.trim()
  const normalizedAlias = normalizeFoodText(alias)
  if (!normalizedAlias) {
    return { type: 'not_aliasable', candidate_key: input.candidate_key, alias, reason: 'empty alias' }
  }

  if (isCompositeAlias(normalizedAlias)) {
    return {
      type: 'not_aliasable',
      candidate_key: input.candidate_key,
      alias,
      reason: 'composite phrases need recipe/saved-meal handling, not product aliasing',
    }
  }

  const existingForAlias = existingAliases.filter((row) => row.normalized_alias === normalizedAlias)
  if (existingForAlias.length === 1) {
    const product = products.find((row) => `lib:product:${row.id}` === existingForAlias[0].target_source_ref)
    return {
      type: 'already_exists',
      candidate_key: input.candidate_key,
      alias,
      target_source_ref: existingForAlias[0].target_source_ref,
      target_name: product?.name ?? existingForAlias[0].target_source_ref,
      reason: 'alias already exists for one product',
    }
  }
  if (existingForAlias.length > 1) {
    return {
      type: 'ambiguous',
      candidate_key: input.candidate_key,
      alias,
      matches: existingForAlias.map((row) => {
        const product = products.find((candidate) => `lib:product:${candidate.id}` === row.target_source_ref)
        return {
          target_source_ref: row.target_source_ref,
          target_name: product?.name ?? row.target_source_ref,
          score: 100,
        }
      }),
      reason: 'alias already points at multiple products',
    }
  }

  const matches = products
    .map((product) => {
      const scored = scoreProduct(alias, input.display_name, product)
      return {
        product,
        score: scored.score,
        reason: scored.reason,
      }
    })
    .filter((match) => match.score >= 85)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))

  if (matches.length === 0) {
    return {
      type: 'no_match',
      candidate_key: input.candidate_key,
      alias,
      reason: 'no single existing product confidently matches this covered alias',
    }
  }

  const topScore = matches[0].score
  const topMatches = matches.filter((match) => match.score === topScore)
  if (topMatches.length !== 1) {
    return {
      type: 'ambiguous',
      candidate_key: input.candidate_key,
      alias,
      matches: matches.slice(0, 5).map((match) => ({
        target_source_ref: `lib:product:${match.product.id}`,
        target_name: match.product.name,
        score: match.score,
      })),
      reason: 'multiple existing products tie for best alias target',
    }
  }

  const winner = topMatches[0]
  return {
    type: 'propose_alias',
    candidate_key: input.candidate_key,
    alias,
    normalized_alias: normalizedAlias,
    target_source_ref: `lib:product:${winner.product.id}`,
    target_id: winner.product.id,
    target_name: winner.product.name,
    confidence: winner.score >= 95 ? 'high' : 'medium',
    reason: winner.reason,
  }
}
