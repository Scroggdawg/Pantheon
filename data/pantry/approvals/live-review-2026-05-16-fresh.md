# Live Pantry Review Queue

Generated: 2026-05-16T06:50:40.981Z
Source: Supabase pantry_import_candidates
Filter: decision=review_required + rejected
Rows: 200

This file is for review only. It does not apply rows to Supabase.

Allowed decisions in the table below:
- `approved`: candidate is acceptable for a future explicit review apply.
- `edit_needed`: candidate needs correction or richer source data before apply.
- `rejected`: candidate should become a remembered bad match.

## Counts

- decision review_required: 114
- decision rejected: 86
- category beverages: 11
- category breakfast_snacks: 15
- category coverage_buffer: 4
- category cuisine_staples: 35
- category prepared_common: 30
- category proteins: 36
- category sauces_condiments_oils: 30
- category whole_foods: 39

## Approval Table

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:survey fndds:2710756:beverages | edit_needed | Energy Drink | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:sr legacy:171917:beverages | rejected | Beverages, tea, green, brewed, regular | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:171255:beverages | rejected | Cream, fluid, half and half | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:174126:beverages | edit_needed | Beverages, coffee, instant, regular, half the caffeine | Review required: composite_target_review_required. |
| usda:foundation:2710837:beverages | edit_needed | Plum, black, with skin, raw | Review required: low_target_token_coverage_50. |
| usda:foundation:1999631:beverages | rejected | Almond milk, unsweetened, plain, shelf stable | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2705406:beverages | rejected | Soy milk, chocolate | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:330458:beverages | rejected | Oil, coconut | Rejected by risk engine: low_target_token_coverage_50, duplicate_existing_product. |
| usda:sr legacy:170174:beverages | rejected | Nuts, coconut water (liquid from coconuts) | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:174120:beverages | edit_needed | Beverages, tea, Oolong, brewed | Review required: profile_review_only, low_target_token_coverage_33. |
| usda:survey fndds:2710638:beverages | rejected | Margarita | Rejected by risk engine: profile_review_only, low_target_token_coverage_33, macro_sanity_failed, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required. |
| usda:sr legacy:172986:breakfast snacks | edit_needed | Cereals ready-to-eat, QUAKER, MOTHER'S Toasted Oat Bran cereal | Review required: brand_like_name_token_review_required. |
| usda:foundation:330137:breakfast snacks | rejected | Yogurt, Greek, plain, nonfat | Rejected by risk engine: profile_review_only, low_target_token_coverage_67, duplicate_existing_product. |
| usda:survey fndds:2705640:breakfast snacks | edit_needed | Ice cream candy bar | Review required: profile_review_only. |
| usda:survey fndds:2709217:breakfast snacks | edit_needed | Applesauce, unsweetened | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:167715:breakfast snacks | rejected | Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size | Rejected by risk engine: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, duplicate_existing_product. |
| usda:sr legacy:168872:breakfast snacks | rejected | Oat bran, raw | Rejected by risk engine: profile_review_only, low_target_token_coverage_67, macro_sanity_failed. |
| usda:survey fndds:2708088:breakfast snacks | edit_needed | Cereal or granola bar (Kashi Chewy) | Review required: profile_review_only, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required. |
| usda:sr legacy:167542:breakfast snacks | edit_needed | Snacks, granola bars, hard, plain | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2346396:breakfast snacks | rejected | Oats, whole grain, rolled, old fashioned | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173032:breakfast snacks | rejected | Goji berries, dried | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2705644:breakfast snacks | edit_needed | Ice cream cookie sandwich | Review required: prepared_dish_mismatch_risk. |
| usda:foundation:328841:breakfast snacks | rejected | Cheese, cottage, lowfat, 2% milkfat | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2346414:breakfast snacks | rejected | Applesauce, unsweetened, with added vitamin C | Rejected by risk engine: state_modifier_mismatch_sweetened, duplicate_existing_product, prepared_dish_mismatch_risk. |
| usda:sr legacy:173889:breakfast snacks | edit_needed | Cereals ready-to-eat, POST, Honeycomb Cereal | Review required: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required. |
| usda:foundation:2346397:breakfast snacks | rejected | Oats, whole grain, steel cut | Rejected by risk engine: low_target_token_coverage_50, duplicate_existing_product. |
| usda:foundation:328841:coverage buffer | rejected | Cheese, cottage, lowfat, 2% milkfat | Rejected by risk engine: low_target_token_coverage_67, duplicate_existing_product. |
| usda:survey fndds:2710726:coverage buffer | edit_needed | Nutritional drink or shake, high protein, ready-to-drink, NFS | Review required: profile_review_only, low_target_token_coverage_67, not_further_specified_review_required. |
| usda:foundation:2515375:coverage buffer | edit_needed | Nuts, hazelnuts or filberts, raw | Review required: low_target_token_coverage_33. |
| usda:sr legacy:173170:coverage buffer | edit_needed | Beverages, SLIMFAST, Meal replacement,  High Protein Shake, Ready-To-Drink, 3-2-1 plan | Review required: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, luke_overlay_review_required. |
| usda:foundation:2710825:cuisine staples | edit_needed | Rice, black, unenriched, raw | Review required: low_target_token_coverage_33. |
| usda:survey fndds:2708422:cuisine staples | rejected | Rice, white, cooked, glutinous | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168914:cuisine staples | rejected | Rice noodles, cooked | Rejected by risk engine: low_target_token_coverage_50, duplicate_existing_product. |
| usda:survey fndds:2705818:cuisine staples | rejected | Mozzarella cheese, tomato, and basil, with oil and vinegar dressing | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:325036:cuisine staples | rejected | Cheese, parmesan, grated | Rejected by risk engine: profile_review_only, duplicate_existing_product, luke_overlay_review_required. |
| usda:foundation:332282:cuisine staples | edit_needed | Sauce, pasta, spaghetti/marinara, ready-to-serve | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:survey fndds:2709735:cuisine staples | edit_needed | Tomato chili sauce | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:survey fndds:2708352:cuisine staples | rejected | Noodles, cooked | Rejected by risk engine: profile_review_only, low_target_token_coverage_50, duplicate_existing_product. |
| usda:survey fndds:2708357:cuisine staples | edit_needed | Pasta, cooked | Review required: low_target_token_coverage_50. |
| usda:sr legacy:168912:cuisine staples | edit_needed | Spaghetti, spinach, cooked | Review required: state_modifier_mismatch_spinach. |
| usda:sr legacy:170164:cuisine staples | edit_needed | Nuts, chestnuts, chinese, raw | Review required: low_target_token_coverage_50. |
| usda:survey fndds:2707493:cuisine staples | edit_needed | Cashews, NFS | Review required: not_further_specified_review_required. |
| usda:foundation:2515376:cuisine staples | rejected | Peanuts, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2708402:cuisine staples | edit_needed | Rice, cooked, NFS | Review required: low_target_token_coverage_50, not_further_specified_review_required. |
| usda:survey fndds:2709709:cuisine staples | edit_needed | Sweet potato fries, NFS | Review required: not_further_specified_review_required. |
| usda:survey fndds:2709456:cuisine staples | edit_needed | Potato, french fries, NFS | Review required: not_further_specified_review_required. |
| usda:sr legacy:174090:cuisine staples | edit_needed | Rolls, hamburger or hot dog, whole wheat | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required. |
| usda:sr legacy:170717:cuisine staples | edit_needed | McDONALD'S, Hamburger | Review required: low_target_token_coverage_50, branded_restaurant_or_alcohol_review_required. |
| usda:survey fndds:2708818:cuisine staples | edit_needed | Macaroni or noodles with cheese and meat | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:174908:cuisine staples | edit_needed | Bread, cornbread, dry mix, enriched (includes corn muffin mix) | Review required: state_modifier_mismatch_dry, state_modifier_mismatch_mix, single_token_secondary_match_review_required. |
| usda:sr legacy:169032:cuisine staples | edit_needed | ON THE BORDER, refried beans | Review required: brand_like_name_token_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:169031:cuisine staples | edit_needed | ON THE BORDER, Mexican rice | Review required: brand_like_name_token_review_required. |
| usda:sr legacy:170733:cuisine staples | edit_needed | TACO BELL, Soft Taco with steak | Review required: low_target_token_coverage_50, brand_like_name_token_review_required. |
| usda:sr legacy:173796:cuisine staples | rejected | Beans, pinto, mature seeds, cooked, boiled, with salt | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:175237:cuisine staples | rejected | Beans, black, mature seeds, cooked, boiled, with salt | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2710822:cuisine staples | edit_needed | Arugula, baby, raw | Review required: low_target_token_coverage_0, context_token_missing_fajita. |
| usda:sr legacy:171288:cuisine staples | edit_needed | Cheese, Mexican blend | Review required: low_target_token_coverage_50, context_token_missing_crema. |
| usda:foundation:2647442:cuisine staples | edit_needed | Cheese, queso fresco, solid | Review required: profile_review_only, single_token_secondary_match_review_required, luke_overlay_review_required. |
| usda:sr legacy:173461:cuisine staples | rejected | Dulce de Leche | Rejected by risk engine: low_target_token_coverage_0, context_token_missing_pico, context_token_missing_gallo, duplicate_existing_product. |
| usda:sr legacy:174069:cuisine staples | rejected | Dip, TOSTITOS, salsa con queso, medium | Rejected by risk engine: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:175036:cuisine staples | edit_needed | Tortillas, ready-to-bake or -fry, corn | Review required: state_modifier_mismatch_bake. |
| usda:survey fndds:2708202:cuisine staples | rejected | Tortilla chips, plain | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2685580:cuisine staples | rejected | Tomato, paste, canned, without salt added | Rejected by risk engine: state_modifier_mismatch_canned, duplicate_existing_product. |
| usda:sr legacy:169742:cuisine staples | edit_needed | Rice noodles, dry | Review required: state_modifier_mismatch_dry. |
| usda:sr legacy:169724:cuisine staples | edit_needed | Wheat flour, white, tortilla mix, enriched | Review required: state_modifier_mismatch_mix. |
| usda:sr legacy:168035:prepared common | edit_needed | Willow, leaves in oil (Alaska Native) | Review required: profile_review_only, low_target_token_coverage_0. |
| usda:survey fndds:2708560:prepared common | edit_needed | Burrito bowl, chicken | Review required: profile_review_only, low_target_token_coverage_67. |
| usda:foundation:2684443:prepared common | edit_needed | Crustaceans, shrimp, farm raised, raw | Review required: profile_review_only, low_target_token_coverage_33. |
| usda:survey fndds:2708964:prepared common | edit_needed | Sushi roll, shrimp | Review required: profile_review_only, low_target_token_coverage_67. |
| usda:foundation:2514746:prepared common | edit_needed | Chicken, ground, with additives, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:foundation:2727573:prepared common | edit_needed | Beef, tenderloin steak, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:survey fndds:2706395:prepared common | edit_needed | Meatballs, Puerto Rican style | Review required: profile_review_only, luke_overlay_review_required. |
| usda:survey fndds:2708758:prepared common | edit_needed | Lasagna, meatless | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:169857:prepared common | edit_needed | CARRABBA'S ITALIAN GRILL, chicken parmesan without cavatappi pasta | Review required: profile_review_only, brand_like_name_token_review_required, luke_overlay_review_required. |
| usda:survey fndds:2706470:prepared common | edit_needed | Spaghetti sauce with meat | Review required: profile_review_only, composite_target_review_required, luke_overlay_review_required. |
| usda:foundation:2514747:prepared common | rejected | Turkey, ground, 93% lean/ 7% fat, raw | Rejected by risk engine: profile_review_only, low_target_token_coverage_50, duplicate_existing_product. |
| usda:survey fndds:2709242:prepared common | edit_needed | Mango, raw | Review required: low_target_token_coverage_33. |
| usda:survey fndds:2710653:prepared common | rejected | Tom Collins | Rejected by risk engine: profile_review_only, low_target_token_coverage_33, macro_sanity_failed. |
| usda:sr legacy:174547:prepared common | edit_needed | CAMPBELL'S, Tomato Soup, condensed | Review required: profile_review_only, low_target_token_coverage_33, brand_like_name_token_review_required, luke_overlay_review_required. |
| usda:survey fndds:2706437:prepared common | edit_needed | Chicken curry | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required. |
| usda:survey fndds:2708804:prepared common | edit_needed | Pad Thai, NFS | Review required: profile_review_only, not_further_specified_review_required, luke_overlay_review_required. |
| usda:sr legacy:174606:prepared common | edit_needed | Sausage, turkey, hot, smoked | Review required: profile_review_only, low_target_token_coverage_67. |
| usda:sr legacy:167671:prepared common | edit_needed | CRACKER BARREL, macaroni n' cheese plate, from kid's menu | Review required: profile_review_only, low_target_token_coverage_50, brand_like_name_token_review_required, context_token_missing_bbq, luke_overlay_review_required. |
| usda:sr legacy:172147:prepared common | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq. |
| usda:sr legacy:171524:prepared common | edit_needed | Chicken, broiler, rotisserie, BBQ, skin | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:168607:prepared common | edit_needed | Beef, brisket, whole, separable lean only, all grades, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:sr legacy:174583:prepared common | edit_needed | Sandwich spread, pork, beef | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required. |
| usda:sr legacy:167559:prepared common | edit_needed | Snacks, tortilla chips, nacho cheese | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:survey fndds:2709307:prepared common | edit_needed | Guacamole, NFS | Review required: profile_review_only, low_target_token_coverage_50, not_further_specified_review_required, context_token_missing_chipotle. |
| usda:survey fndds:2708607:prepared common | edit_needed | Fajita, vegetable | Review required: profile_review_only, low_target_token_coverage_33, context_token_missing_chipotle. |
| usda:sr legacy:170086:prepared common | edit_needed | Beans, pinto, mature seeds, sprouted, raw | Review required: profile_review_only, state_modifier_mismatch_sprouted, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:sr legacy:173734:prepared common | edit_needed | Beans, black, mature seeds, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:foundation:2512380:prepared common | edit_needed | Rice, brown, long grain, unenriched, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:foundation:2512381:prepared common | edit_needed | Rice, white, long grain, unenriched, raw | Review required: profile_review_only, low_target_token_coverage_67, context_token_missing_chipotle. |
| usda:survey fndds:2705864:prepared common | edit_needed | Pork, carnitas | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_chipotle, luke_overlay_review_required. |
| usda:sr legacy:173180:proteins | edit_needed | Beverages, Protein powder whey based | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:172183:proteins | rejected | Egg, white, raw, fresh | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2707152:proteins | rejected | Egg, whole, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2705431:proteins | rejected | Yogurt, Greek, low fat milk, fruit | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:330137:proteins | rejected | Yogurt, Greek, plain, nonfat | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:328841:proteins | rejected | Cheese, cottage, lowfat, 2% milkfat | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:172461:proteins | edit_needed | MORI-NU, Tofu, silken, firm | Review required: brand_like_name_token_review_required, branded_restaurant_or_alcohol_review_required. |
| usda:sr legacy:168250:proteins | rejected | Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:169458:proteins | rejected | Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2514747:proteins | rejected | Turkey, ground, 93% lean/ 7% fat, raw | Rejected by risk engine: profile_review_only, low_target_token_coverage_50, duplicate_existing_product. |
| usda:sr legacy:174032:proteins | rejected | Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:331960:proteins | rejected | Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:746780:proteins | rejected | Sausage, Italian, pork, mild, cooked, pan-fried | Rejected by risk engine: duplicate_existing_product, prepared_dish_mismatch_risk. |
| usda:sr legacy:171506:proteins | rejected | Turkey, Ground, cooked | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173423:proteins | edit_needed | Egg, whole, cooked, fried | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:170693:proteins | edit_needed | Fast foods, hamburger; single, regular patty; plain | Review required: state_modifier_mismatch_fast foods. |
| usda:survey fndds:2706167:proteins | edit_needed | Hot dog, beef | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:174612:proteins | edit_needed | Turkey, breast, smoked, lemon pepper flavor, 97% fat-free | Review required: state_modifier_mismatch_flavor. |
| usda:foundation:2727569:proteins | rejected | Chicken, breast, meat and skin, raw | Rejected by risk engine: low_target_token_coverage_67, macro_sanity_failed. |
| usda:sr legacy:172387:proteins | edit_needed | Chicken, broilers or fryers, thigh, meat only, cooked, fried | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:172146:proteins | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised | Review required: low_target_token_coverage_67. |
| usda:sr legacy:173344:proteins | edit_needed | Pulled pork in barbecue sauce | Review required: state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:foundation:2514744:proteins | edit_needed | Beef, ground, 80% lean meat / 20% fat, raw | Review required: context_token_missing_taco. |
| usda:foundation:2514745:proteins | edit_needed | Pork, ground, raw | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:foundation:2727573:proteins | edit_needed | Beef, tenderloin steak, raw | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_barbacoa. |
| usda:survey fndds:2706394:proteins | edit_needed | Steak tartare | Review required: state_modifier_mismatch_tartare. |
| usda:survey fndds:2710726:proteins | rejected | Nutritional drink or shake, high protein, ready-to-drink, NFS | Rejected by risk engine: profile_review_only, not_further_specified_review_required, duplicate_existing_product. |
| usda:sr legacy:168324:proteins | edit_needed | Pork, bacon, rendered fat, cooked | Review required: single_token_secondary_match_review_required. |
| usda:foundation:748967:proteins | rejected | Eggs, Grade A, Large, egg whole | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173722:proteins | edit_needed | Salmon nuggets, cooked as purchased, unheated | Review required: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets. |
| usda:sr legacy:175180:proteins | edit_needed | Crustaceans, shrimp, cooked | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2646175:proteins | rejected | Beef, flank, steak, boneless, choice, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2727574:proteins | rejected | Beef, top sirloin steak, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2646169:proteins | rejected | Pork, loin, tenderloin, boneless, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2706060:proteins | edit_needed | Chicken wing, rotisserie | Review required: state_modifier_mismatch_wing. |
| usda:foundation:2727567:proteins | rejected | Chicken, thigh, meat and skin, raw | Rejected by risk engine: macro_sanity_failed. |
| usda:foundation:2515375:sauces condiments oils | edit_needed | Nuts, hazelnuts or filberts, raw | Review required: profile_review_only, low_target_token_coverage_33. |
| usda:survey fndds:2707537:sauces condiments oils | rejected | Peanut butter | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:169661:sauces condiments oils | rejected | Syrups, maple | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2710281:sauces condiments oils | rejected | Honey | Rejected by risk engine: low_target_token_coverage_50, duplicate_existing_product. |
| usda:sr legacy:169640:sauces condiments oils | rejected | Honey | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2710825:sauces condiments oils | edit_needed | Rice, black, unenriched, raw | Review required: low_target_token_coverage_50. |
| usda:sr legacy:171186:sauces condiments oils | edit_needed | Sauce, hot chile, sriracha | Review required: state_modifier_mismatch_sauce, single_token_secondary_match_review_required, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:172886:sauces condiments oils | edit_needed | Sauce, hoisin, ready-to-serve | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:survey fndds:2707442:sauces condiments oils | edit_needed | Soy sauce | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:survey fndds:2706457:sauces condiments oils | edit_needed | Fish sauce | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:survey fndds:2710156:sauces condiments oils | rejected | Butter, tub | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2710175:sauces condiments oils | edit_needed | Pesto sauce | Review required: profile_review_only, state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:172240:sauces condiments oils | rejected | Vinegar, red wine | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:172241:sauces condiments oils | rejected | Vinegar, balsamic | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2710260:sauces condiments oils | rejected | Sugar, brown | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:171575:sauces condiments oils | edit_needed | Sauce, peanut, made from coconut, water, sugar, peanuts | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:foundation:2747653:sauces condiments oils | edit_needed | Beet greens, raw | Review required: profile_review_only, low_target_token_coverage_33, state_modifier_mismatch_greens. |
| usda:foundation:2346408:sauces condiments oils | edit_needed | Cabbage, red, raw | Review required: profile_review_only, low_target_token_coverage_33. |
| usda:survey fndds:2710169:sauces condiments oils | edit_needed | Garlic sauce | Review required: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:171016:sauces condiments oils | edit_needed | Oil, sesame, salad or cooking | Review required: state_modifier_mismatch_salad. |
| usda:survey fndds:2710182:sauces condiments oils | rejected | Coconut oil | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173469:sauces condiments oils | edit_needed | Vinegar, cider | Review required: low_target_token_coverage_67. |
| usda:survey fndds:2709744:sauces condiments oils | edit_needed | Hot Thai sauce | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:167695:sauces condiments oils | edit_needed | Mayonnaise, made with tofu | Review required: state_modifier_mismatch_tofu. |
| usda:foundation:746777:sauces condiments oils | edit_needed | Sauce, salsa, ready-to-serve | Review required: profile_review_only, low_target_token_coverage_50, context_token_missing_bbq, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:174523:sauces condiments oils | edit_needed | Sauce, barbecue | Review required: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:168156:sauces condiments oils | rejected | Lime juice, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:174278:sauces condiments oils | edit_needed | Soy sauce made from soy (tamari) | Review required: prepared_dish_mismatch_risk. |
| usda:foundation:330458:sauces condiments oils | rejected | Oil, coconut | Rejected by risk engine: duplicate_existing_product. |
| usda:survey fndds:2710186:sauces condiments oils | rejected | Olive oil | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173032:whole foods | rejected | Goji berries, dried | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168816:whole foods | rejected | Fruit butters, apple | Rejected by risk engine: single_token_secondary_match_review_required, duplicate_existing_product. |
| usda:foundation:1105314:whole foods | rejected | Bananas, ripe and slightly ripe, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2346411:whole foods | rejected | Blueberries, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2346409:whole foods | rejected | Strawberries, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:169231:whole foods | rejected | Ginger root, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:1104647:whole foods | rejected | Garlic, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:170006:whole foods | rejected | Onions, young green, tops only | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2747661:whole foods | edit_needed | Peppers, jalapeno, seeded, raw | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2747665:whole foods | edit_needed | Radishes, red, raw | Review required: low_target_token_coverage_50. |
| usda:foundation:2346406:whole foods | rejected | Cucumber, with peel, raw | Rejected by risk engine: state_modifier_mismatch_peel, duplicate_existing_product. |
| usda:survey fndds:2709170:whole foods | rejected | Lime, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2685575:whole foods | rejected | Brussels sprouts, raw | Rejected by risk engine: low_target_token_coverage_50, duplicate_existing_product. |
| usda:survey fndds:2708805:whole foods | edit_needed | Pad Thai, meatless | Review required: low_target_token_coverage_50. |
| usda:sr legacy:169997:whole foods | rejected | Coriander (cilantro) leaves, raw | Rejected by risk engine: single_token_secondary_match_review_required, duplicate_existing_product. |
| usda:survey fndds:2710643:whole foods | rejected | Mint julep | Rejected by risk engine: macro_sanity_failed, branded_restaurant_or_alcohol_review_required. |
| usda:survey fndds:2710104:whole foods | edit_needed | Zucchini, pickled | Review required: state_modifier_mismatch_pickled. |
| usda:sr legacy:168422:whole foods | edit_needed | Mushrooms, Chanterelle, raw | Review required: generic_mushroom_subtype_review_required. |
| usda:sr legacy:171328:whole foods | edit_needed | Spices, oregano, dried | Review required: state_modifier_mismatch_dried, single_token_secondary_match_review_required. |
| usda:survey fndds:2709780:whole foods | rejected | Basil, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:1104962:whole foods | rejected | Onions, white, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2685582:whole foods | edit_needed | Tomato, puree, canned | Review required: profile_review_only, low_target_token_coverage_50. |
| usda:foundation:321360:whole foods | rejected | Tomatoes, grape, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:171184:whole foods | edit_needed | SMART SOUP, Vietnamese Carrot Lemongrass | Review required: single_token_secondary_match_review_required, brand_like_name_token_review_required, luke_overlay_review_required. |
| usda:survey fndds:2709782:whole foods | rejected | Cilantro, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168561:whole foods | edit_needed | Pickle relish, sweet | Review required: state_modifier_mismatch_relish. |
| usda:survey fndds:2709223:whole foods | rejected | Avocado, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:790577:whole foods | rejected | Onions, red, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168156:whole foods | rejected | Lime juice, raw | Rejected by risk engine: state_modifier_mismatch_juice, duplicate_existing_product. |
| usda:survey fndds:2709215:whole foods | rejected | Apple, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:173263:whole foods | edit_needed | Rice, brown, parboiled, cooked, UNCLE BENS | Review required: brand_like_name_token_review_required. |
| usda:sr legacy:170086:whole foods | edit_needed | Beans, pinto, mature seeds, sprouted, raw | Review required: state_modifier_mismatch_sprouted. |
| usda:sr legacy:173734:whole foods | rejected | Beans, black, mature seeds, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:foundation:2685568:whole foods | edit_needed | Squash, summer, green, zucchini, includes skin, raw | Review required: single_token_secondary_match_review_required. |
| usda:foundation:747447:whole foods | rejected | Broccoli, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168766:whole foods | edit_needed | Candies, NESTLE, AFTER EIGHT Mints | Review required: single_token_secondary_match_review_required, brand_like_name_token_review_required. |
| usda:foundation:2258590:whole foods | rejected | Peppers, bell, red, raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:168573:whole foods | rejected | Lemon grass (citronella), raw | Rejected by risk engine: duplicate_existing_product. |
| usda:sr legacy:169103:whole foods | edit_needed | Orange peel, raw | Review required: state_modifier_mismatch_peel. |

## Candidate Detail

## beverages

### REBBL drink -> Energy Drink

- candidate_key: `usda:survey fndds:2710756:beverages`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2710756
- macros: 43 cal, 0.46P, 10.23C, 0F
- units: can or bottle 12 fl oz=372g, can or bottle 16 fl oz=496g, can or bottle 24 fl oz=744g, can or bottle 32 fl oz=992g, can or bottle 8 fl oz=248g, cup=248g, fl oz=31g, g=1g
- aliases: rebbl drink, rebbl drinks, energy drink, energy drinks
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T06:43:50.627+00:00

### green tea -> Beverages, tea, green, brewed, regular

- candidate_key: `usda:sr legacy:171917:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 171917
- macros: 1 cal, 0.22P, 0C, 0F
- units: cup=245g, fl oz=29.6g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: green tea, beverages tea green brewed regular, beverages tea green brewed regulars
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:50.333+00:00

### half and half -> Cream, fluid, half and half

- candidate_key: `usda:sr legacy:171255:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 171255
- macros: 131 cal, 3.13P, 4.3C, 11.5F
- units: container individual 5 fl oz=15g, cup=242g, fl oz=30.2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: half and half, half and halfs, cream fluid half and half, cream fluid half and halfs
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:50.095+00:00

### coffee with half and half -> Beverages, coffee, instant, regular, half the caffeine

- candidate_key: `usda:sr legacy:174126:beverages`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 174126
- macros: 352 cal, 14.4P, 73.2C, 0.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet=2g, tsp=1g
- aliases: coffee with half and half, coffee with half and halfs, beverages coffee instant regular half the caffeine, beverages coffee instant regular half the caffeines
- rejected_aliases: none
- risk: 25
- reasons: composite_target_review_required
- updated_at: 2026-05-16T06:43:49.836+00:00

### coffee black -> Plum, black, with skin, raw

- candidate_key: `usda:foundation:2710837:beverages`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 2710837
- macros: 52.7 cal, 0.58P, 13.5C, 0.28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: coffee black, coffee blacks, plum black with skin raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:43:49.6+00:00

### almond milk unsweetened -> Almond milk, unsweetened, plain, shelf stable

- candidate_key: `usda:foundation:1999631:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 1999631
- macros: 14.6 cal, 0.56P, 0.34C, 1.22F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: almond milk unsweetened, almond milk unsweeteneds, almond milk unsweetened plain shelf stable, almond milk unsweetened plain shelf stables
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:49.38+00:00

### chocolate soy milk -> Soy milk, chocolate

- candidate_key: `usda:survey fndds:2705406:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2705406
- macros: 64 cal, 3.35P, 8.32C, 2.03F
- units: cup=244g, fl oz=30.5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chocolate soy milk, chocolate soy milks, soy milk chocolate, soy milk chocolates
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:49.1+00:00

### coconut juice -> Oil, coconut

- candidate_key: `usda:foundation:330458:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 330458
- macros: 833 cal, 0P, 0.84C, 99.1F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=11.6g
- aliases: coconut juice, coconut juices, oil coconut, oil coconuts
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:43:48.882+00:00

### coconut water -> Nuts, coconut water (liquid from coconuts)

- candidate_key: `usda:sr legacy:170174:beverages`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 170174
- macros: 19 cal, 0.72P, 3.71C, 0.2F
- units: coconut yields=206g, cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: coconut water, coconut waters, nuts coconut water liquid from coconuts, nuts coconut water liquid from coconut
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:48.691+00:00

### thai iced tea -> Beverages, tea, Oolong, brewed

- candidate_key: `usda:sr legacy:174120:beverages`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 174120
- macros: 1 cal, 0P, 0.15C, 0F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: thai iced tea, beverages tea oolong brewed, beverages tea oolong breweds
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_33
- updated_at: 2026-05-16T06:05:47.742+00:00

### margarita on the rocks -> Margarita

- candidate_key: `usda:survey fndds:2710638:beverages`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2710638
- macros: 122 cal, 0.08P, 16.06C, 0.08F
- units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: margarita on the rocks, margarita on the rock, margarita, margaritas
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_33, macro_sanity_failed, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required
- updated_at: 2026-05-16T04:24:23.246+00:00

## breakfast_snacks

### cereal oat bran -> Cereals ready-to-eat, QUAKER, MOTHER'S Toasted Oat Bran cereal

- candidate_key: `usda:sr legacy:172986:breakfast snacks`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 172986
- macros: 372 cal, 11.4P, 75.4C, 5.04F
- units: cup 1 nlea serving=42.67g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cereal oat bran, cereal oat brans, cereals ready to eat quaker mothers toasted oat bran cereal, cereals ready to eat quaker mothers toasted oat bran cereals
- rejected_aliases: none
- risk: 20
- reasons: brand_like_name_token_review_required
- updated_at: 2026-05-16T06:43:48.461+00:00

### Greek yogurt bar -> Yogurt, Greek, plain, nonfat

- candidate_key: `usda:foundation:330137:breakfast snacks`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 330137
- macros: 61 cal, 10.3P, 3.64C, 0.37F
- units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: greek yogurt bar, yogurt greek plain nonfat, yogurt greek plain nonfats
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_67, duplicate_existing_product
- updated_at: 2026-05-16T06:43:47.99+00:00

### ice cream bar low calorie -> Ice cream candy bar

- candidate_key: `usda:survey fndds:2705640:breakfast snacks`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2705640
- macros: 323 cal, 4.4P, 30.9C, 20.2F
- units: bar=50g, g=1g, kg=1000g, lb=453.59g, miniature snicker bar 1 fl oz=25g, oz=28.35g, snickers bar 2 fl oz=50g
- aliases: ice cream bar low calorie, ice cream bar low calories, ice cream candy bar
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only
- updated_at: 2026-05-16T06:43:47.677+00:00

### applesauce unsweetened -> Applesauce, unsweetened

- candidate_key: `usda:survey fndds:2709217:breakfast snacks`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2709217
- macros: 52 cal, 0.27P, 12.26C, 0.16F
- units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, pouch=90g, snack size container=113g
- aliases: applesauce unsweetened, applesauce unsweeteneds
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:43:47.439+00:00

### Magic Spoon cereal -> Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size

- candidate_key: `usda:sr legacy:167715:breakfast snacks`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 167715
- macros: 339 cal, 10.9P, 80.6C, 2.06F
- units: cup 1 nlea serving=47.2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: magic spoon cereal, magic spoon cereals, cereals ready to eat post shredded wheat n bran spoon size, cereals ready to eat post shredded wheat n bran spoon sizes
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, duplicate_existing_product
- updated_at: 2026-05-16T06:43:47.138+00:00

### Cracklin Oat Bran -> Oat bran, raw

- candidate_key: `usda:sr legacy:168872:breakfast snacks`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 168872
- macros: 246 cal, 17.3P, 66.2C, 7.03F
- units: cup=94g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cracklin oat bran, cracklin oat brans, oat bran raw
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_67, macro_sanity_failed
- updated_at: 2026-05-16T06:43:46.934+00:00

### Kashi cereal -> Cereal or granola bar (Kashi Chewy)

- candidate_key: `usda:survey fndds:2708088:breakfast snacks`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2708088
- macros: 390 cal, 16.67P, 63.42C, 7.69F
- units: bar=78g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: kashi cereal, kashi cereals, cereal or granola bar kashi chewy, cereal or granola bar kashi chewys
- rejected_aliases: none
- risk: 70
- reasons: profile_review_only, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required
- updated_at: 2026-05-16T06:43:46.666+00:00

### granola -> Snacks, granola bars, hard, plain

- candidate_key: `usda:sr legacy:167542:breakfast snacks`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 167542
- macros: 471 cal, 10.1P, 64.4C, 19.8F
- units: bar=21g, bar 1 oz=28g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: granola, granolas, snacks granola bars hard plain, snacks granola bars hard plains
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T06:43:46.434+00:00

### rolled oats -> Oats, whole grain, rolled, old fashioned

- candidate_key: `usda:foundation:2346396:breakfast snacks`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 2346396
- macros: 379 cal, 13.5P, 68.7C, 5.89F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rolled oats, rolled oatss, oats whole grain rolled old fashioned, oats whole grain rolled old fashioneds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:45.897+00:00

### goji berries dried -> Goji berries, dried

- candidate_key: `usda:sr legacy:173032:breakfast snacks`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / SR Legacy / 173032
- macros: 349 cal, 14.3P, 77.1C, 0.39F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=5.6g
- aliases: goji berries dried, goji berries drieds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:18:16.926+00:00

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

### low fat cottage cheese -> Cheese, cottage, lowfat, 2% milkfat

- candidate_key: `usda:foundation:328841:breakfast snacks`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 328841
- macros: 84 cal, 11P, 4.31C, 2.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: low fat cottage cheese, low fat cottage cheeses, cheese cottage lowfat 2 milkfat, cheese cottage lowfat 2 milkfats
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:18:16.266+00:00

### applesauce -> Applesauce, unsweetened, with added vitamin C

- candidate_key: `usda:foundation:2346414:breakfast snacks`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 2346414
- macros: 46.4 cal, 0.27P, 12.3C, 0.16F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: applesauce, applesauces, applesauce unsweetened with added vitamin c
- rejected_aliases: none
- risk: 100
- reasons: state_modifier_mismatch_sweetened, duplicate_existing_product, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:18:16.041+00:00

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

### protein oats -> Oats, whole grain, steel cut

- candidate_key: `usda:foundation:2346397:breakfast snacks`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 2346397
- macros: 379 cal, 12.5P, 69.8C, 5.8F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: protein oats, protein oatss, oats whole grain steel cut
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T04:18:14.735+00:00

## coverage_buffer

### cottage cheese bowl -> Cheese, cottage, lowfat, 2% milkfat

- candidate_key: `usda:foundation:328841:coverage buffer`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 328841
- macros: 84 cal, 11P, 4.31C, 2.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cottage cheese bowl, cottage cheese bowls, cheese cottage lowfat 2 milkfat, cheese cottage lowfat 2 milkfats
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_67, duplicate_existing_product
- updated_at: 2026-05-16T06:43:51.905+00:00

### protein shake dextrose -> Nutritional drink or shake, high protein, ready-to-drink, NFS

- candidate_key: `usda:survey fndds:2710726:coverage buffer`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2710726
- macros: 61 cal, 6.59P, 0.85C, 3.38F
- units: bottle 14 fl oz myoplex=448g, bottle 20 fl oz monster milk=640g, bottle or box nfs=544g, cup=256g, fl oz=32g, g=1g, kg=1000g, lb=453.59g
- aliases: protein shake dextrose, protein shake dextroses, nutritional drink or shake high protein ready to drink nfs
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67, not_further_specified_review_required
- updated_at: 2026-05-16T06:43:51.692+00:00

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

### rice paper wrapper -> Rice, black, unenriched, raw

- candidate_key: `usda:foundation:2710825:cuisine staples`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2710825
- macros: 361 cal, 7.57P, 77.2C, 3.44F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, wrapper=22g
- aliases: rice paper wrapper, rice paper wrappers, rice black unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- updated_at: 2026-05-16T06:37:47.892+00:00

### white rice cooked -> Rice, white, cooked, glutinous

- candidate_key: `usda:survey fndds:2708422:cuisine staples`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2708422
- macros: 96 cal, 2.01P, 20.97C, 0.19F
- units: cup cooked=174g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: white rice cooked, white rice cookeds, rice white cooked glutinous, rice white cooked glutinou
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:47.485+00:00

### jasmine rice cooked -> Rice noodles, cooked

- candidate_key: `usda:sr legacy:168914:cuisine staples`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 168914
- macros: 108 cal, 1.79P, 24C, 0.2F
- units: cup=176g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: jasmine rice cooked, jasmine rice cookeds, rice noodles cooked, rice noodles cookeds
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:37:47.149+00:00

### mozzarella cheese -> Mozzarella cheese, tomato, and basil, with oil and vinegar dressing

- candidate_key: `usda:survey fndds:2705818:cuisine staples`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2705818
- macros: 139 cal, 7.17P, 3.86C, 10.87F
- units: cup=160g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: mozzarella cheese, mozzarella cheeses, mozzarella cheese tomato and basil with oil and vinegar dressing, mozzarella cheese tomato and basil with oil and vinegar dressings
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:34.725+00:00

### parmesan cheese -> Cheese, parmesan, grated

- candidate_key: `usda:foundation:325036:cuisine staples`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 325036
- macros: 421 cal, 29.6P, 12.4C, 28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: parmesan cheese, parmesan cheeses, cheese parmesan grated, cheese parmesan grateds
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, duplicate_existing_product, luke_overlay_review_required
- updated_at: 2026-05-16T06:26:32.578+00:00

### marinara sauce -> Sauce, pasta, spaghetti/marinara, ready-to-serve

- candidate_key: `usda:foundation:332282:cuisine staples`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 332282
- macros: 45 cal, 1.41P, 8.05C, 1.48F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: marinara sauce, marinara sauces, sauce pasta spaghetti marinara ready to serve, sauce pasta spaghetti marinara ready to serves
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:26:31.132+00:00

### tomato sauce -> Tomato chili sauce

- candidate_key: `usda:survey fndds:2709735:cuisine staples`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2709735
- macros: 92 cal, 2.5P, 19.79C, 0.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- aliases: tomato sauce, tomato sauces, tomato chili sauce, tomato chili sauces
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:26:28.742+00:00

### lasagna noodles cooked -> Noodles, cooked

- candidate_key: `usda:survey fndds:2708352:cuisine staples`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2708352
- macros: 137 cal, 4.51P, 25.01C, 2.06F
- units: cup cooked=160g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz dry yields=75g
- aliases: lasagna noodles cooked, lasagna noodles cookeds, noodles cooked, noodles cookeds
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:26:27.243+00:00

### penne pasta cooked -> Pasta, cooked

- candidate_key: `usda:survey fndds:2708357:cuisine staples`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2708357
- macros: 157 cal, 5.76P, 30.68C, 0.92F
- units: cup cooked=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz dry yields=80g
- aliases: penne pasta cooked, penne pasta cookeds, pasta cooked, pasta cookeds
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:26:26.842+00:00

### spaghetti cooked -> Spaghetti, spinach, cooked

- candidate_key: `usda:sr legacy:168912:cuisine staples`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 168912
- macros: 130 cal, 4.58P, 26.2C, 0.63F
- units: cup=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: spaghetti cooked, spaghetti cookeds, spaghetti spinach cooked, spaghetti spinach cookeds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_spinach
- updated_at: 2026-05-16T06:26:26.287+00:00

### water chestnuts -> Nuts, chestnuts, chinese, raw

- candidate_key: `usda:sr legacy:170164:cuisine staples`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 170164
- macros: 224 cal, 4.2P, 49.1C, 1.11F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: water chestnuts, water chestnut, nuts chestnuts chinese raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:05:46.185+00:00

### cashews -> Cashews, NFS

- candidate_key: `usda:survey fndds:2707493:cuisine staples`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2707493
- macros: 574 cal, 15.31P, 32.69C, 46.35F
- units: cup=130g, g=1g, kg=1000g, lb=453.59g, nut=1.5g, oz=28.35g, package=50g
- aliases: cashews, cashew, cashews nfs
- rejected_aliases: none
- risk: 20
- reasons: not_further_specified_review_required
- updated_at: 2026-05-16T06:05:45.943+00:00

### peanuts -> Peanuts, raw

- candidate_key: `usda:foundation:2515376:cuisine staples`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Foundation / 2515376
- macros: 551 cal, 23.2P, 26.5C, 43.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: peanuts, peanut, peanuts raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:05:45.828+00:00

### sticky rice cooked -> Rice, cooked, NFS

- candidate_key: `usda:survey fndds:2708402:cuisine staples`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2708402
- macros: 129 cal, 2.67P, 27.99C, 0.28F
- units: cup cooked=158g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: sticky rice cooked, sticky rice cookeds, rice cooked nfs
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50, not_further_specified_review_required
- updated_at: 2026-05-16T06:05:45.472+00:00

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

### pinto beans cooked -> Beans, pinto, mature seeds, cooked, boiled, with salt

- candidate_key: `usda:sr legacy:173796:cuisine staples`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 173796
- macros: 143 cal, 9.01P, 26.2C, 0.65F
- units: cup=171g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pinto beans cooked, pinto beans cookeds, beans pinto mature seeds cooked boiled with salt, beans pinto mature seeds cooked boiled with salts
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:20.965+00:00

### black beans cooked -> Beans, black, mature seeds, cooked, boiled, with salt

- candidate_key: `usda:sr legacy:175237:cuisine staples`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 175237
- macros: 132 cal, 8.86P, 23.7C, 0.54F
- units: cup=172g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: black beans cooked, black beans cookeds, beans black mature seeds cooked boiled with salt, beans black mature seeds cooked boiled with salts
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:20.738+00:00

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

### pico de gallo -> Dulce de Leche

- candidate_key: `usda:sr legacy:173461:cuisine staples`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 173461
- macros: 315 cal, 6.84P, 55.4C, 7.35F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=19g
- aliases: pico de gallo, pico de gallos, dulce de leche, dulce de leches
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_0, context_token_missing_pico, context_token_missing_gallo, duplicate_existing_product
- updated_at: 2026-05-16T04:24:19.736+00:00

### salsa -> Dip, TOSTITOS, salsa con queso, medium

- candidate_key: `usda:sr legacy:174069:cuisine staples`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 174069
- macros: 133 cal, 2.92P, 11.7C, 8.26F
- units: cup=250g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- aliases: salsa, salsas, dip tostitos salsa con queso medium, dip tostitos salsa con queso mediums
- rejected_aliases: none
- risk: 100
- reasons: single_token_secondary_match_review_required, brand_like_name_token_review_required, duplicate_existing_product, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T04:24:19.513+00:00

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

### tortilla chips -> Tortilla chips, plain

- candidate_key: `usda:survey fndds:2708202:cuisine staples`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2708202
- macros: 472 cal, 7.1P, 67.78C, 20.68F
- units: 100 calorie package=20g, chip=3g, cup=30g, g=1g, kg=1000g, large single serving bag=85g, lb=453.59g, medium single serving bag=57g
- aliases: tortilla chips, tortilla chip, tortilla chips plain, tortilla chips plains
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:18.883+00:00

### tomato paste -> Tomato, paste, canned, without salt added

- candidate_key: `usda:foundation:2685580:cuisine staples`
- decision: rejected
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / Foundation / 2685580
- macros: 88.5 cal, 4.23P, 20.2C, 0.73F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tomato paste, tomato pastes, tomato paste canned without salt added, tomato paste canned without salt addeds
- rejected_aliases: none
- risk: 100
- reasons: state_modifier_mismatch_canned, duplicate_existing_product
- updated_at: 2026-05-16T03:26:24.168+00:00

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

### nuoc cham -> Willow, leaves in oil (Alaska Native)

- candidate_key: `usda:sr legacy:168035:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 168035
- macros: 592 cal, 2.6P, 8.1C, 61F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: nuoc cham, nuoc chams, willow leaves in oil alaska native, willow leaves in oil alaska natives
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_0
- updated_at: 2026-05-16T06:37:54.297+00:00

### vermicelli bowl chicken -> Burrito bowl, chicken

- candidate_key: `usda:survey fndds:2708560:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2708560
- macros: 161 cal, 21.04P, 0.27C, 8.11F
- units: cup=120g, g=1g, item any size=225g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: vermicelli bowl chicken, vermicelli bowl chickens, burrito bowl chicken, burrito bowl chickens
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67
- updated_at: 2026-05-16T06:37:53.988+00:00

### summer roll shrimp -> Crustaceans, shrimp, farm raised, raw

- candidate_key: `usda:foundation:2684443:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2684443
- macros: 75.7 cal, 15.6P, 0.49C, 0.8F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, roll=85g
- aliases: summer roll shrimp, summer roll shrimps, crustaceans shrimp farm raised raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_33
- updated_at: 2026-05-16T06:37:53.713+00:00

### spring roll shrimp -> Sushi roll, shrimp

- candidate_key: `usda:survey fndds:2708964:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2708964
- macros: 100 cal, 7.01P, 15.67C, 0.55F
- units: cup=150g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=30g, roll=85g
- aliases: spring roll shrimp, spring roll shrimps, sushi roll shrimp, sushi roll shrimps
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_67
- updated_at: 2026-05-16T06:37:53.502+00:00

### banh mi chicken -> Chicken, ground, with additives, raw

- candidate_key: `usda:foundation:2514746:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2514746
- macros: 138 cal, 17.9P, 0C, 7.16F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: banh mi chicken, banh mi chickens, chicken ground with additives raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T06:37:53.281+00:00

### pho beef -> Beef, tenderloin steak, raw

- candidate_key: `usda:foundation:2727573:prepared common`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2727573
- macros: 149 cal, 21.1P, 0.18C, 6.46F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pho beef, pho beefs, beef tenderloin steak raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T06:37:53.006+00:00

### meatballs -> Meatballs, Puerto Rican style

- candidate_key: `usda:survey fndds:2706395:prepared common`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2706395
- macros: 225 cal, 14.33P, 6.9C, 15.31F
- units: g=1g, kg=1000g, lb=453.59g, meatball=28g, meatball with sauce=50g, oz=28.35g
- aliases: meatballs, meatball, meatballs puerto rican style, meatballs puerto rican styles
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T06:26:44.051+00:00

### lasagna -> Lasagna, meatless

- candidate_key: `usda:survey fndds:2708758:prepared common`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2708758
- macros: 130 cal, 6.54P, 13.84C, 5.33F
- units: cup=250g, g=1g, kg=1000g, lasagna 7 x 12=2048g, lasagna 8 square=1360g, lb=453.59g, oz=28.35g, piece 1 6 of 8 square approx 2 1 2 x 4=227g
- aliases: lasagna, lasagnas, lasagna meatless, lasagna meatles
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T06:26:41.576+00:00

### chicken parmesan -> CARRABBA'S ITALIAN GRILL, chicken parmesan without cavatappi pasta

- candidate_key: `usda:sr legacy:169857:prepared common`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 169857
- macros: 206 cal, 19P, 7.8C, 11F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=339g
- aliases: chicken parmesan, chicken parmesans, carrabbas italian grill chicken parmesan without cavatappi pasta, carrabbas italian grill chicken parmesan without cavatappi pastas
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, brand_like_name_token_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T06:26:41.243+00:00

### spaghetti with meat sauce -> Spaghetti sauce with meat

- candidate_key: `usda:survey fndds:2706470:prepared common`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2706470
- macros: 90 cal, 5.94P, 6.54C, 4.36F
- units: cup=260g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: spaghetti with meat sauce, spaghetti with meat sauces, spaghetti sauce with meat, spaghetti sauce with meats
- rejected_aliases: none
- risk: 70
- reasons: profile_review_only, composite_target_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T06:26:41.004+00:00

### turkey bolognese -> Turkey, ground, 93% lean/ 7% fat, raw

- candidate_key: `usda:foundation:2514747:prepared common`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 2514747
- macros: 158 cal, 17.3P, 0C, 9.59F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: turkey bolognese, turkey bologneses, turkey ground 93 lean 7 fat raw
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:26:40.744+00:00

### mango sticky rice -> Mango, raw

- candidate_key: `usda:survey fndds:2709242:prepared common`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2709242
- macros: 60 cal, 0.82P, 14.98C, 0.38F
- units: cup=165g, g=1g, kg=1000g, lb=453.59g, mango=210g, oz=28.35g, slice chunk=25g
- aliases: mango sticky rice, mango sticky rices, mango raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- updated_at: 2026-05-16T06:05:48.624+00:00

### tom kha soup -> Tom Collins

- candidate_key: `usda:survey fndds:2710653:prepared common`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2710653
- macros: 123 cal, 0.08P, 16.11C, 0.08F
- units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tom kha soup, tom kha soups, tom collins, tom collin
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_33, macro_sanity_failed
- updated_at: 2026-05-16T06:05:48.507+00:00

### tom yum soup -> CAMPBELL'S, Tomato Soup, condensed

- candidate_key: `usda:sr legacy:174547:prepared common`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 174547
- macros: 71 cal, 1.46P, 15.2C, 0.44F
- units: cup condensed=248g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tom yum soup, tom yum soups, campbells tomato soup condensed, campbells tomato soup condenseds
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_33, brand_like_name_token_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T06:05:48.386+00:00

### red curry chicken -> Chicken curry

- candidate_key: `usda:survey fndds:2706437:prepared common`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2706437
- macros: 107 cal, 6.48P, 6.54C, 6.48F
- units: cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: red curry chicken, red curry chickens, chicken curry, chicken currys
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required
- updated_at: 2026-05-16T06:05:48.112+00:00

### pad thai -> Pad Thai, NFS

- candidate_key: `usda:survey fndds:2708804:prepared common`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2708804
- macros: 154 cal, 8.13P, 14.36C, 7.5F
- units: cup=200g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pad thai, pad thais, pad thai nfs
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, not_further_specified_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T06:05:47.864+00:00

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

## proteins

### whey protein powder -> Beverages, Protein powder whey based

- candidate_key: `usda:sr legacy:173180:proteins`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 173180
- macros: 352 cal, 78.1P, 6.25C, 1.56F
- units: cup=96.97g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: whey protein powder, whey protein powders, beverages protein powder whey based, beverages protein powder whey baseds
- rejected_aliases: none
- risk: 45
- reasons: profile_review_only, luke_overlay_review_required
- updated_at: 2026-05-16T06:43:44.111+00:00

### egg white -> Egg, white, raw, fresh

- candidate_key: `usda:sr legacy:172183:proteins`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 172183
- macros: 52 cal, 10.9P, 0.73C, 0.17F
- units: cup=243g, egg=50g, g=1g, kg=1000g, large=33g, lb=453.59g, oz=28.35g
- aliases: egg white, egg whites, egg white raw fresh, egg white raw freshs
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:43.86+00:00

### whole egg -> Egg, whole, raw

- candidate_key: `usda:survey fndds:2707152:proteins`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2707152
- macros: 143 cal, 12.4P, 0.96C, 9.96F
- units: cup=245g, egg=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: whole egg, egg whole raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:43.595+00:00

### Greek yogurt low fat -> Yogurt, Greek, low fat milk, fruit

- candidate_key: `usda:survey fndds:2705431:proteins`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2705431
- macros: 91 cal, 9.11P, 10.78C, 1.33F
- units: 5 3 oz container=150g, 6 oz container=170g, container nfs=150g, cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: greek yogurt low fat, yogurt greek low fat milk fruit, yogurt greek low fat milk fruits
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:43.324+00:00

### Greek yogurt nonfat -> Yogurt, Greek, plain, nonfat

- candidate_key: `usda:foundation:330137:proteins`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 330137
- macros: 61 cal, 10.3P, 3.64C, 0.37F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: greek yogurt nonfat, greek yogurt nonfats, yogurt greek plain nonfat, yogurt greek plain nonfats
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:43.046+00:00

### cottage cheese nonfat -> Cheese, cottage, lowfat, 2% milkfat

- candidate_key: `usda:foundation:328841:proteins`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 328841
- macros: 84 cal, 11P, 4.31C, 2.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cottage cheese nonfat, cottage cheese nonfats, cheese cottage lowfat 2 milkfat, cheese cottage lowfat 2 milkfats
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:42.774+00:00

### tofu firm -> MORI-NU, Tofu, silken, firm

- candidate_key: `usda:sr legacy:172461:proteins`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 172461
- macros: 62 cal, 6.9P, 2.4C, 2.7F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=84g
- aliases: tofu firm, tofu firms, mori nu tofu silken firm, mori nu tofu silken firms
- rejected_aliases: none
- risk: 45
- reasons: brand_like_name_token_review_required, branded_restaurant_or_alcohol_review_required
- updated_at: 2026-05-16T06:37:46.784+00:00

### pork tenderloin cooked -> Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted

- candidate_key: `usda:sr legacy:168250:proteins`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 168250
- macros: 143 cal, 26.2P, 0C, 3.51F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece cooked excluding refuse yield from 1 lb raw meat with refuse=333g, roast=402g
- aliases: pork tenderloin cooked, pork tenderloin cookeds, pork fresh loin tenderloin separable lean only cooked roasted, pork fresh loin tenderloin separable lean only cooked roasteds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:46.167+00:00

### beef sirloin cooked -> Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled

- candidate_key: `usda:sr legacy:169458:proteins`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 169458
- macros: 219 cal, 29P, 0C, 10.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, steak yield from 532 g raw meat=393g
- aliases: beef sirloin cooked, beef sirloin cookeds, beef top sirloin steak separable lean and fat trimmed to 0 fat choice cooked broiled, beef top sirloin steak separable lean and fat trimmed to 0 fat choice cooked broileds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:45.638+00:00

### turkey meatballs -> Turkey, ground, 93% lean/ 7% fat, raw

- candidate_key: `usda:foundation:2514747:proteins`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 2514747
- macros: 158 cal, 17.3P, 0C, 9.59F
- units: g=1g, kg=1000g, lb=453.59g, meatball=28g, oz=28.35g
- aliases: turkey meatballs, turkey meatball, turkey ground 93 lean 7 fat raw
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:26:19.175+00:00

### lean ground beef cooked -> Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled

- candidate_key: `usda:sr legacy:174032:proteins`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 174032
- macros: 250 cal, 25.9P, 0C, 15.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty yield from 1 4 lb raw meat=77g
- aliases: lean ground beef cooked, lean ground beef cookeds, beef ground 85 lean meat 15 fat patty cooked broiled, beef ground 85 lean meat 15 fat patty cooked broileds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:18.965+00:00

### chicken breast cooked -> Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised

- candidate_key: `usda:foundation:331960:proteins`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 331960
- macros: 166 cal, 32.1P, 0C, 3.24F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=174g
- aliases: chicken breast cooked, chicken breast cookeds, chicken broiler or fryers breast skinless boneless meat only cooked braised, chicken broiler or fryers breast skinless boneless meat only cooked braiseds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:17.044+00:00

### Italian sausage cooked -> Sausage, Italian, pork, mild, cooked, pan-fried

- candidate_key: `usda:foundation:746780:proteins`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 746780
- macros: 322 cal, 18.2P, 2.15C, 26.2F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: italian sausage cooked, italian sausage cookeds, sausage italian pork mild cooked pan fried, sausage italian pork mild cooked pan frieds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:26:15.541+00:00

### ground turkey cooked -> Turkey, Ground, cooked

- candidate_key: `usda:sr legacy:171506:proteins`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 171506
- macros: 203 cal, 27.4P, 0C, 10.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty 4 oz raw yield after cooking=82g, unit yield from 1 lb raw=330g
- aliases: ground turkey cooked, ground turkey cookeds, turkey ground cooked, turkey ground cookeds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:05:45.235+00:00

### egg cooked -> Egg, whole, cooked, fried

- candidate_key: `usda:sr legacy:173423:proteins`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 173423
- macros: 196 cal, 13.6P, 0.83C, 14.8F
- units: egg=50g, g=1g, kg=1000g, large=46g, lb=453.59g, oz=28.35g
- aliases: egg cooked, egg cookeds, egg whole cooked fried, egg whole cooked frieds
- rejected_aliases: none
- risk: 15
- reasons: prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:05:44.959+00:00

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

### grilled chicken breast -> Chicken, breast, meat and skin, raw

- candidate_key: `usda:foundation:2727569:proteins`
- decision: rejected
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / Foundation / 2727569
- macros: 133 cal, 21.4P, -0.43C, 4.78F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: grilled chicken breast, grilled chicken breasts, chicken breast meat and skin raw
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_67, macro_sanity_failed
- updated_at: 2026-05-16T04:34:32.449+00:00

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

### protein shake -> Nutritional drink or shake, high protein, ready-to-drink, NFS

- candidate_key: `usda:survey fndds:2710726:proteins`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Survey (FNDDS) / 2710726
- macros: 61 cal, 6.59P, 0.85C, 3.38F
- units: bottle 14 fl oz myoplex=448g, bottle 20 fl oz monster milk=640g, bottle or box nfs=544g, cup=256g, fl oz=32g, g=1g, kg=1000g, lb=453.59g
- aliases: protein shake, protein shakes, nutritional drink or shake high protein ready to drink nfs
- rejected_aliases: none
- risk: 100
- reasons: profile_review_only, not_further_specified_review_required, duplicate_existing_product
- updated_at: 2026-05-16T04:18:13.574+00:00

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

### whole egg -> Eggs, Grade A, Large, egg whole

- candidate_key: `usda:foundation:748967:proteins`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 748967
- macros: 148 cal, 12.4P, 0.96C, 9.96F
- units: egg=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: whole egg, eggs grade a large egg whole, eggs grade a large egg wholes
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:18:11.484+00:00

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

### flank steak -> Beef, flank, steak, boneless, choice, raw

- candidate_key: `usda:foundation:2646175:proteins`
- decision: rejected
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Foundation / 2646175
- macros: 170 cal, 20.1P, 0C, 9.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: flank steak, flank steaks, beef flank steak boneless choice raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:25:12.983+00:00

### sirloin steak -> Beef, top sirloin steak, raw

- candidate_key: `usda:foundation:2727574:proteins`
- decision: rejected
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Foundation / 2727574
- macros: 146 cal, 22P, 0.22C, 5.71F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: sirloin steak, sirloin steaks, beef top sirloin steak raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:25:12.028+00:00

### pork tenderloin -> Pork, loin, tenderloin, boneless, raw

- candidate_key: `usda:foundation:2646169:proteins`
- decision: rejected
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Foundation / 2646169
- macros: 125 cal, 21.6P, 0C, 3.9F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pork tenderloin, pork tenderloins, pork loin tenderloin boneless raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:25:11.3+00:00

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

### chicken thigh raw -> Chicken, thigh, meat and skin, raw

- candidate_key: `usda:foundation:2727567:proteins`
- decision: rejected
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Foundation / 2727567
- macros: 193 cal, 17.1P, -0.17C, 13.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chicken thigh raw, chicken thigh meat and skin raw
- rejected_aliases: none
- risk: 100
- reasons: macro_sanity_failed
- updated_at: 2026-05-16T03:25:08.491+00:00

## sauces_condiments_oils

### hazelnut stevia drops -> Nuts, hazelnuts or filberts, raw

- candidate_key: `usda:foundation:2515375:sauces condiments oils`
- decision: review_required
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 2515375
- macros: 602 cal, 13.5P, 26.5C, 53.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: hazelnut stevia drops, hazelnut stevia drop, nuts hazelnuts or filberts raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_33
- updated_at: 2026-05-16T06:43:45.632+00:00

### peanut butter -> Peanut butter

- candidate_key: `usda:survey fndds:2707537:sauces condiments oils`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2707537
- macros: 598 cal, 22.21P, 22.31C, 51.36F
- units: g=1g, guideline amount per sandwich=32g, guideline amount per slice of bread roll=16g, kg=1000g, lb=453.59g, oz=28.35g, single serving=45g, tbsp=16g
- aliases: peanut butter, peanut butters
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:45.085+00:00

### maple syrup -> Syrups, maple

- candidate_key: `usda:sr legacy:169661:sauces condiments oils`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 169661
- macros: 260 cal, 0.04P, 67C, 0.06F
- units: cup=315g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving 1 4 cup=83g, tbsp=20g
- aliases: maple syrup, maple syrups, syrups maple, syrups maples
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:44.812+00:00

### manuka honey -> Honey

- candidate_key: `usda:survey fndds:2710281:sauces condiments oils`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Survey (FNDDS) / 2710281
- macros: 304 cal, 0.3P, 82.4C, 0F
- units: cup=320g, g=1g, guideline amount per fl oz of beverage=2.4g, guideline amount per slice of bread roll=10g, kg=1000g, lb=453.59g, oz=28.35g, single serving container=14g
- aliases: manuka honey, manuka honeys, honey, honeys
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:43:44.573+00:00

### honey -> Honey

- candidate_key: `usda:sr legacy:169640:sauces condiments oils`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 169640
- macros: 304 cal, 0.3P, 82.4C, 0F
- units: cup=339g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 0 5 oz=14g, tbsp=21g
- aliases: honey, honeys
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:44.333+00:00

### rice vinegar -> Rice, black, unenriched, raw

- candidate_key: `usda:foundation:2710825:sauces condiments oils`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2710825
- macros: 361 cal, 7.57P, 77.2C, 3.44F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rice vinegar, rice vinegars, rice black unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:37:51.916+00:00

### sriracha -> Sauce, hot chile, sriracha

- candidate_key: `usda:sr legacy:171186:sauces condiments oils`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 171186
- macros: 93 cal, 1.93P, 19.2C, 0.93F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tsp=6.5g
- aliases: sriracha, srirachas, sauce hot chile sriracha, sauce hot chile srirachas
- rejected_aliases: none
- risk: 80
- reasons: state_modifier_mismatch_sauce, single_token_secondary_match_review_required, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:37:51.651+00:00

### hoisin sauce -> Sauce, hoisin, ready-to-serve

- candidate_key: `usda:sr legacy:172886:sauces condiments oils`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 172886
- macros: 220 cal, 3.31P, 44.1C, 3.39F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- aliases: hoisin sauce, hoisin sauces, sauce hoisin ready to serve, sauce hoisin ready to serves
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:37:51.369+00:00

### soy sauce -> Soy sauce

- candidate_key: `usda:survey fndds:2707442:sauces condiments oils`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2707442
- macros: 53 cal, 8.14P, 4.93C, 0.57F
- units: g=1g, guideline amount per piece of sushi=2g, individual packet=9g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- aliases: soy sauce, soy sauces
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:37:51.093+00:00

### fish sauce -> Fish sauce

- candidate_key: `usda:survey fndds:2706457:sauces condiments oils`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2706457
- macros: 35 cal, 5.06P, 3.64C, 0.01F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- aliases: fish sauce, fish sauces
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:37:50.779+00:00

### butter -> Butter, tub

- candidate_key: `usda:survey fndds:2710156:sauces condiments oils`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2710156
- macros: 731 cal, 0.49P, 0C, 78.3F
- units: cup=224g, g=1g, guideline amount on large sandwich=28g, guideline amount on regular sandwich=14g, guideline amount per slice of bread roll=7g, individual container=5g, kg=1000g, lb=453.59g
- aliases: butter, butters, butter tub
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:40.5+00:00

### pesto -> Pesto sauce

- candidate_key: `usda:survey fndds:2710175:sauces condiments oils`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2710175
- macros: 580 cal, 8.61P, 5.67C, 59.17F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- aliases: pesto, pestos, pesto sauce, pesto sauces
- rejected_aliases: none
- risk: 80
- reasons: profile_review_only, state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:26:40.295+00:00

### red wine vinegar -> Vinegar, red wine

- candidate_key: `usda:sr legacy:172240:sauces condiments oils`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 172240
- macros: 19 cal, 0.04P, 0.27C, 0F
- units: cup=239g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14.9g, tsp=5g
- aliases: red wine vinegar, red wine vinegars, vinegar red wine, vinegar red wines
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:40.018+00:00

### balsamic vinegar -> Vinegar, balsamic

- candidate_key: `usda:sr legacy:172241:sauces condiments oils`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 172241
- macros: 88 cal, 0.49P, 17C, 0F
- units: cup=255g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g, tsp=5.3g
- aliases: balsamic vinegar, balsamic vinegars, vinegar balsamic, vinegar balsamics
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:39.685+00:00

### brown sugar -> Sugar, brown

- candidate_key: `usda:survey fndds:2710260:sauces condiments oils`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2710260
- macros: 380 cal, 0.12P, 98.09C, 0F
- units: cup nfs=220g, g=1g, guideline amount per fl oz of beverage=1.4g, kg=1000g, lb=453.59g, oz=28.35g, teaspoon nfs=4.6g
- aliases: brown sugar, brown sugars, sugar brown, sugar browns
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:05:47.618+00:00

### peanut sauce -> Sauce, peanut, made from coconut, water, sugar, peanuts

- candidate_key: `usda:sr legacy:171575:sauces condiments oils`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 171575
- macros: 179 cal, 2.02P, 28.5C, 6.34F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- aliases: peanut sauce, peanut sauces, sauce peanut made from coconut water sugar peanuts, sauce peanut made from coconut water sugar peanut
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:05:47.317+00:00

### green curry paste -> Beet greens, raw

- candidate_key: `usda:foundation:2747653:sauces condiments oils`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Foundation / 2747653
- macros: 26.4 cal, 1.61P, 4.66C, 0.14F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: green curry paste, green curry pastes, beet greens raw
- rejected_aliases: none
- risk: 40
- reasons: profile_review_only, low_target_token_coverage_33, state_modifier_mismatch_greens
- updated_at: 2026-05-16T06:05:47.192+00:00

### red curry paste -> Cabbage, red, raw

- candidate_key: `usda:foundation:2346408:sauces condiments oils`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Foundation / 2346408
- macros: 29.9 cal, 1.24P, 6.79C, 0.21F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: red curry paste, red curry pastes, cabbage red raw
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_33
- updated_at: 2026-05-16T06:05:47.069+00:00

### chili garlic sauce -> Garlic sauce

- candidate_key: `usda:survey fndds:2710169:sauces condiments oils`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2710169
- macros: 683 cal, 1.43P, 2.87C, 74.02F
- units: dipping size container=28g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- aliases: chili garlic sauce, chili garlic sauces, garlic sauce, garlic sauces
- rejected_aliases: none
- risk: 60
- reasons: profile_review_only, low_target_token_coverage_67, luke_overlay_review_required, prepared_dish_mismatch_risk
- updated_at: 2026-05-16T06:05:46.929+00:00

### sesame oil -> Oil, sesame, salad or cooking

- candidate_key: `usda:sr legacy:171016:sauces condiments oils`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 171016
- macros: 884 cal, 0P, 0C, 100F
- units: cup=218g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=13.6g, tsp=4.5g
- aliases: sesame oil, oil sesame salad or cooking, oil sesame salad or cookings
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_salad
- updated_at: 2026-05-16T06:05:46.798+00:00

### coconut oil -> Coconut oil

- candidate_key: `usda:survey fndds:2710182:sauces condiments oils`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2710182
- macros: 895 cal, 0P, 0.84C, 99.1F
- units: cup=224g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14g
- aliases: coconut oil
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:05:46.679+00:00

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

### lime juice -> Lime juice, raw

- candidate_key: `usda:sr legacy:168156:sauces condiments oils`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 168156
- macros: 25 cal, 0.42P, 8.42C, 0.07F
- units: cup=242g, fl oz=30.8g, g=1g, kg=1000g, lb=453.59g, lime yields=44g, oz=28.35g
- aliases: lime juice, lime juices, lime juice raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:22.299+00:00

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

### coconut oil -> Oil, coconut

- candidate_key: `usda:foundation:330458:sauces condiments oils`
- decision: rejected
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / Foundation / 330458
- macros: 833 cal, 0P, 0.84C, 99.1F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=11.6g
- aliases: coconut oil, oil coconut, oil coconuts
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:26:24.645+00:00

### olive oil -> Olive oil

- candidate_key: `usda:survey fndds:2710186:sauces condiments oils`
- decision: rejected
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / Survey (FNDDS) / 2710186
- macros: 900 cal, 0P, 0C, 100F
- units: cup=224g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14g
- aliases: olive oil
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:26:24.42+00:00

## whole_foods

### goji berries dried -> Goji berries, dried

- candidate_key: `usda:sr legacy:173032:whole foods`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 173032
- macros: 349 cal, 14.3P, 77.1C, 0.39F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=5.6g
- aliases: goji berries dried, goji berries drieds
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:42.044+00:00

### apple -> Fruit butters, apple

- candidate_key: `usda:sr legacy:168816:whole foods`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / SR Legacy / 168816
- macros: 173 cal, 0.39P, 42.5C, 0.3F
- units: cup=282g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=17g, tbsp=17g
- aliases: apple, apples, fruit butters apple, fruit butters apples
- rejected_aliases: none
- risk: 100
- reasons: single_token_secondary_match_review_required, duplicate_existing_product
- updated_at: 2026-05-16T06:43:41.85+00:00

### banana -> Bananas, ripe and slightly ripe, raw

- candidate_key: `usda:foundation:1105314:whole foods`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 1105314
- macros: 97 cal, 0.74P, 23C, 0.29F
- units: banana=115g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: banana, bananas, bananas ripe and slightly ripe raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:41.581+00:00

### blueberries -> Blueberries, raw

- candidate_key: `usda:foundation:2346411:whole foods`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 2346411
- macros: 57.4 cal, 0.7P, 14.6C, 0.31F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: blueberries, blueberry, blueberries raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:41.327+00:00

### strawberries -> Strawberries, raw

- candidate_key: `usda:foundation:2346409:whole foods`
- decision: rejected
- run: 501af6a4-8e3e-4e7a-b10c-000cf7dc14e6
- source: usda / Foundation / 2346409
- macros: 32.7 cal, 0.64P, 7.96C, 0.22F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, strawberry=12g
- aliases: strawberries, strawberry, strawberries raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:43:41.123+00:00

### ginger -> Ginger root, raw

- candidate_key: `usda:sr legacy:169231:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 169231
- macros: 80 cal, 1.82P, 17.8C, 0.75F
- units: cup slices 1 dia=96g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, slices 1 dia=2.2g, tsp=2g
- aliases: ginger, gingers, ginger root raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:45.275+00:00

### garlic -> Garlic, raw

- candidate_key: `usda:foundation:1104647:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 1104647
- macros: 143 cal, 6.62P, 28.2C, 0.38F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: garlic, garlics, garlic raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:44.866+00:00

### green onion -> Onions, young green, tops only

- candidate_key: `usda:sr legacy:170006:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 170006
- macros: 27 cal, 0.97P, 5.74C, 0.47F
- units: cup chopped=71g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, stalk=12g, tbsp=6g
- aliases: green onion, green onions, onions young green tops only, onions young green tops onlys
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:44.416+00:00

### jalapeno -> Peppers, jalapeno, seeded, raw

- candidate_key: `usda:foundation:2747661:whole foods`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2747661
- macros: 24.1 cal, 0.62P, 5.08C, 0.15F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: jalapeno, jalapenos, peppers jalapeno seeded raw
- rejected_aliases: none
- risk: 20
- reasons: single_token_secondary_match_review_required
- updated_at: 2026-05-16T06:37:43.267+00:00

### daikon radish -> Radishes, red, raw

- candidate_key: `usda:foundation:2747665:whole foods`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2747665
- macros: 19.6 cal, 0.66P, 4.06C, 0.08F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: daikon radish, daikon radishs, radishes red raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:37:42.72+00:00

### cucumber -> Cucumber, with peel, raw

- candidate_key: `usda:foundation:2346406:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2346406
- macros: 13.9 cal, 0.63P, 2.95C, 0.18F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cucumber, cucumbers, cucumber with peel raw
- rejected_aliases: none
- risk: 100
- reasons: state_modifier_mismatch_peel, duplicate_existing_product
- updated_at: 2026-05-16T06:37:42.017+00:00

### lime -> Lime, raw

- candidate_key: `usda:survey fndds:2709170:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2709170
- macros: 30 cal, 0.7P, 10.54C, 0.2F
- units: cup=200g, fruit=65g, g=1g, kg=1000g, lb=453.59g, lime=67g, oz=28.35g, slice or wedge=8g
- aliases: lime, limes, lime raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:37:40.41+00:00

### bean sprouts -> Brussels sprouts, raw

- candidate_key: `usda:foundation:2685575:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2685575
- macros: 48.8 cal, 3.98P, 9.62C, 0.56F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: bean sprouts, bean sprout, brussels sprouts raw
- rejected_aliases: none
- risk: 100
- reasons: low_target_token_coverage_50, duplicate_existing_product
- updated_at: 2026-05-16T06:37:39.313+00:00

### thai basil -> Pad Thai, meatless

- candidate_key: `usda:survey fndds:2708805:whole foods`
- decision: review_required
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2708805
- macros: 165 cal, 5.79P, 16.34C, 9.2F
- units: cup=200g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: thai basil, thai basils, pad thai meatless, pad thai meatles
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- updated_at: 2026-05-16T06:37:38.376+00:00

### cilantro -> Coriander (cilantro) leaves, raw

- candidate_key: `usda:sr legacy:169997:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / SR Legacy / 169997
- macros: 23 cal, 2.13P, 3.67C, 0.52F
- units: cup=16g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, sprigs=2.22g
- aliases: cilantro, cilantros, coriander cilantro leaves raw
- rejected_aliases: none
- risk: 100
- reasons: single_token_secondary_match_review_required, duplicate_existing_product
- updated_at: 2026-05-16T06:37:37.865+00:00

### mint -> Mint julep

- candidate_key: `usda:survey fndds:2710643:whole foods`
- decision: rejected
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2710643
- macros: 187 cal, 0P, 5.75C, 0.01F
- units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: mint, mints, mint julep, mint juleps
- rejected_aliases: none
- risk: 100
- reasons: macro_sanity_failed, branded_restaurant_or_alcohol_review_required
- updated_at: 2026-05-16T06:37:37.087+00:00

### zucchini -> Zucchini, pickled

- candidate_key: `usda:survey fndds:2710104:whole foods`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2710104
- macros: 35 cal, 1P, 7.44C, 0.28F
- units: cup=170g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: zucchini, zucchinis, zucchini pickled, zucchini pickleds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_pickled
- updated_at: 2026-05-16T06:26:10.889+00:00

### mushrooms -> Mushrooms, Chanterelle, raw

- candidate_key: `usda:sr legacy:168422:whole foods`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 168422
- macros: 32 cal, 1.49P, 6.86C, 0.53F
- units: cup=54g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=5.4g
- aliases: mushrooms, mushroom, mushrooms chanterelle raw
- rejected_aliases: none
- risk: 25
- reasons: generic_mushroom_subtype_review_required
- updated_at: 2026-05-16T06:26:10.598+00:00

### oregano -> Spices, oregano, dried

- candidate_key: `usda:sr legacy:171328:whole foods`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 171328
- macros: 265 cal, 9P, 68.9C, 4.28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tsp ground=1.8g, tsp leaves=1g
- aliases: oregano, oreganos, spices oregano dried, spices oregano drieds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_dried, single_token_secondary_match_review_required
- updated_at: 2026-05-16T06:26:10.273+00:00

### basil -> Basil, raw

- candidate_key: `usda:survey fndds:2709780:whole foods`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2709780
- macros: 23 cal, 3.15P, 2.65C, 0.64F
- units: cup=24g, g=1g, kg=1000g, lb=453.59g, leaf=0.5g, oz=28.35g, tbsp=3g
- aliases: basil, basils, basil raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:09.919+00:00

### white onion -> Onions, white, raw

- candidate_key: `usda:foundation:1104962:whole foods`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 1104962
- macros: 35 cal, 0.89P, 7.68C, 0.13F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: white onion, white onions, onions white raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:08.135+00:00

### San Marzano tomatoes canned -> Tomato, puree, canned

- candidate_key: `usda:foundation:2685582:whole foods`
- decision: review_required
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 2685582
- macros: 34.8 cal, 1.58P, 8.04C, 0.27F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: san marzano tomatoes canned, san marzano tomatoes canneds, tomato puree canned, tomato puree canneds
- rejected_aliases: none
- risk: 20
- reasons: profile_review_only, low_target_token_coverage_50
- updated_at: 2026-05-16T06:26:04.859+00:00

### tomato -> Tomatoes, grape, raw

- candidate_key: `usda:foundation:321360:whole foods`
- decision: rejected
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Foundation / 321360
- macros: 27 cal, 0.83P, 5.51C, 0.63F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: tomato, tomatos, tomatoes grape raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:26:03.925+00:00

### lemongrass -> SMART SOUP, Vietnamese Carrot Lemongrass

- candidate_key: `usda:sr legacy:171184:whole foods`
- decision: review_required
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 171184
- macros: 44 cal, 1.3P, 8.2C, 1.06F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz 1 pouch=28.3g
- aliases: lemongrass, lemongras, smart soup vietnamese carrot lemongrass, smart soup vietnamese carrot lemongras
- rejected_aliases: none
- risk: 45
- reasons: single_token_secondary_match_review_required, brand_like_name_token_review_required, luke_overlay_review_required
- updated_at: 2026-05-16T06:05:44.697+00:00

### cilantro -> Cilantro, raw

- candidate_key: `usda:survey fndds:2709782:whole foods`
- decision: rejected
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2709782
- macros: 23 cal, 2.13P, 3.67C, 0.52F
- units: cup=16g, g=1g, guideline amount per item=0.3g, kg=1000g, lb=453.59g, oz=28.35g, sprig=1g
- aliases: cilantro, cilantros, cilantro raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T06:05:43.895+00:00

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

### avocado -> Avocado, raw

- candidate_key: `usda:survey fndds:2709223:whole foods`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2709223
- macros: 160 cal, 2P, 8.53C, 14.66F
- units: cup=150g, cup mashed or pureed=230g, fruit=150g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=15g
- aliases: avocado, avocados, avocado raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:16.82+00:00

### red onion -> Onions, red, raw

- candidate_key: `usda:foundation:790577:whole foods`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Foundation / 790577
- macros: 44 cal, 0.94P, 9.93C, 0.1F
- units: g=1g, kg=1000g, lb=453.59g, onion=197g, oz=28.35g
- aliases: red onion, red onions, onions red raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:24:16.369+00:00

### lime -> Lime juice, raw

- candidate_key: `usda:sr legacy:168156:whole foods`
- decision: rejected
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 168156
- macros: 25 cal, 0.42P, 8.42C, 0.07F
- units: cup=242g, fl oz=30.8g, g=1g, kg=1000g, lb=453.59g, lime yields=44g, oz=28.35g
- aliases: lime, limes, lime juice raw
- rejected_aliases: none
- risk: 100
- reasons: state_modifier_mismatch_juice, duplicate_existing_product
- updated_at: 2026-05-16T04:24:15.766+00:00

### apple -> Apple, raw

- candidate_key: `usda:survey fndds:2709215:whole foods`
- decision: rejected
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Survey (FNDDS) / 2709215
- macros: 61 cal, 0.17P, 14.8C, 0.15F
- units: cup=125g, extra large=295g, g=1g, kg=1000g, large=242g, lb=453.59g, medium=200g, oz=28.35g
- aliases: apple, apples, apple raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T04:18:11.293+00:00

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

### black beans -> Beans, black, mature seeds, raw

- candidate_key: `usda:sr legacy:173734:whole foods`
- decision: rejected
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 173734
- macros: 341 cal, 21.6P, 62.4C, 1.42F
- units: cup=194g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=12.1g
- aliases: black beans, black bean, beans black mature seeds raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:17:46.027+00:00

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

### broccoli -> Broccoli, raw

- candidate_key: `usda:foundation:747447:whole foods`
- decision: rejected
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / Foundation / 747447
- macros: 31 cal, 2.57P, 6.27C, 0.34F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: broccoli, broccolis, broccoli raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:17:44.303+00:00

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

### bell pepper -> Peppers, bell, red, raw

- candidate_key: `usda:foundation:2258590:whole foods`
- decision: rejected
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / Foundation / 2258590
- macros: 27 cal, 0.9P, 6.65C, 0.13F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: bell pepper, bell peppers, peppers bell red raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:17:43.031+00:00

### lemon -> Lemon grass (citronella), raw

- candidate_key: `usda:sr legacy:168573:whole foods`
- decision: rejected
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 168573
- macros: 99 cal, 1.82P, 25.3C, 0.49F
- units: cup=67g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=4.8g
- aliases: lemon, lemons, lemon grass citronella raw
- rejected_aliases: none
- risk: 100
- reasons: duplicate_existing_product
- updated_at: 2026-05-16T03:17:41.858+00:00

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
