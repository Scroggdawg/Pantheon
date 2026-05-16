# Smart Pantry Review Packets

Generated: 2026-05-16T07:11:14.380Z

ELI5: this splits the scary pantry backlog into smaller piles.

- Quick Reject: rows that look safely rejectable or are already rejected by the risk engine.
- Quick Approve USDA: boring USDA rows worth eyeballing; still `edit_needed` until Luke flips them to `approved`.
- Brands Restaurants: protected rows that need Luke/manual source judgment.
- Manual Needed: weird leftovers that need correction or future importer rules.

Suggested review order:
1. Quick Reject
2. Quick Approve USDA
3. Brands Restaurants
4. Manual Needed

| packet | rows | file |
| --- | ---: | --- |
| Quick Reject | 113 | 01_quick_reject.md |
| Quick Approve USDA | 3 | 02_quick_approve_usda.md |
| Brands Restaurants | 58 | 03_brands_restaurants.md |
| Manual Needed | 26 | 04_manual_needed.md |

Operational guardrails:
- These exports are read-only.
- Applying still requires the guarded apply script.
- Review writes still require explicit approval and `--allow-review-writes`.
- Branded, restaurant, alcohol, supplement, recipe, composite, and OFF rows remain protected.
