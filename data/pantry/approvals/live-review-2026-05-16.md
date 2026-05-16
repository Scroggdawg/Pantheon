# Live Pantry Review Queue

Generated: 2026-05-16T05:27:38.597Z
Source: Supabase pantry_import_candidates
Filter: decision=review_required
Rows: 69

This file is for review only. It does not apply rows to Supabase.

Allowed decisions in the table below:
- `approved`: candidate is acceptable for a future explicit review apply.
- `edit_needed`: candidate needs correction or richer source data before apply.
- `rejected`: candidate should become a remembered bad match.

## Counts

- decision review_required: 69
- category beverages: 2
- category breakfast_snacks: 3
- category coverage_buffer: 2
- category cuisine_staples: 16
- category prepared_common: 17
- category proteins: 15
- category sauces_condiments_oils: 7
- category whole_foods: 7

## Approval Table

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:174126:beverages | edit_needed | Beverages, coffee, instant, regular, half the caffeine | Review required: composite_target_review_required. |
| usda:foundation:2710837:beverages | edit_needed | Plum, black, with skin, raw | Review required: low_target_token_coverage_50. |
| usda:survey fndds:2705644:breakfast snacks | edit_needed | Ice cream cookie sandwich | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:173889:breakfast snacks | edit_needed | Cereals ready-to-eat, POST, Honeycomb Cereal | Review required: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required. |
| usda:sr legacy:167542:breakfast snacks | edit_needed | Snacks, granola bars, hard, plain | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2515375:coverage buffer | edit_needed | Nuts, hazelnuts or filberts, raw | Review required: low_target_token_coverage_33. |
| usda:sr legacy:173170:coverage buffer | edit_needed | Beverages, SLIMFAST, Meal replacement,  High Protein Shake, Ready-To-Drink, 3-2-1 plan | Review required: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, luke_overlay_review_required. |
| usda:survey fndds:2709709:cuisine staples | edit_needed | Sweet potato fries, NFS | Review required: not_further_specified_review_required. |
| usda:survey fndds:2709456:cuisine staples | edit_needed | Potato, french fries, NFS | Review required: not_further_specified_review_required. |
| usda:sr legacy:174090:cuisine staples | edit_needed | Rolls, hamburger or hot dog, whole wheat | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required. |
| usda:sr legacy:170717:cuisine staples | edit_needed | McDONALD'S, Hamburger | Review required: low_target_token_coverage_50, branded_restaurant_or_alcohol_review_required. |
| usda:survey fndds:2708818:cuisine staples | edit_needed | Macaroni or noodles with cheese and meat | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:174908:cuisine staples | edit_needed | Bread, cornbread, dry mix, enriched (includes corn muffin mix) | Review required: state_modifier_mismatch_dry, state_modifier_mismatch_mix, single_token_secondary_match_review_required. |
| usda:sr legacy:169032:cuisine staples | edit_needed | ON THE BORDER, refried beans | Review required: brand_like_name_token_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:169031:cuisine staples | edit_needed | ON THE BORDER, Mexican rice | Review required: brand_like_name_token_review_required. |
| usda:sr legacy:170733:cuisine staples | edit_needed | TACO BELL, Soft Taco with steak | Review required: low_target_token_coverage_50, brand_like_name_token_review_required. |
| usda:foundation:2710825:cuisine staples | edit_needed | Rice, black, unenriched, raw | Review required: low_target_token_coverage_33. |
| usda:foundation:2710822:cuisine staples | edit_needed | Arugula, baby, raw | Review required: low_target_token_coverage_0, context_token_missing_fajita. |
| usda:sr legacy:171288:cuisine staples | edit_needed | Cheese, Mexican blend | Review required: low_target_token_coverage_50, context_token_missing_crema. |
| usda:foundation:2647442:cuisine staples | edit_needed | Cheese, queso fresco, solid | Review required: profile_review_only, single_token_secondary_match_review_required, luke_overlay_review_required. |
| usda:sr legacy:175036:cuisine staples | edit_needed | Tortillas, ready-to-bake or -fry, corn | Review required: state_modifier_mismatch_bake. |
| usda:sr legacy:169742:cuisine staples | edit_needed | Rice noodles, dry | Review required: state_modifier_mismatch_dry. |
| usda:sr legacy:169724:cuisine staples | edit_needed | Wheat flour, white, tortilla mix, enriched | Review required: state_modifier_mismatch_mix. |
| usda:sr legacy:174606:prepared common | edit_needed | Sausage, turkey, hot, smoked | Review required: profile_review_only, low_target_token_coverage_67. |
| usda:sr legacy:167671:prepared common | edit_needed | CRACKER BARREL, macaroni n' cheese plate, from kid's menu | Review required: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required, context_token_missing_bbq, luke_overlay_review_required. |
| usda:sr legacy:172147:prepared common | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq. |
| usda:sr legacy:171524:prepared common | edit_needed | Chicken, broiler, rotisserie, BBQ, skin | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:168607:prepared common | edit_needed | Beef, brisket, whole, separable lean only, all grades, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:sr legacy:174583:prepared common | edit_needed | Sandwich spread, pork, beef | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required. |
| usda:survey fndds:2708560:prepared common | edit_needed | Burrito bowl, chicken | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle, luke_overlay_review_required. |
| usda:sr legacy:167559:prepared common | edit_needed | Snacks, tortilla chips, nacho cheese | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:survey fndds:2709307:prepared common | edit_needed | Guacamole, NFS | Review required: profile_review_only, low_target_token_coverage_50, not_further_specified_review_required, context_token_missing_chipotle. |
| usda:survey fndds:2708607:prepared common | edit_needed | Fajita, vegetable | Review required: profile_review_only, low_target_token_coverage_33, context_token_missing_chipotle. |
| usda:sr legacy:170086:prepared common | edit_needed | Beans, pinto, mature seeds, sprouted, raw | Review required: profile_review_only, state_modifier_mismatch_sprouted, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:sr legacy:173734:prepared common | edit_needed | Beans, black, mature seeds, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:foundation:2512380:prepared common | edit_needed | Rice, brown, long grain, unenriched, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:foundation:2512381:prepared common | edit_needed | Rice, white, long grain, unenriched, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:survey fndds:2705864:prepared common | edit_needed | Pork, carnitas | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle, luke_overlay_review_required. |
| usda:foundation:2727573:prepared common | edit_needed | Beef, tenderloin steak, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle. |
| usda:foundation:2514746:prepared common | edit_needed | Chicken, ground, with additives, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle. |
| usda:sr legacy:170693:proteins | edit_needed | Fast foods, hamburger; single, regular patty; plain | Review required: state_modifier_mismatch_fast foods. |
| usda:survey fndds:2706167:proteins | edit_needed | Hot dog, beef | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:174612:proteins | edit_needed | Turkey, breast, smoked, lemon pepper flavor, 97% fat-free | Review required: state_modifier_mismatch_flavor. |
| usda:sr legacy:172387:proteins | edit_needed | Chicken, broilers or fryers, thigh, meat only, cooked, fried | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:172146:proteins | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised | Review required: low_target_token_coverage_67. |
| usda:sr legacy:173344:proteins | edit_needed | Pulled pork in barbecue sauce | Review required: state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:foundation:2514744:proteins | edit_needed | Beef, ground, 80% lean meat / 20% fat, raw | Review required: context_token_missing_taco. |
| usda:foundation:2514745:proteins | edit_needed | Pork, ground, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:foundation:2727573:proteins | edit_needed | Beef, tenderloin steak, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_barbacoa. |
| usda:survey fndds:2706394:proteins | edit_needed | Steak tartare | Review required: state_modifier_mismatch_tartare. |
| usda:sr legacy:173180:proteins | edit_needed | Beverages, Protein powder whey based | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:168324:proteins | edit_needed | Pork, bacon, rendered fat, cooked | Review required: single_token_secondary_match_review_required. |
| usda:sr legacy:173722:proteins | edit_needed | Salmon nuggets, cooked as purchased, unheated | Review required: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets. |
| usda:sr legacy:175180:proteins | edit_needed | Crustaceans, shrimp, cooked | Review required: single_token_secondary_match_review_required. |
| usda:survey fndds:2706060:proteins | edit_needed | Chicken wing, rotisserie | Review required: state_modifier_mismatch_wing. |
| usda:sr legacy:173469:sauces condiments oils | edit_needed | Vinegar, cider | Review required: low_target_token_coverage_67. |
| usda:survey fndds:2709744:sauces condiments oils | edit_needed | Hot Thai sauce | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:167695:sauces condiments oils | edit_needed | Mayonnaise, made with tofu | Review required: state_modifier_mismatch_tofu. |
| usda:foundation:746777:sauces condiments oils | edit_needed | Sauce, salsa, ready-to-serve | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:174523:sauces condiments oils | edit_needed | Sauce, barbecue | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:171186:sauces condiments oils | edit_needed | Sauce, hot chile, sriracha | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:174278:sauces condiments oils | edit_needed | Soy sauce made from soy (tamari) | Review required: prepared_dish_mismatch_risk. |
| usda:foundation:2747661:whole foods | edit_needed | Peppers, jalapeno, seeded, raw | Review required: single_token_secondary_match_review_required. |
| usda:sr legacy:168561:whole foods | edit_needed | Pickle relish, sweet | Review required: state_modifier_mismatch_relish. |
| usda:sr legacy:173263:whole foods | edit_needed | Rice, brown, parboiled, cooked, UNCLE BENS | Review required: brand_like_name_token_review_required. |
| usda:sr legacy:170086:whole foods | edit_needed | Beans, pinto, mature seeds, sprouted, raw | Review required: state_modifier_mismatch_sprouted. |
| usda:foundation:2685568:whole foods | edit_needed | Squash, summer, green, zucchini, includes skin, raw | Review required: single_token_secondary_match_review_required. |
| usda:sr legacy:168766:whole foods | edit_needed | Candies, NESTLE, AFTER EIGHT Mints | Review required: single_token_secondary_match_review_required, brand_like_name_token_review_required. |
| usda:sr legacy:169103:whole foods | edit_needed | Orange peel, raw | Review required: state_modifier_mismatch_peel. |

## Candidate Detail

## beverages

### coffee with half and half -> Beverages, coffee, instant, regular, half the caffeine

- candidate_key: `usda:sr legacy:174126:beverages`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 174126
- macros: 352 cal, 14.4P, 73.2C, 0.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet=2g, tsp=1g
- aliases: coffee with half and half, coffee with half and halfs, beverages coffee instant regular half the caffeine, beverages coffee instant regular half the caffeines
- rejected_aliases: none
- risk: 25
- reasons: composite_target_review_required
- updated_at: 2026-05-16T04:18:17.412+00:00

### coffee black -> Plum, black, with skin, raw

- candidate_key: `usda:foundation:2710837:beverages`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 2710837
- macros: 52.7 cal, 0.58P, 13.5C, 0.28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: coffee black, coffee blacks, plum black with skin raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T04:18:17.17+00:00

## breakfast_snacks

### ice cream sandwich low calorie -> Ice cream cookie sandwich

- candidate_key: `usda:survey fndds:2705644:breakfast snacks`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Survey (FNDDS) / 2705644
- macros: 317 cal, 4.61P, 43.35C, 14.11F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, sandwich=75g
- aliases: ice cream sandwich low calorie, ice cream sandwich low calories, ice cream cookie sandwich, ice cream cookie sandwichs
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:18:16.707+00:00

### Kashi cereal -> Cereals ready-to-eat, POST, Honeycomb Cereal

- candidate_key: `usda:sr legacy:173889:breakfast snacks`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 173889
- macros: 394 cal, 6.01P, 86.6C, 2.93F
- units: cup 1 nlea serving=21.33g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: kashi cereal, kashi cereals, cereals ready to eat post honeycomb cereal, cereals ready to eat post honeycomb cereals
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required
- updated_at: 2026-05-16T04:18:15.279+00:00

### granola -> Snacks, granola bars, hard, plain

- candidate_key: `usda:sr legacy:167542:breakfast snacks`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 167542
- macros: 471 cal, 10.1P, 64.4C, 19.8F
- units: bar=21g, bar 1 oz=28g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: granola, granolas, snacks granola bars hard plain, snacks granola bars hard plains
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T04:18:15.016+00:00

## coverage_buffer

### hazelnut stevia drops -> Nuts, hazelnuts or filberts, raw

- candidate_key: `usda:foundation:2515375:coverage buffer`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 2515375
- macros: 602 cal, 13.5P, 26.5C, 53.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: hazelnut stevia drops, hazelnut stevia drop, nuts hazelnuts or filberts raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- updated_at: 2026-05-16T04:18:18.663+00:00

### protein shake dextrose -> Beverages, SLIMFAST, Meal replacement,  High Protein Shake, Ready-To-Drink, 3-2-1 plan

- candidate_key: `usda:sr legacy:173170:coverage buffer`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 173170
- macros: 61 cal, 6.59P, 0.85C, 3.38F
- units: bottle=295g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: protein shake dextrose, protein shake dextroses, beverages slimfast meal replacement high protein shake ready to drink 3 2 1 plan, beverages slimfast meal replacement high protein shake ready to drink 3 2 1 plans
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T04:18:18.432+00:00

## cuisine_staples

### sweet potato fries -> Sweet potato fries, NFS

- candidate_key: `usda:survey fndds:2709709:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Survey (FNDDS) / 2709709
- macros: 192 cal, 2.27P, 37.45C, 9.39F
- units: cup=60g, fry any cut=5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: sweet potato fries, sweet potato fry, sweet potato fries nfs
- rejected_aliases: none
- risk: 20
- reasons: not_further_specified_review_required
- updated_at: 2026-05-16T04:34:35.624+00:00

### french fries -> Potato, french fries, NFS

- candidate_key: `usda:survey fndds:2709456:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Survey (FNDDS) / 2709456
- macros: 225 cal, 2.5P, 23.23C, 14.07F
- units: crinkle cut=5g, cup=60g, fry ns as to shape=5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, shoestring=2g
- aliases: french fries, french fry, potato french fries nfs
- rejected_aliases: none
- risk: 20
- reasons: not_further_specified_review_required
- updated_at: 2026-05-16T04:34:35.388+00:00

### hot dog bun -> Rolls, hamburger or hot dog, whole wheat

- candidate_key: `usda:sr legacy:174090:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174090
- macros: 269 cal, 12.4P, 44.9C, 4.38F
- units: bun=50g, g=1g, hot dog=45g, kg=1000g, lb=453.59g, oz=28.35g, roll=56g
- aliases: hot dog bun, rolls hamburger or hot dog whole wheat, rolls hamburger or hot dog whole wheats
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required
- updated_at: 2026-05-16T04:34:34.938+00:00

### hamburger bun -> McDONALD'S, Hamburger

- candidate_key: `usda:sr legacy:170717:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 170717
- macros: 264 cal, 12.9P, 30.3C, 10.1F
- units: bun=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, sandwich=95g
- aliases: hamburger bun, mcdonalds hamburger, mcdonalds hamburgers
- rejected_aliases: none
- risk: 45
- reasons: low_target_token_coverage_50, branded_restaurant_or_alcohol_review_required
- updated_at: 2026-05-16T04:34:34.698+00:00

### macaroni and cheese -> Macaroni or noodles with cheese and meat

- candidate_key: `usda:survey fndds:2708818:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Survey (FNDDS) / 2708818
- macros: 210 cal, 11.79P, 15.14C, 11.16F
- units: cup=230g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: macaroni and cheese, macaroni and cheeses, macaroni or noodles with cheese and meat, macaroni or noodles with cheese and meats
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:34.266+00:00

### cornbread -> Bread, cornbread, dry mix, enriched (includes corn muffin mix)

- candidate_key: `usda:sr legacy:174908:cuisine staples`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174908
- macros: 418 cal, 7P, 69.5C, 12.2F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, package 8 5 oz=241g
- aliases: cornbread, cornbreads, bread cornbread dry mix enriched includes corn muffin mix
- rejected_aliases: none
- risk: 60
- reasons: state_modifier_mismatch_dry, state_modifier_mismatch_mix, single_token_secondary_match_review_required
- updated_at: 2026-05-16T04:34:34.012+00:00

### refried beans -> ON THE BORDER, refried beans

- candidate_key: `usda:sr legacy:169032:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 169032
- macros: 144 cal, 7.3P, 17.5C, 5F
- units: cup=135g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: refried beans, refried bean, on the border refried beans, on the border refried bean
- rejected_aliases: none
- risk: 35
- reasons: brand_like_name_token_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:24:21.908+00:00

### Mexican rice -> ON THE BORDER, Mexican rice

- candidate_key: `usda:sr legacy:169031:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 169031
- macros: 195 cal, 3.56P, 34.2C, 4.86F
- units: can=355g, cup=114g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: mexican rice, mexican rices, on the border mexican rice, on the border mexican rices
- rejected_aliases: none
- risk: 20
- reasons: brand_like_name_token_review_required
- updated_at: 2026-05-16T04:24:21.7+00:00

### taco seasoning -> TACO BELL, Soft Taco with steak

- candidate_key: `usda:sr legacy:170733:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 170733
- macros: 225 cal, 11.8P, 17.2C, 12.1F
- units: g=1g, item=127g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: taco seasoning, taco seasonings, taco bell soft taco with steak, taco bell soft taco with steaks
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50, brand_like_name_token_review_required
- updated_at: 2026-05-16T04:24:21.46+00:00

### cilantro lime rice -> Rice, black, unenriched, raw

- candidate_key: `usda:foundation:2710825:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2710825
- macros: 361 cal, 7.57P, 77.2C, 3.44F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cilantro lime rice, cilantro lime rices, rice black unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- updated_at: 2026-05-16T04:24:21.202+00:00

### fajita vegetables -> Arugula, baby, raw

- candidate_key: `usda:foundation:2710822:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2710822
- macros: 25.9 cal, 1.65P, 5.37C, 0.33F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: fajita vegetables, fajita vegetable, arugula baby raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_0, context_token_missing_fajita
- updated_at: 2026-05-16T04:24:20.501+00:00

### Mexican crema -> Cheese, Mexican blend

- candidate_key: `usda:sr legacy:171288:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 171288
- macros: 384 cal, 23.5P, 0.13C, 32.1F
- units: can=355g, cup shredded=112g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: mexican crema, mexican cremas, cheese mexican blend, cheese mexican blends
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50, context_token_missing_crema
- updated_at: 2026-05-16T04:24:20.295+00:00

### queso -> Cheese, queso fresco, solid

- candidate_key: `usda:foundation:2647442:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2647442
- macros: 297 cal, 18.9P, 2.96C, 23.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: queso, quesos, cheese queso fresco solid, cheese queso fresco solids
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, single_token_secondary_match_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T04:24:20.029+00:00

### corn tortilla -> Tortillas, ready-to-bake or -fry, corn

- candidate_key: `usda:sr legacy:175036:cuisine staples`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 175036
- macros: 218 cal, 5.7P, 44.6C, 2.85F
- units: enchilada=19g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: corn tortilla, corn tortillas, tortillas ready to bake or fry corn, tortillas ready to bake or fry corns
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_bake
- updated_at: 2026-05-16T04:24:19.096+00:00

### rice noodles -> Rice noodles, dry

- candidate_key: `usda:sr legacy:169742:cuisine staples`
- decision: review_required
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / SR Legacy / 169742
- macros: 364 cal, 5.95P, 80.2C, 0.56F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rice noodles, rice noodle, rice noodles dry
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_dry
- updated_at: 2026-05-16T03:26:23.942+00:00

### flour tortilla -> Wheat flour, white, tortilla mix, enriched

- candidate_key: `usda:sr legacy:169724:cuisine staples`
- decision: review_required
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / SR Legacy / 169724
- macros: 405 cal, 9.66P, 67.1C, 10.6F
- units: cup=111g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: flour tortilla, flour tortillas, wheat flour white tortilla mix enriched, wheat flour white tortilla mix enricheds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_mix
- updated_at: 2026-05-16T03:26:22.747+00:00

## prepared_common

### smoked turkey sandwich -> Sausage, turkey, hot, smoked

- candidate_key: `usda:sr legacy:174606:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174606
- macros: 158 cal, 15P, 4.65C, 8.75F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: smoked turkey sandwich, smoked turkey sandwichs, sausage turkey hot smoked, sausage turkey hot smokeds
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67
- updated_at: 2026-05-16T04:34:38.673+00:00

### bbq plate -> CRACKER BARREL, macaroni n' cheese plate, from kid's menu

- candidate_key: `usda:sr legacy:167671:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 167671
- macros: 192 cal, 6.46P, 15.6C, 11.5F
- units: cup=149g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=257g
- aliases: bbq plate, bbq plates, cracker barrel macaroni n cheese plate from kids menu, cracker barrel macaroni n cheese plate from kids menus
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required, context_token_missing_bbq, luke_overlay_review_required
- updated_at: 2026-05-16T04:34:38.496+00:00

### bbq ribs -> Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, raw

- candidate_key: `usda:sr legacy:172147:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 172147
- macros: 252 cal, 18.7P, 0.64C, 19.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1604g
- aliases: bbq ribs, bbq ribss, beef rib back ribs bone in separable lean only trimmed to 0 fat choice raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq
- updated_at: 2026-05-16T04:34:38.279+00:00

### bbq chicken -> Chicken, broiler, rotisserie, BBQ, skin

- candidate_key: `usda:sr legacy:171524:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 171524
- macros: 378 cal, 15.2P, 0.7C, 35.2F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=85g
- aliases: bbq chicken, bbq chickens, chicken broiler rotisserie bbq skin, chicken broiler rotisserie bbq skins
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T04:34:38.088+00:00

### brisket sandwich -> Beef, brisket, whole, separable lean only, all grades, raw

- candidate_key: `usda:sr legacy:168607:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 168607
- macros: 157 cal, 20.7P, 0.6C, 7.37F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: brisket sandwich, brisket sandwichs, beef brisket whole separable lean only all grades raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T04:34:37.883+00:00

### pulled pork sandwich -> Sandwich spread, pork, beef

- candidate_key: `usda:sr legacy:174583:prepared common`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174583
- macros: 235 cal, 7.66P, 11.9C, 17.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: pulled pork sandwich, pulled pork sandwichs, sandwich spread pork beef, sandwich spread pork beefs
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required
- updated_at: 2026-05-16T04:34:37.685+00:00

### Chipotle chicken bowl -> Burrito bowl, chicken

- candidate_key: `usda:survey fndds:2708560:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2708560
- macros: 161 cal, 21.04P, 0.27C, 8.11F
- units: chip=2g, cup=120g, g=1g, item any size=225g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle chicken bowl, chipotle chicken bowls, burrito bowl chicken, burrito bowl chickens
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle, luke_overlay_review_required
- updated_at: 2026-05-16T04:24:25.785+00:00

### Chipotle tortilla chips -> Snacks, tortilla chips, nacho cheese

- candidate_key: `usda:sr legacy:167559:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 167559
- macros: 519 cal, 7.36P, 60.8C, 27.4F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: chipotle tortilla chips, chipotle tortilla chip, snacks tortilla chips nacho cheese, snacks tortilla chips nacho cheeses
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:25.431+00:00

### Chipotle guacamole -> Guacamole, NFS

- candidate_key: `usda:survey fndds:2709307:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2709307
- macros: 155 cal, 1.95P, 8.45C, 14.18F
- units: chip=2g, g=1g, individual container=70g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: chipotle guacamole, chipotle guacamoles, guacamole nfs
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, not_further_specified_review_required, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:25.216+00:00

### Chipotle fajita vegetables -> Fajita, vegetable

- candidate_key: `usda:survey fndds:2708607:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2708607
- macros: 166 cal, 3.22P, 20.43C, 7.84F
- units: chip=2g, cup=120g, fajita=95g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle fajita vegetables, chipotle fajita vegetable, fajita vegetable, fajita vegetables
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_33, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:25.015+00:00

### Chipotle pinto beans -> Beans, pinto, mature seeds, sprouted, raw

- candidate_key: `usda:sr legacy:170086:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 170086
- macros: 62 cal, 5.25P, 11.6C, 0.9F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle pinto beans, chipotle pinto bean, beans pinto mature seeds sprouted raw
- rejected_aliases: none
- risk: 40
- reasons: profile_review_only, state_modifier_mismatch_sprouted, low_target_token_coverage_67, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:24.789+00:00

### Chipotle black beans -> Beans, black, mature seeds, raw

- candidate_key: `usda:sr legacy:173734:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 173734
- macros: 341 cal, 21.6P, 62.4C, 1.42F
- units: chip=2g, cup=194g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=12.1g
- aliases: chipotle black beans, chipotle black bean, beans black mature seeds raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:24.575+00:00

### Chipotle brown rice -> Rice, brown, long grain, unenriched, raw

- candidate_key: `usda:foundation:2512380:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2512380
- macros: 368 cal, 7.25P, 76.7C, 3.31F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle brown rice, chipotle brown rices, rice brown long grain unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:24.371+00:00

### Chipotle white rice -> Rice, white, long grain, unenriched, raw

- candidate_key: `usda:foundation:2512381:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2512381
- macros: 370 cal, 7.04P, 80.3C, 1.03F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle white rice, chipotle white rices, rice white long grain unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:24.138+00:00

### Chipotle carnitas -> Pork, carnitas

- candidate_key: `usda:survey fndds:2705864:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2705864
- macros: 271 cal, 24.57P, 0C, 18.33F
- units: chip=2g, cup=135g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz yields=20g
- aliases: chipotle carnitas, chipotle carnita, pork carnitas, pork carnita
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle, luke_overlay_review_required
- updated_at: 2026-05-16T04:24:23.902+00:00

### Chipotle steak -> Beef, tenderloin steak, raw

- candidate_key: `usda:foundation:2727573:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2727573
- macros: 149 cal, 21.1P, 0.18C, 6.46F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle steak, chipotle steaks, beef tenderloin steak raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:23.667+00:00

### Chipotle chicken -> Chicken, ground, with additives, raw

- candidate_key: `usda:foundation:2514746:prepared common`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2514746
- macros: 138 cal, 17.9P, 0C, 7.16F
- units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chipotle chicken, chipotle chickens, chicken ground with additives raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle
- updated_at: 2026-05-16T04:24:23.461+00:00

## proteins

### hamburger patty -> Fast foods, hamburger; single, regular patty; plain

- candidate_key: `usda:sr legacy:170693:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 170693
- macros: 297 cal, 16.5P, 31.5C, 12F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty=113g, sandwich=78g
- aliases: hamburger patty, hamburger pattys, fast foods hamburger single regular patty plain, fast foods hamburger single regular patty plains
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_fast foods
- updated_at: 2026-05-16T04:34:33.311+00:00

### beef hot dog -> Hot dog, beef

- candidate_key: `usda:survey fndds:2706167:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Survey (FNDDS) / 2706167
- macros: 310 cal, 11.7P, 2.89C, 28F
- units: bun length jumbo=57g, cocktail miniature=10g, cup sliced=150g, footlong=88g, g=1g, hot dog=45g, kg=1000g, lb=453.59g
- aliases: beef hot dog, hot dog beef, hot dog beefs
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T04:34:33.09+00:00

### smoked turkey breast -> Turkey, breast, smoked, lemon pepper flavor, 97% fat-free

- candidate_key: `usda:sr legacy:174612:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174612
- macros: 95 cal, 20.9P, 1.31C, 0.69F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=28g
- aliases: smoked turkey breast, smoked turkey breasts, turkey breast smoked lemon pepper flavor 97 fat free, turkey breast smoked lemon pepper flavor 97 fat frees
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_flavor
- updated_at: 2026-05-16T04:34:32.668+00:00

### chicken thigh cooked -> Chicken, broilers or fryers, thigh, meat only, cooked, fried

- candidate_key: `usda:sr legacy:172387:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 172387
- macros: 218 cal, 28.2P, 1.18C, 10.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, thigh bone and skin removed=52g, unit yield from 1 lb ready to cook chicken=31g
- aliases: chicken thigh cooked, chicken thigh cookeds, chicken broilers or fryers thigh meat only cooked fried, chicken broilers or fryers thigh meat only cooked frieds
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:32.204+00:00

### baby back ribs cooked -> Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised

- candidate_key: `usda:sr legacy:172146:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 172146
- macros: 306 cal, 27.8P, 0C, 21.7F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1197g
- aliases: baby back ribs cooked, baby back ribs cookeds, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braised, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braiseds
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_67
- updated_at: 2026-05-16T04:34:31.94+00:00

### pulled pork -> Pulled pork in barbecue sauce

- candidate_key: `usda:sr legacy:173344:proteins`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 173344
- macros: 168 cal, 13.2P, 18.7C, 4.42F
- units: cup=249g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pulled pork, pulled porks, pulled pork in barbecue sauce, pulled pork in barbecue sauces
- rejected_aliases: none
- risk: 80
- reasons: state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:31.251+00:00

### lean ground beef taco meat -> Beef, ground, 80% lean meat / 20% fat, raw

- candidate_key: `usda:foundation:2514744:proteins`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2514744
- macros: 248 cal, 17.5P, 0C, 19.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: lean ground beef taco meat, lean ground beef taco meats, beef ground 80 lean meat 20 fat raw
- rejected_aliases: none
- risk: 20
- reasons: context_token_missing_taco
- updated_at: 2026-05-16T04:24:18.592+00:00

### carnitas pork -> Pork, ground, raw

- candidate_key: `usda:foundation:2514745:proteins`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2514745
- macros: 233 cal, 17.8P, 0C, 17.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: carnitas pork, carnitas porks, pork ground raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T04:24:18.164+00:00

### barbacoa beef -> Beef, tenderloin steak, raw

- candidate_key: `usda:foundation:2727573:proteins`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 2727573
- macros: 149 cal, 21.1P, 0.18C, 6.46F
- units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: barbacoa beef, barbacoa beefs, beef tenderloin steak raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_barbacoa
- updated_at: 2026-05-16T04:24:17.965+00:00

### steak cooked -> Steak tartare

- candidate_key: `usda:survey fndds:2706394:proteins`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2706394
- macros: 216 cal, 17.45P, 0.34C, 15.6F
- units: cup=225g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: steak cooked, steak cookeds, steak tartare, steak tartares
- rejected_aliases: none
- risk: 20
- reasons: state_modifier_mismatch_tartare
- updated_at: 2026-05-16T04:24:17.756+00:00

### protein powder whey -> Beverages, Protein powder whey based

- candidate_key: `usda:sr legacy:173180:proteins`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 173180
- macros: 352 cal, 78.1P, 6.25C, 1.56F
- units: cup=96.97g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: protein powder whey, protein powder wheys, beverages protein powder whey based, beverages protein powder whey baseds
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T04:18:13.37+00:00

### bacon cooked -> Pork, bacon, rendered fat, cooked

- candidate_key: `usda:sr legacy:168324:proteins`
- decision: review_required
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 168324
- macros: 898 cal, 0.07P, 0C, 99.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: bacon cooked, bacon cookeds, pork bacon rendered fat cooked, pork bacon rendered fat cookeds
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T04:18:11.914+00:00

### salmon cooked -> Salmon nuggets, cooked as purchased, unheated

- candidate_key: `usda:sr legacy:173722:proteins`
- decision: review_required
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / SR Legacy / 173722
- macros: 189 cal, 12P, 11.8C, 10.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: salmon cooked, salmon cookeds, salmon nuggets cooked as purchased unheated, salmon nuggets cooked as purchased unheateds
- rejected_aliases: none
- risk: 60
- reasons: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets
- updated_at: 2026-05-16T03:25:13.4+00:00

### shrimp cooked -> Crustaceans, shrimp, cooked

- candidate_key: `usda:sr legacy:175180:proteins`
- decision: review_required
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / SR Legacy / 175180
- macros: 99 cal, 24P, 0.2C, 0.28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: shrimp cooked, shrimp cookeds, crustaceans shrimp cooked, crustaceans shrimp cookeds
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T03:25:13.185+00:00

### rotisserie chicken -> Chicken wing, rotisserie

- candidate_key: `usda:survey fndds:2706060:proteins`
- decision: review_required
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Survey (FNDDS) / 2706060
- macros: 257 cal, 23.42P, 0.6C, 18.04F
- units: drummette=22g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, wing any size=35g
- aliases: rotisserie chicken, rotisserie chickens, chicken wing rotisserie, chicken wing rotisseries
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_wing
- updated_at: 2026-05-16T03:25:09.382+00:00

## sauces_condiments_oils

### apple cider vinegar -> Vinegar, cider

- candidate_key: `usda:sr legacy:173469:sauces condiments oils`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 173469
- macros: 21 cal, 0P, 0.93C, 0F
- units: cup=239g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14.9g, tsp=5g
- aliases: apple cider vinegar, apple cider vinegars, vinegar cider, vinegar ciders
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_67
- updated_at: 2026-05-16T04:34:37.22+00:00

### hot sauce -> Hot Thai sauce

- candidate_key: `usda:survey fndds:2709744:sauces condiments oils`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Survey (FNDDS) / 2709744
- macros: 74 cal, 1.03P, 16.58C, 0.66F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet=9g, tbsp=16g
- aliases: hot sauce, hot sauces, hot thai sauce, hot thai sauces
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:36.975+00:00

### mayonnaise -> Mayonnaise, made with tofu

- candidate_key: `usda:sr legacy:167695:sauces condiments oils`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 167695
- macros: 322 cal, 5.95P, 3.06C, 31.8F
- units: cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: mayonnaise, mayonnaises, mayonnaise made with tofu, mayonnaise made with tofus
- rejected_aliases: none
- risk: 20
- reasons: state_modifier_mismatch_tofu
- updated_at: 2026-05-16T04:34:36.77+00:00

### bbq sauce -> Sauce, salsa, ready-to-serve

- candidate_key: `usda:foundation:746777:sauces condiments oils`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Foundation / 746777
- macros: 29 cal, 1.44P, 6.74C, 0.19F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: bbq sauce, bbq sauces, sauce salsa ready to serve, sauce salsa ready to serves
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:36.03+00:00

### barbecue sauce -> Sauce, barbecue

- candidate_key: `usda:sr legacy:174523:sauces condiments oils`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174523
- macros: 172 cal, 0.82P, 40.8C, 0.63F
- units: bar=65g, cup=279g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- aliases: barbecue sauce, barbecue sauces, sauce barbecue, sauce barbecues
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:34:35.835+00:00

### hot sauce -> Sauce, hot chile, sriracha

- candidate_key: `usda:sr legacy:171186:sauces condiments oils`
- decision: review_required
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 171186
- macros: 93 cal, 1.93P, 19.2C, 0.93F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tsp=6.5g
- aliases: hot sauce, hot sauces, sauce hot chile sriracha, sauce hot chile srirachas
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:24:22.512+00:00

### soy sauce -> Soy sauce made from soy (tamari)

- candidate_key: `usda:sr legacy:174278:sauces condiments oils`
- decision: review_required
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / SR Legacy / 174278
- macros: 60 cal, 10.5P, 5.57C, 0.1F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=18g, tsp=6g
- aliases: soy sauce, soy sauces, soy sauce made from soy tamari, soy sauce made from soy tamaris
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T03:26:25.776+00:00

## whole_foods

### jalapeno -> Peppers, jalapeno, seeded, raw

- candidate_key: `usda:foundation:2747661:whole foods`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Foundation / 2747661
- macros: 24.1 cal, 0.62P, 5.08C, 0.15F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: jalapeno, jalapenos, peppers jalapeno seeded raw
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T04:34:30.5+00:00

### pickle -> Pickle relish, sweet

- candidate_key: `usda:sr legacy:168561:whole foods`
- decision: review_required
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 168561
- macros: 130 cal, 0.37P, 35.1C, 0.47F
- units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 2 3 tbsp=10g, tbsp=15g
- aliases: pickle, pickles, pickle relish sweet, pickle relish sweets
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_relish
- updated_at: 2026-05-16T04:34:30.294+00:00

### brown rice cooked -> Rice, brown, parboiled, cooked, UNCLE BENS

- candidate_key: `usda:sr legacy:173263:whole foods`
- decision: review_required
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / SR Legacy / 173263
- macros: 147 cal, 3.09P, 31.3C, 0.85F
- units: cup=155g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: brown rice cooked, brown rice cookeds, rice brown parboiled cooked uncle bens, rice brown parboiled cooked uncle benss
- rejected_aliases: none
- risk: 20
- reasons: brand_like_name_token_review_required
- updated_at: 2026-05-16T03:25:04.5+00:00

### pinto beans -> Beans, pinto, mature seeds, sprouted, raw

- candidate_key: `usda:sr legacy:170086:whole foods`
- decision: review_required
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 170086
- macros: 62 cal, 5.25P, 11.6C, 0.9F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pinto beans, pinto bean, beans pinto mature seeds sprouted raw
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_sprouted
- updated_at: 2026-05-16T03:17:46.272+00:00

### zucchini -> Squash, summer, green, zucchini, includes skin, raw

- candidate_key: `usda:foundation:2685568:whole foods`
- decision: review_required
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / Foundation / 2685568
- macros: 16 cal, 0.98P, 3.27C, 0.21F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: zucchini, zucchinis, squash summer green zucchini includes skin raw
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T03:17:45.269+00:00

### mint -> Candies, NESTLE, AFTER EIGHT Mints

- candidate_key: `usda:sr legacy:168766:whole foods`
- decision: review_required
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 168766
- macros: 432 cal, 1.67P, 79.5C, 11.9F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=8.4g, serving 5 mints=42g
- aliases: mint, mints, candies nestle after eight mints, candies nestle after eight mint
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required, brand_like_name_token_review_required
- updated_at: 2026-05-16T03:17:43.728+00:00

### orange -> Orange peel, raw

- candidate_key: `usda:sr legacy:169103:whole foods`
- decision: review_required
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 169103
- macros: 97 cal, 1.5P, 25C, 0.2F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=6g, tsp=2g
- aliases: orange, oranges, orange peel raw
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_peel
- updated_at: 2026-05-16T03:17:41.314+00:00
