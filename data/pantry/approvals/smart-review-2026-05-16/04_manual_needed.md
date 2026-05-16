# Manual Needed

Generated: 2026-05-16T07:11:14.380Z
Rows: 26

This file is a review packet. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:173469:sauces condiments oils | edit_needed | Vinegar, cider | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_67. |
| usda:sr legacy:172146:proteins | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_67. |
| usda:foundation:2747665:whole foods | edit_needed | Radishes, red, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50. |
| usda:foundation:2515375:coverage buffer | edit_needed | Nuts, hazelnuts or filberts, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_33. |
| usda:survey fndds:2709242:prepared common | edit_needed | Mango, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_33. |
| usda:survey fndds:2708357:cuisine staples | edit_needed | Pasta, cooked | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50. |
| usda:foundation:2710825:cuisine staples | edit_needed | Rice, black, unenriched, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_33. |
| usda:foundation:2710825:sauces condiments oils | edit_needed | Rice, black, unenriched, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50. |
| usda:survey fndds:2706394:proteins | edit_needed | Steak tartare | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_tartare. |
| usda:survey fndds:2708402:cuisine staples | edit_needed | Rice, cooked, NFS | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50, not_further_specified_review_required. |
| usda:survey fndds:2708805:whole foods | edit_needed | Pad Thai, meatless | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50. |
| usda:sr legacy:170164:cuisine staples | edit_needed | Nuts, chestnuts, chinese, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: low_target_token_coverage_50. |
| usda:sr legacy:168422:whole foods | edit_needed | Mushrooms, Chanterelle, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: generic_mushroom_subtype_review_required. |
| usda:sr legacy:175036:cuisine staples | edit_needed | Tortillas, ready-to-bake or -fry, corn | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_bake. |
| usda:sr legacy:169724:cuisine staples | edit_needed | Wheat flour, white, tortilla mix, enriched | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_mix. |
| usda:sr legacy:170693:proteins | edit_needed | Fast foods, hamburger; single, regular patty; plain | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_fast foods. |
| usda:sr legacy:169103:whole foods | edit_needed | Orange peel, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_peel. |
| usda:sr legacy:168561:whole foods | edit_needed | Pickle relish, sweet | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_relish. |
| usda:sr legacy:170086:whole foods | edit_needed | Beans, pinto, mature seeds, sprouted, raw | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_sprouted. |
| usda:sr legacy:169742:cuisine staples | edit_needed | Rice noodles, dry | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_dry. |
| usda:survey fndds:2706060:proteins | edit_needed | Chicken wing, rotisserie | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_wing. |
| usda:sr legacy:171016:sauces condiments oils | edit_needed | Oil, sesame, salad or cooking | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_salad. |
| usda:sr legacy:174612:proteins | edit_needed | Turkey, breast, smoked, lemon pepper flavor, 97% fat-free | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_flavor. |
| usda:sr legacy:168912:cuisine staples | edit_needed | Spaghetti, spinach, cooked | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_spinach. |
| usda:survey fndds:2710104:whole foods | edit_needed | Zucchini, pickled | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_pickled. |
| usda:sr legacy:173722:proteins | edit_needed | Salmon nuggets, cooked as purchased, unheated | NEEDS_MANUAL_EDIT: Needs manual correction, better source data, or a future importer guard. Reasons: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets. |

## Candidate Detail

### apple cider vinegar -> Vinegar, cider

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:173469:sauces condiments oils`
- current_decision: review_required
- packet: manual-needed
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 173469
- macros: 21 cal, 0P, 0.93C, 0F
- units: cup=239g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14.9g, tsp=5g
- aliases: apple cider vinegar, apple cider vinegars, vinegar cider, vinegar ciders
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_67
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:34:37.22+00:00

### baby back ribs cooked -> Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:172146:proteins`
- current_decision: review_required
- packet: manual-needed
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 172146
- macros: 306 cal, 27.8P, 0C, 21.7F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1197g
- aliases: baby back ribs cooked, baby back ribs cookeds, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braised, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braiseds
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_67
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:34:31.94+00:00

### daikon radish -> Radishes, red, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:foundation:2747665:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2747665
- macros: 19.6 cal, 0.66P, 4.06C, 0.08F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: daikon radish, daikon radishs, radishes red raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:37:42.72+00:00

### hazelnut stevia drops -> Nuts, hazelnuts or filberts, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:foundation:2515375:coverage buffer`
- current_decision: review_required
- packet: manual-needed
- run: eccd56c0-9df5-4b51-8bf1-eacdc36134a1
- source: usda / Foundation / 2515375
- macros: 602 cal, 13.5P, 26.5C, 53.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: hazelnut stevia drops, hazelnut stevia drop, nuts hazelnuts or filberts raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:18:18.663+00:00

### mango sticky rice -> Mango, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2709242:prepared common`
- current_decision: review_required
- packet: manual-needed
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2709242
- macros: 60 cal, 0.82P, 14.98C, 0.38F
- units: cup=165g, g=1g, kg=1000g, lb=453.59g, mango=210g, oz=28.35g, slice chunk=25g
- aliases: mango sticky rice, mango sticky rices, mango raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:05:48.624+00:00

### penne pasta cooked -> Pasta, cooked

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2708357:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2708357
- macros: 157 cal, 5.76P, 30.68C, 0.92F
- units: cup cooked=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz dry yields=80g
- aliases: penne pasta cooked, penne pasta cookeds, pasta cooked, pasta cookeds
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:26:26.842+00:00

### rice paper wrapper -> Rice, black, unenriched, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:foundation:2710825:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2710825
- macros: 361 cal, 7.57P, 77.2C, 3.44F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, wrapper=22g
- aliases: rice paper wrapper, rice paper wrappers, rice black unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_33
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:37:47.892+00:00

### rice vinegar -> Rice, black, unenriched, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:foundation:2710825:sauces condiments oils`
- current_decision: review_required
- packet: manual-needed
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Foundation / 2710825
- macros: 361 cal, 7.57P, 77.2C, 3.44F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rice vinegar, rice vinegars, rice black unenriched raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:37:51.916+00:00

### steak cooked -> Steak tartare

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2706394:proteins`
- current_decision: review_required
- packet: manual-needed
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / Survey (FNDDS) / 2706394
- macros: 216 cal, 17.45P, 0.34C, 15.6F
- units: cup=225g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: steak cooked, steak cookeds, steak tartare, steak tartares
- rejected_aliases: none
- risk: 20
- reasons: state_modifier_mismatch_tartare
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:24:17.756+00:00

### sticky rice cooked -> Rice, cooked, NFS

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2708402:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / Survey (FNDDS) / 2708402
- macros: 129 cal, 2.67P, 27.99C, 0.28F
- units: cup cooked=158g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: sticky rice cooked, sticky rice cookeds, rice cooked nfs
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50, not_further_specified_review_required
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:05:45.472+00:00

### thai basil -> Pad Thai, meatless

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2708805:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: d58e80ca-7345-479b-8b2e-69ec2cf513b2
- source: usda / Survey (FNDDS) / 2708805
- macros: 165 cal, 5.79P, 16.34C, 9.2F
- units: cup=200g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: thai basil, thai basils, pad thai meatless, pad thai meatles
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:37:38.376+00:00

### water chestnuts -> Nuts, chestnuts, chinese, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:170164:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 170164
- macros: 224 cal, 4.2P, 49.1C, 1.11F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: water chestnuts, water chestnut, nuts chestnuts chinese raw
- rejected_aliases: none
- risk: 20
- reasons: low_target_token_coverage_50
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:05:46.185+00:00

### mushrooms -> Mushrooms, Chanterelle, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:168422:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 168422
- macros: 32 cal, 1.49P, 6.86C, 0.53F
- units: cup=54g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=5.4g
- aliases: mushrooms, mushroom, mushrooms chanterelle raw
- rejected_aliases: none
- risk: 25
- reasons: generic_mushroom_subtype_review_required
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:26:10.598+00:00

### corn tortilla -> Tortillas, ready-to-bake or -fry, corn

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:175036:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: c0de7b71-1a9b-452c-ae1d-3e5640a322a3
- source: usda / SR Legacy / 175036
- macros: 218 cal, 5.7P, 44.6C, 2.85F
- units: enchilada=19g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: corn tortilla, corn tortillas, tortillas ready to bake or fry corn, tortillas ready to bake or fry corns
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_bake
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:24:19.096+00:00

### flour tortilla -> Wheat flour, white, tortilla mix, enriched

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:169724:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / SR Legacy / 169724
- macros: 405 cal, 9.66P, 67.1C, 10.6F
- units: cup=111g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- aliases: flour tortilla, flour tortillas, wheat flour white tortilla mix enriched, wheat flour white tortilla mix enricheds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_mix
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:26:22.747+00:00

### hamburger patty -> Fast foods, hamburger; single, regular patty; plain

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:170693:proteins`
- current_decision: review_required
- packet: manual-needed
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 170693
- macros: 297 cal, 16.5P, 31.5C, 12F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty=113g, sandwich=78g
- aliases: hamburger patty, hamburger pattys, fast foods hamburger single regular patty plain, fast foods hamburger single regular patty plains
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_fast foods
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:34:33.311+00:00

### orange -> Orange peel, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:169103:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 169103
- macros: 97 cal, 1.5P, 25C, 0.2F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=6g, tsp=2g
- aliases: orange, oranges, orange peel raw
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_peel
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:17:41.314+00:00

### pickle -> Pickle relish, sweet

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:168561:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 168561
- macros: 130 cal, 0.37P, 35.1C, 0.47F
- units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 2 3 tbsp=10g, tbsp=15g
- aliases: pickle, pickles, pickle relish sweet, pickle relish sweets
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_relish
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:34:30.294+00:00

### pinto beans -> Beans, pinto, mature seeds, sprouted, raw

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:170086:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: 9b200106-a79a-49c6-86b4-f8bf926747a4
- source: usda / SR Legacy / 170086
- macros: 62 cal, 5.25P, 11.6C, 0.9F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pinto beans, pinto bean, beans pinto mature seeds sprouted raw
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_sprouted
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:17:46.272+00:00

### rice noodles -> Rice noodles, dry

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:169742:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 09b0c220-2db2-43be-a90f-ccceba2716e8
- source: usda / SR Legacy / 169742
- macros: 364 cal, 5.95P, 80.2C, 0.56F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rice noodles, rice noodle, rice noodles dry
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_dry
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:26:23.942+00:00

### rotisserie chicken -> Chicken wing, rotisserie

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2706060:proteins`
- current_decision: review_required
- packet: manual-needed
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / Survey (FNDDS) / 2706060
- macros: 257 cal, 23.42P, 0.6C, 18.04F
- units: drummette=22g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, wing any size=35g
- aliases: rotisserie chicken, rotisserie chickens, chicken wing rotisserie, chicken wing rotisseries
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_wing
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:25:09.382+00:00

### sesame oil -> Oil, sesame, salad or cooking

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:171016:sauces condiments oils`
- current_decision: review_required
- packet: manual-needed
- run: 83d144b0-f0a3-4243-8d50-e14ed892d604
- source: usda / SR Legacy / 171016
- macros: 884 cal, 0P, 0C, 100F
- units: cup=218g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=13.6g, tsp=4.5g
- aliases: sesame oil, oil sesame salad or cooking, oil sesame salad or cookings
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_salad
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:05:46.798+00:00

### smoked turkey breast -> Turkey, breast, smoked, lemon pepper flavor, 97% fat-free

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:174612:proteins`
- current_decision: review_required
- packet: manual-needed
- run: 709c95ee-58f6-446e-99fa-2003a0199ddf
- source: usda / SR Legacy / 174612
- macros: 95 cal, 20.9P, 1.31C, 0.69F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=28g
- aliases: smoked turkey breast, smoked turkey breasts, turkey breast smoked lemon pepper flavor 97 fat free, turkey breast smoked lemon pepper flavor 97 fat frees
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_flavor
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T04:34:32.668+00:00

### spaghetti cooked -> Spaghetti, spinach, cooked

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:168912:cuisine staples`
- current_decision: review_required
- packet: manual-needed
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / SR Legacy / 168912
- macros: 130 cal, 4.58P, 26.2C, 0.63F
- units: cup=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: spaghetti cooked, spaghetti cookeds, spaghetti spinach cooked, spaghetti spinach cookeds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_spinach
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:26:26.287+00:00

### zucchini -> Zucchini, pickled

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:survey fndds:2710104:whole foods`
- current_decision: review_required
- packet: manual-needed
- run: 48f7ff44-872f-4d5e-afa0-210064016c1e
- source: usda / Survey (FNDDS) / 2710104
- macros: 35 cal, 1P, 7.44C, 0.28F
- units: cup=170g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: zucchini, zucchinis, zucchini pickled, zucchini pickleds
- rejected_aliases: none
- risk: 40
- reasons: state_modifier_mismatch_pickled
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T06:26:10.889+00:00

### salmon cooked -> Salmon nuggets, cooked as purchased, unheated

- recommendation: NEEDS_MANUAL_EDIT
- candidate_key: `usda:sr legacy:173722:proteins`
- current_decision: review_required
- packet: manual-needed
- run: 01fd3726-e1df-4c50-8ac7-51ae2dcf0682
- source: usda / SR Legacy / 173722
- macros: 189 cal, 12P, 11.8C, 10.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: salmon cooked, salmon cookeds, salmon nuggets cooked as purchased unheated, salmon nuggets cooked as purchased unheateds
- rejected_aliases: none
- risk: 60
- reasons: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets
- why_here: Needs manual correction, better source data, or a future importer guard.
- updated_at: 2026-05-16T03:25:13.4+00:00
