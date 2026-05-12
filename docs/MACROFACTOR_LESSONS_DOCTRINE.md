# MacroFactor Lessons Doctrine

Date: 2026-05-12
Status: Planning doctrine. Public-source research only; no private reverse engineering.
Scope: Pantheon parser, pantry, plate/editor, Provisions, Progress, and roadmap priority.

## 1. Research Boundary

I did not find a credible public reverse-engineered breakdown of MacroFactor's private parser internals. I did find enough public product documentation to extract the architectural lesson that matters for Pantheon.

This document is based on public MacroFactor docs and public user-visible behavior, not APK decompilation, private network traffic, or credentialed API inspection.

Primary sources:

- MacroFactor AI Food Logging: https://help.macrofactorapp.com/en/articles/258-ai-food-logging
- MacroFactor Food Search Database: https://help.macrofactorapp.com/en/articles/46-food-search-database
- MacroFactor Food Logging Workflows: https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor
- MacroFactor AI product article: https://macrofactor.com/ai-food-logging/

## 2. Core Finding

MacroFactor is not excellent because the LLM magically knows macros.

MacroFactor is excellent because the LLM is surrounded by product architecture:

1. A large verified food database.
2. Separate lanes for history, custom foods, common foods, and branded foods.
3. Fast recall surfaces before search starts.
4. A unified Plate where all logging methods converge before commit.
5. Editable quantities and units before logging.
6. Recipe/ingredient expansion for complex foods.
7. Barcode and label scanning for branded products.
8. AI estimates that are easy to inspect and correct.

For Pantheon, the lesson is not "make Claude guess harder." The lesson is "make Claude resolve into a strong food identity system and a great correction surface."

## 3. What MacroFactor Publicly Reveals

### Database Scale And Search

MacroFactor says its standard food database has around 1.36 million verified searchable foods, more common and branded foods than its legacy database, and faster typo-tolerant search backed by regional servers. It also derives serving options like grams, ounces, milliliters, cups, teaspoons, and tablespoons when possible.

Pantheon lesson: pantry coverage is not optional polish. It is the accuracy moat. A small personal pantry can beat a giant generic database for Luke's recurring foods, but only if we treat pantry data as a first-class layer.

### Search Lanes

MacroFactor organizes typed search into categories such as history, custom foods, common foods, and branded foods. It also uses favorites, hourly go-tos, and recent foods before or during search.

Pantheon lesson: `hourly_go_to` should remain a recall surface, not a durable identity. Canonical product/saved-meal/recipe/barcode entries need to own final identity.

### Describe Is Common-Food Oriented

MacroFactor's docs say Describe lets the user speak/type natural language and searches a common-food database. Their docs also instruct users to include manufacturer or restaurant details for branded food search.

Pantheon lesson: branded recognition should not be over-generalized through aliases. If Luke says a brand or restaurant, use that context. If he says only a generic noun, do not force a branded match.

### The Plate Is The Speed Layer

MacroFactor's plate-based logger lets users add multiple foods, review the meal, edit quantities/units, and then log everything together. Their docs explicitly frame the unified Plate as a key reason the logger is fast for multi-food meals.

Pantheon lesson: the BIG BUTTON alone is not enough. Pantheon needs a real Plate/parsed-result surface where per-food cards can be reviewed, edited, removed, replaced, and saved as one meal.

### AI Results Are Editable Before Commit

MacroFactor's AI photo/text flow takes users to the Plate view after analysis. The docs emphasize editable serving sizes, ingredient expansion, and user review before logging.

Pantheon lesson: AI output should stage, not silently commit. Fast save is acceptable for high-confidence known foods, but complex or estimated meals need a reviewable Plate.

### Complex Meals Become Recipes/Ingredients

MacroFactor can represent a detected recipe plus additional foods, and exposes ingredient expansion/explode behavior.

Pantheon lesson: `chips with guacamole`, `churros with chocolate sauce`, `fried egg on toast`, and home-cooked recipes are not matcher-alias problems. They are decomposition and portion-editor problems.

## 4. Pantheon Architecture Rewrite

The roadmap should shift from "matcher first, then database, then editor" to "identity plus Plate first."

The matcher work we shipped was necessary: it stopped bad confident resolutions, cleaned source refs, and gave us invariants. But the next leap toward MacroFactor quality is not another stack of matcher passes. It is a stronger end-to-end logging architecture:

1. Identify food-like fragments.
2. Decompose accompaniments and compound foods.
3. Resolve each fragment against canonical data.
4. Stage every result on a Plate.
5. Mark estimated quantities honestly.
6. Make correction fast.
7. Learn from explicit corrections.

## 5. New Priority Order

### Priority 1: Plate / Per-Food Review Surface

This moves up. Pantheon needs a MacroFactor-style Plate equivalent before deep score/progress work.

Required abilities:

- Show each parsed food as its own card.
- Edit quantity and unit.
- Remove a food.
- Replace a food via search.
- Add another food before saving.
- Save all staged foods together.
- Show meal/day impact before commit.
- Surface low/medium confidence visually.

### Priority 2: Pantry Coverage For Luke's Real Foods

Data coverage moves up beside the Plate.

Required durable entries:

- High-frequency staples.
- Restaurant items Luke actually uses.
- Alcohol/drinks with known defaults and variants.
- Common accompaniments: guacamole, chocolate sauce, tortilla chips, sauces, oils, condiments.
- Recipe anchors for cooked meals.

### Priority 3: Accompaniment Decomposition

`with`, `on`, `plus`, and comma-separated party foods should decompose when both sides are food-like.

Examples:

- `20 chips with guacamole` -> tortilla chips + guacamole.
- `2 churros with chocolate sauce` -> churros + chocolate sauce.
- `fried egg on toast` -> either recipe card with ingredients or exploded ingredients, depending confidence.

Portion rule:

- Spoken amount wins.
- If no amount is spoken, use a standard default estimate.
- Mark the estimate medium confidence.
- Make it easy to adjust in the Plate.

### Priority 4: Branded/Voice Aliases Stay Narrow

Aliases are allowed only when they preserve identity.

Safe-ish after product call:

- `dos xx` -> `Dos Equis`.

Not safe:

- `coffee` -> `REBBL Hazelnut Coffee Elixir`.
- `chips with guacamole` -> one saved meal.
- `margarita` -> an arbitrary high-calorie USDA row without variant control.

### Priority 5: Progress Waits For Cleaner Food Identity

Progress and Greek God Score should not get ahead of the food identity layer. If Progress is built on parser artifacts, it will look polished but judge bad data.

## 6. Roadmap Changes Required

### Move Up

- Plate/per-food editor.
- Pantry coverage sprint.
- Accompaniment decomposition.
- Recipe/ingredient expansion design.

### Move Down

- Greek God Score implementation.
- Widget score keys.
- Advanced Progress views.
- Cosmetic logging-flow polish that does not improve correction speed.

### Keep Narrow

- Matcher aliases.
- Hourly go-to authority.
- Global threshold changes.

## 7. New Brick Recommendations

1. Plate Phase 0: define the native staged meal model and review UI.
2. Party Food Data: add durable entries for chips, guacamole, chocolate sauce, margarita, Dos Equis.
3. Accompaniment Decomposition: split food-like `with/on` phrases into separate staged foods.
4. Portion Confidence: add confidence labels and default-estimate reason fields.
5. Correction Learning: user unit/quantity corrections write back to unit alternatives or saved food metadata.
6. Recipe Explosion: represent recipe cards with expandable ingredients.

## 8. Decision Rule

When a parse is wrong, ask which layer failed:

- Missing food? Pantry coverage.
- Wrong food identity? Matcher/canonicalization.
- Multiple foods fused together? Decomposition.
- Right food, wrong amount? Plate/portion editor.
- Branded product unclear? Barcode/search or explicit alias.
- Repeated custom meal? Saved meal/recipe.

Do not solve all six with "one more matcher pass."

