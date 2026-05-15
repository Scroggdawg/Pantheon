import { librarianTasksFromCoverageGaps } from '../lib/librarian/proposals'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const tasks = librarianTasksFromCoverageGaps([
  {
    phrase: 'chips',
    severity: 'high',
    reason: 'wrong-looking candidate: generic chips is colliding with chocolate chip product text',
  },
  {
    phrase: 'dos xx',
    severity: 'high',
    reason: 'fallback required: no usable canonical identity',
  },
  {
    phrase: 'mystery sauce',
    severity: 'medium',
    reason: 'history/review-only identity needs canonical pantry coverage',
  },
])

assert(tasks.length === 3, `expected 3 tasks, got ${tasks.length}`)
assert(tasks.every((task) => task.requires_user_approval === true), 'all tasks require approval')
assert(tasks[0].type === 'add_product', `expected chips add_product, got ${tasks[0].type}`)
assert(tasks[0].priority === 'high', 'chips should be high priority')
assert(
  Array.isArray(tasks[1].proposed_fields.aliases) &&
    tasks[1].proposed_fields.aliases.includes('dos xx'),
  'Dos Equis task should include dos xx alias',
)
assert(tasks[2].title.includes('mystery sauce'), 'fallback task should preserve phrase')

console.log('LP-8 librarian proposals: pass')

