# Pantry Approval Ledger

Run ID: `09b0c220-2db2-43be-a90f-ccceba2716e8`
Generated From Artifact: 2026-05-15T23:54:52.277Z
Profile: Core USDA (data/pantry/packs/core-usda.json)
Window: offset 50, limit 25

This file is for review only. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:175036:cuisine staples | edit_needed | Tortillas, ready-to-bake or -fry, corn | Review required: state_modifier_mismatch_bake. |
| usda:sr legacy:169724:cuisine staples | edit_needed | Wheat flour, white, tortilla mix, enriched | Review required: state_modifier_mismatch_mix. |
| usda:sr legacy:169742:cuisine staples | edit_needed | Rice noodles, dry | Review required: state_modifier_mismatch_dry. |
| usda:sr legacy:174278:sauces condiments oils | edit_needed | Soy sauce made from soy (tamari) | Review required: prepared_dish_mismatch_risk. |
| usda:survey fndds:2710156:sauces condiments oils | rejected | Butter, tub | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:330458:sauces condiments oils | rejected | Oil, coconut | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:170174:beverages | rejected | Nuts, coconut water (liquid from coconuts) | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:169640:sauces condiments oils | rejected | Honey | Rejected by dry-run: duplicate_existing_product. |
| usda:survey fndds:2710186:sauces condiments oils | rejected | Olive oil | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:2346396:breakfast snacks | rejected | Oats, whole grain, rolled, old fashioned | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:174069:cuisine staples | rejected | Dip, TOSTITOS, salsa con queso, medium | Rejected by dry-run: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:foundation:2685580:cuisine staples | rejected | Tomato, paste, canned, without salt added | Rejected by dry-run: state_modifier_mismatch_canned, duplicate_existing_product. |

## Candidate Detail

### corn tortilla -> Tortillas, ready-to-bake or -fry, corn

- candidate_key: `usda:sr legacy:175036:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 175036
- macros: 218 cal, 5.7P, 44.6C, 2.85F
- units: enchilada=19g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: corn tortilla, corn tortillas, tortillas ready to bake or fry corn, tortillas ready to bake or fry corns
- reasons: state_modifier_mismatch_bake

### flour tortilla -> Wheat flour, white, tortilla mix, enriched

- candidate_key: `usda:sr legacy:169724:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 169724
- macros: 405 cal, 9.66P, 67.1C, 10.6F
- units: cup=111g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: flour tortilla, flour tortillas, wheat flour white tortilla mix enriched, wheat flour white tortilla mix enricheds
- reasons: state_modifier_mismatch_mix

### rice noodles -> Rice noodles, dry

- candidate_key: `usda:sr legacy:169742:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 169742
- macros: 364 cal, 5.95P, 80.2C, 0.56F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rice noodles, rice noodle, rice noodles dry
- reasons: state_modifier_mismatch_dry

### soy sauce -> Soy sauce made from soy (tamari)

- candidate_key: `usda:sr legacy:174278:sauces condiments oils`
- dry_run_decision: review_required
- source: usda / SR Legacy / 174278
- macros: 60 cal, 10.5P, 5.57C, 0.1F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=18g, tsp=6g
- aliases: soy sauce, soy sauces, soy sauce made from soy tamari, soy sauce made from soy tamaris
- reasons: prepared_dish_mismatch_risk

### butter -> Butter, tub

- candidate_key: `usda:survey fndds:2710156:sauces condiments oils`
- dry_run_decision: rejected
- source: usda / Survey (FNDDS) / 2710156
- macros: 731 cal, 0.49P, 0C, 78.3F
- units: cup=224g, g=1g, guideline amount on large sandwich=28g, guideline amount on regular sandwich=14g, guideline amount per slice of bread roll=7g, individual container=5g, kg=1000g, lb=453.59g
- aliases: butter, butters, butter tub
- reasons: duplicate_existing_product

### coconut oil -> Oil, coconut

- candidate_key: `usda:foundation:330458:sauces condiments oils`
- dry_run_decision: rejected
- source: usda / Foundation / 330458
- macros: 833 cal, 0P, 0.84C, 99.1F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=11.6g
- aliases: coconut oil, oil coconut, oil coconuts
- reasons: duplicate_existing_product

### coconut water -> Nuts, coconut water (liquid from coconuts)

- candidate_key: `usda:sr legacy:170174:beverages`
- dry_run_decision: rejected
- source: usda / SR Legacy / 170174
- macros: 19 cal, 0.72P, 3.71C, 0.2F
- units: coconut yields=206g, cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: coconut water, coconut waters, nuts coconut water liquid from coconuts, nuts coconut water liquid from coconut
- reasons: duplicate_existing_product

### honey -> Honey

- candidate_key: `usda:sr legacy:169640:sauces condiments oils`
- dry_run_decision: rejected
- source: usda / SR Legacy / 169640
- macros: 304 cal, 0.3P, 82.4C, 0F
- units: cup=339g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 0 5 oz=14g, tbsp=21g
- aliases: honey, honeys
- reasons: duplicate_existing_product

### olive oil -> Olive oil

- candidate_key: `usda:survey fndds:2710186:sauces condiments oils`
- dry_run_decision: rejected
- source: usda / Survey (FNDDS) / 2710186
- macros: 900 cal, 0P, 0C, 100F
- units: cup=224g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14g
- aliases: olive oil
- reasons: duplicate_existing_product

### rolled oats -> Oats, whole grain, rolled, old fashioned

- candidate_key: `usda:foundation:2346396:breakfast snacks`
- dry_run_decision: rejected
- source: usda / Foundation / 2346396
- macros: 379 cal, 13.5P, 68.7C, 5.89F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rolled oats, rolled oatss, oats whole grain rolled old fashioned, oats whole grain rolled old fashioneds
- reasons: duplicate_existing_product

### salsa -> Dip, TOSTITOS, salsa con queso, medium

- candidate_key: `usda:sr legacy:174069:cuisine staples`
- dry_run_decision: rejected
- source: usda / SR Legacy / 174069
- macros: 133 cal, 2.92P, 11.7C, 8.26F
- units: cup=250g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: salsa, salsas, dip tostitos salsa con queso medium, dip tostitos salsa con queso mediums
- reasons: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk

### tomato paste -> Tomato, paste, canned, without salt added

- candidate_key: `usda:foundation:2685580:cuisine staples`
- dry_run_decision: rejected
- source: usda / Foundation / 2685580
- macros: 88.5 cal, 4.23P, 20.2C, 0.73F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tomato paste, tomato pastes, tomato paste canned without salt added, tomato paste canned without salt addeds
- reasons: state_modifier_mismatch_canned, duplicate_existing_product
