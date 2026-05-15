export type LibrarianTaskType =
  | 'add_product'
  | 'add_alias'
  | 'add_unit_alternative'
  | 'review_overmatch'

export interface LibrarianTask {
  type: LibrarianTaskType
  title: string
  priority: 'high' | 'medium' | 'low'
  phrase: string
  reason: string
  proposed_fields: Record<string, unknown>
  requires_user_approval: true
}

const DEFAULT_TASKS: Record<string, Omit<LibrarianTask, 'phrase' | 'reason'>> = {
  chips: {
    type: 'add_product',
    title: 'Add tortilla/restaurant chips default',
    priority: 'high',
    proposed_fields: {
      names: ['Tortilla chips', 'Restaurant tortilla chips'],
      units_needed: ['chip', 'oz', 'g'],
      note: 'Needed for chip-count logs like "20 chips with guacamole".',
    },
    requires_user_approval: true,
  },
  'dos xx': {
    type: 'add_product',
    title: 'Add Dos Equis 16 oz beer',
    priority: 'high',
    proposed_fields: {
      names: ['Dos Equis 16 oz', 'Dos Equis Lager Especial 16 oz'],
      aliases: ['dos xx', 'dos equis'],
      units_needed: ['can', '16 oz'],
    },
    requires_user_approval: true,
  },
  guacamole: {
    type: 'add_product',
    title: 'Add guacamole default',
    priority: 'medium',
    proposed_fields: {
      names: ['Guacamole'],
      units_needed: ['tbsp', 'cup', 'g'],
    },
    requires_user_approval: true,
  },
  'chocolate sauce': {
    type: 'add_product',
    title: 'Add chocolate sauce default',
    priority: 'medium',
    proposed_fields: {
      names: ['Chocolate sauce'],
      units_needed: ['tbsp', 'g'],
    },
    requires_user_approval: true,
  },
  margaritas: {
    type: 'add_product',
    title: 'Add margarita defaults and variants',
    priority: 'medium',
    proposed_fields: {
      names: ['Margarita on the rocks', 'Skinny margarita'],
      units_needed: ['drink', 'fl oz'],
      default_assumption: '2 oz tequila plus lime/sweetener; confirm recipe before save.',
    },
    requires_user_approval: true,
  },
}

export function librarianTasksFromCoverageGaps(
  gaps: Array<{ phrase: string; severity: 'high' | 'medium' | 'low'; reason: string }>,
): LibrarianTask[] {
  return gaps.map((gap) => {
    const defaultTask = DEFAULT_TASKS[gap.phrase]
    if (defaultTask) {
      return {
        ...defaultTask,
        priority: gap.severity === 'high' ? 'high' : defaultTask.priority,
        phrase: gap.phrase,
        reason: gap.reason,
      }
    }

    return {
      type: gap.reason.includes('wrong-looking') ? 'review_overmatch' : 'add_product',
      title: `Review pantry coverage for "${gap.phrase}"`,
      priority: gap.severity,
      phrase: gap.phrase,
      reason: gap.reason,
      proposed_fields: {
        names: [gap.phrase],
        note: 'Generated from resolver coverage gap; user approval required before any pantry write.',
      },
      requires_user_approval: true,
    }
  })
}

