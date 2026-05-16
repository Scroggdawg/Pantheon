# Pantry Approval Ledger

Run ID: `dbf6879b-01f5-4707-bb87-4bf71f7a0e7c`
Generated From Artifact: 2026-05-16T00:04:42.072Z
Profile: Mexican Chipotle Review (data/pantry/packs/mexican-chipotle-review.json)
Window: offset 0, limit 25

This file is for review only. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:foundation:2727573:proteins | edit_needed | Beef, tenderloin steak, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_barbacoa. |
| usda:foundation:2514745:proteins | edit_needed | Pork, ground, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:sr legacy:172387:proteins | edit_needed | Chicken, broilers or fryers, thigh, meat only, cooked, fried | Review required: prepared_dish_mismatch_risk. |
| usda:survey fndds:2708607:cuisine staples | edit_needed | Fajita, vegetable | Review required: low_target_token_coverage_50. |
| usda:foundation:2747661:whole foods | edit_needed | Peppers, jalapeno, seeded, raw | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2514744:proteins | edit_needed | Beef, ground, 80% lean meat / 20% fat, raw | Review required: context_token_missing_taco. |
| usda:sr legacy:171288:cuisine staples | edit_needed | Cheese, Mexican blend | Review required: low_target_token_coverage_50, context_token_missing_crema. |
| usda:sr legacy:173461:cuisine staples | edit_needed | Dulce de Leche | Review required: low_target_token_coverage_0, context_token_missing_pico, context_token_missing_gallo. |
| usda:foundation:2647442:cuisine staples | edit_needed | Cheese, queso fresco, solid | Review required: profile_review_only, single_token_secondary_match_review_required, luke_overlay_review_required. |
| usda:foundation:746763:proteins | edit_needed | Beef, short loin, t-bone steak, bone-in, separable lean only, trimmed to 1/8" fat, choice, cooked, grilled | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2514747:proteins | rejected | Turkey, ground, 93% lean/ 7% fat, raw | Rejected by dry-run: low_target_token_coverage_50, context_token_missing_taco, duplicate_existing_product. |
| usda:sr legacy:174069:cuisine staples | rejected | Dip, TOSTITOS, salsa con queso, medium | Rejected by dry-run: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:foundation:321360:whole foods | rejected | Tomatoes, grape, raw | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:1104962:whole foods | rejected | Onions, white, raw | Rejected by dry-run: duplicate_existing_product. |

## Candidate Detail

### barbacoa beef -> Beef, tenderloin steak, raw

- candidate_key: `usda:foundation:2727573:proteins`
- dry_run_decision: review_required
- source: usda / Foundation / 2727573
- macros: 149 cal, 21.1P, 0.18C, 6.46F
- units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: barbacoa beef, barbacoa beefs, beef tenderloin steak raw
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_barbacoa

### carnitas pork -> Pork, ground, raw

- candidate_key: `usda:foundation:2514745:proteins`
- dry_run_decision: review_required
- source: usda / Foundation / 2514745
- macros: 233 cal, 17.8P, 0C, 17.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: carnitas pork, carnitas porks, pork ground raw
- reasons: profile_review_only, low_target_token_coverage_50

### chicken thigh cooked -> Chicken, broilers or fryers, thigh, meat only, cooked, fried

- candidate_key: `usda:sr legacy:172387:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 172387
- macros: 218 cal, 28.2P, 1.18C, 10.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, thigh bone and skin removed=52g, unit yield from 1 lb ready to cook chicken=31g
- aliases: chicken thigh cooked, chicken thigh cookeds, chicken broilers or fryers thigh meat only cooked fried, chicken broilers or fryers thigh meat only cooked frieds
- reasons: prepared_dish_mismatch_risk

### fajita vegetables -> Fajita, vegetable

- candidate_key: `usda:survey fndds:2708607:cuisine staples`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2708607
- macros: 166 cal, 3.22P, 20.43C, 7.84F
- units: cup=120g, fajita=95g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: fajita vegetables, fajita vegetable
- reasons: low_target_token_coverage_50

### jalapeno -> Peppers, jalapeno, seeded, raw

- candidate_key: `usda:foundation:2747661:whole foods`
- dry_run_decision: review_required
- source: usda / Foundation / 2747661
- macros: 24.1 cal, 0.62P, 5.08C, 0.15F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: jalapeno, jalapenos, peppers jalapeno seeded raw
- reasons: single_token_secondary_match_review_required

### lean ground beef taco meat -> Beef, ground, 80% lean meat / 20% fat, raw

- candidate_key: `usda:foundation:2514744:proteins`
- dry_run_decision: review_required
- source: usda / Foundation / 2514744
- macros: 248 cal, 17.5P, 0C, 19.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: lean ground beef taco meat, lean ground beef taco meats, beef ground 80 lean meat 20 fat raw
- reasons: context_token_missing_taco

### Mexican crema -> Cheese, Mexican blend

- candidate_key: `usda:sr legacy:171288:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 171288
- macros: 384 cal, 23.5P, 0.13C, 32.1F
- units: can=355g, cup shredded=112g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: mexican crema, mexican cremas, cheese mexican blend, cheese mexican blends
- reasons: low_target_token_coverage_50, context_token_missing_crema

### pico de gallo -> Dulce de Leche

- candidate_key: `usda:sr legacy:173461:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 173461
- macros: 315 cal, 6.84P, 55.4C, 7.35F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=19g
- aliases: pico de gallo, pico de gallos, dulce de leche, dulce de leches
- reasons: low_target_token_coverage_0, context_token_missing_pico, context_token_missing_gallo

### queso -> Cheese, queso fresco, solid

- candidate_key: `usda:foundation:2647442:cuisine staples`
- dry_run_decision: review_required
- source: usda / Foundation / 2647442
- macros: 297 cal, 18.9P, 2.96C, 23.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: queso, quesos, cheese queso fresco solid, cheese queso fresco solids
- reasons: profile_review_only, single_token_secondary_match_review_required, luke_overlay_review_required

### steak cooked -> Beef, short loin, t-bone steak, bone-in, separable lean only, trimmed to 1/8" fat, choice, cooked, grilled

- candidate_key: `usda:foundation:746763:proteins`
- dry_run_decision: review_required
- source: usda / Foundation / 746763
- macros: 219 cal, 27.3P, 0C, 11.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: steak cooked, steak cookeds, beef short loin t bone steak bone in separable lean only trimmed to 1 8 fat choice cooked grilled, beef short loin t bone steak bone in separable lean only trimmed to 1 8 fat choice cooked grilleds
- reasons: single_token_secondary_match_review_required

### ground turkey taco meat -> Turkey, ground, 93% lean/ 7% fat, raw

- candidate_key: `usda:foundation:2514747:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2514747
- macros: 158 cal, 17.3P, 0C, 9.59F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: ground turkey taco meat, ground turkey taco meats, turkey ground 93 lean 7 fat raw
- reasons: low_target_token_coverage_50, context_token_missing_taco, duplicate_existing_product

### salsa -> Dip, TOSTITOS, salsa con queso, medium

- candidate_key: `usda:sr legacy:174069:cuisine staples`
- dry_run_decision: rejected
- source: usda / SR Legacy / 174069
- macros: 133 cal, 2.92P, 11.7C, 8.26F
- units: cup=250g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: salsa, salsas, dip tostitos salsa con queso medium, dip tostitos salsa con queso mediums
- reasons: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk

### tomato -> Tomatoes, grape, raw

- candidate_key: `usda:foundation:321360:whole foods`
- dry_run_decision: rejected
- source: usda / Foundation / 321360
- macros: 27 cal, 0.83P, 5.51C, 0.63F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tomato, tomatos, tomatoes grape raw
- reasons: duplicate_existing_product

### white onion -> Onions, white, raw

- candidate_key: `usda:foundation:1104962:whole foods`
- dry_run_decision: rejected
- source: usda / Foundation / 1104962
- macros: 35 cal, 0.89P, 7.68C, 0.13F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: white onion, white onions, onions white raw
- reasons: duplicate_existing_product
