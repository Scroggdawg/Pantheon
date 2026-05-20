// Read-only review packet for saved-meal source_ref repair plans.
//
// Usage:
//   npx tsx scripts/plan-saved-meal-source-ref-repair.ts
//   npx tsx scripts/report-saved-meal-source-ref-review.ts
//
// This script reads the latest ignored dry-run artifact under scripts/output
// and turns it into a concise human review sheet. It does not write production
// data and does not change the dry-run artifact.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface Candidate {
  source_ref: string
  name: string
  source: 'product' | 'saved_meal'
  score: number
  reasons: string[]
}

interface RepairPlanItem {
  saved_meal_id: string
  saved_meal_name: string
  food_index: number
  food_name: string
  current_source_ref: string | null
  issue: 'hourly_wrapper_ref' | 'missing_source_ref'
  decision: 'auto_map' | 'review_required' | 'leave_null'
  proposed_source_ref: string | null
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  candidates: Candidate[]
}

interface RepairPlanArtifact {
  run_id: string
  generated_at: string
  items: RepairPlanItem[]
}

interface ReviewItem {
  action: 'approve_null' | 'review_product_match' | 'review_saved_meal_shape' | 'block_self_or_wrapper'
  item: RepairPlanItem
  plain_english: string
  likely_next_step: string
}

function latestPlanPath(): string {
  const outputDir = resolve('scripts/output')
  if (!existsSync(outputDir)) {
    throw new Error('No scripts/output directory found. Run plan-saved-meal-source-ref-repair.ts first.')
  }

  const paths = readdirSync(outputDir)
    .filter((name) => /^saved-meal-source-ref-repair-.*\.json$/.test(name))
    .map((name) => join(outputDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

  const latest = paths[0]
  if (!latest) throw new Error('No saved-meal source-ref repair JSON found. Run plan-saved-meal-source-ref-repair.ts first.')
  return latest
}

function loadPlan(path: string): RepairPlanArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as RepairPlanArtifact
}

function classify(item: RepairPlanItem): ReviewItem {
  const top = item.candidates[0]
  if (item.decision === 'leave_null') {
    return {
      action: 'approve_null',
      item,
      plain_english: 'This component should probably stay manual for now because there is no safe durable identity.',
      likely_next_step: 'Approve leaving source_ref null unless Luke names the exact product/recipe.',
    }
  }

  if (top?.source === 'saved_meal') {
    return {
      action: 'review_saved_meal_shape',
      item,
      plain_english: 'The best match is another saved meal. That may be correct, but it can also create wrapper loops or duplicate favorites.',
      likely_next_step: 'Review manually; prefer a product ref if this is a simple ingredient, and never map a meal to itself.',
    }
  }

  if (top?.source === 'product') {
    return {
      action: 'review_product_match',
      item,
      plain_english: 'There is a possible product match, but the score is not strong enough to write automatically.',
      likely_next_step: 'Approve only if the product name and macros match the saved component Luke actually meant.',
    }
  }

  return {
    action: 'block_self_or_wrapper',
    item,
    plain_english: 'This hourly wrapper does not contain a clear terminal product or saved-meal identity.',
    likely_next_step: 'Do not write a guessed ref; either leave null or create a reviewed product/recipe later.',
  }
}

function countBy(items: ReviewItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, review) => {
    acc[review.action] = (acc[review.action] ?? 0) + 1
    return acc
  }, {})
}

function render(planPath: string, plan: RepairPlanArtifact, reviews: ReviewItem[]): string {
  const counts = countBy(reviews)
  const lines: string[] = []
  lines.push('Saved Meal Source Ref Review Packet')
  lines.push('')
  lines.push('Summary')
  lines.push(`- source_plan: ${planPath}`)
  lines.push(`- run_id: ${plan.run_id}`)
  lines.push(`- generated_at: ${plan.generated_at}`)
  lines.push(`- items: ${reviews.length}`)
  lines.push(`- approve_null: ${counts.approve_null ?? 0}`)
  lines.push(`- review_product_match: ${counts.review_product_match ?? 0}`)
  lines.push(`- review_saved_meal_shape: ${counts.review_saved_meal_shape ?? 0}`)
  lines.push(`- block_self_or_wrapper: ${counts.block_self_or_wrapper ?? 0}`)
  lines.push('')
  lines.push('Decision Sheet')

  for (const [index, review] of reviews.entries()) {
    const item = review.item
    const topCandidates = item.candidates.slice(0, 3)
    lines.push(`${index + 1}. ${item.saved_meal_name} / ${item.food_name}`)
    lines.push(`   - action: ${review.action}`)
    lines.push(`   - issue: ${item.issue}`)
    lines.push(`   - current_source_ref: ${item.current_source_ref ?? '(none)'}`)
    lines.push(`   - proposed_source_ref: ${item.proposed_source_ref ?? '(none)'}`)
    lines.push(`   - plain_english: ${review.plain_english}`)
    lines.push(`   - likely_next_step: ${review.likely_next_step}`)
    lines.push(`   - candidates: ${topCandidates.length ? topCandidates.map((candidate) => `${candidate.name} [${candidate.source_ref}] score=${candidate.score}`).join(' | ') : '(none)'}`)
  }

  lines.push('')
  lines.push('Safety Gates')
  lines.push('- This packet is review-only.')
  lines.push('- Do not mutate production saved_meals from this script.')
  lines.push('- Prefer null over a guessed source_ref.')
  lines.push('- Any live repair needs integration approval and an explicit production data action.')
  return lines.join('\n')
}

function main() {
  const planPath = latestPlanPath()
  const plan = loadPlan(planPath)
  const reviews = plan.items.map(classify).sort((a, b) => {
    const priority = {
      review_product_match: 4,
      review_saved_meal_shape: 3,
      block_self_or_wrapper: 2,
      approve_null: 1,
    }
    return priority[b.action] - priority[a.action] || a.item.saved_meal_name.localeCompare(b.item.saved_meal_name)
  })

  console.log(render(planPath, plan, reviews))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ plan_path: planPath, run_id: plan.run_id, generated_at: plan.generated_at, reviews }, null, 2))
  }
}

main()
