# Pantry Approval Ledger

Run ID: `8e8d5b9a-a385-4857-a971-980318d57b51`
Generated From Artifact: 2026-05-16T00:13:27.337Z
Profile: BBQ (data/pantry/packs/bbq.json)
Window: offset 0, limit 25

This file is for review only. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:172146:proteins | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised | Review required: low_target_token_coverage_67. |
| usda:survey fndds:2706167:proteins | edit_needed | Hot dog, beef | Review required: profile_review_only, luke_overlay_review_required. |
| usda:sr legacy:172387:proteins | edit_needed | Chicken, broilers or fryers, thigh, meat only, cooked, fried | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:170340:cuisine staples | edit_needed | KFC, Coleslaw | Review required: single_token_secondary_match_review_required. |
| usda:survey fndds:2709456:cuisine staples | edit_needed | Potato, french fries, NFS | Review required: not_further_specified_review_required. |
| usda:sr legacy:170717:cuisine staples | edit_needed | McDONALD'S, Hamburger | Review required: low_target_token_coverage_50, branded_restaurant_or_alcohol_review_required. |
| usda:survey fndds:2706928:proteins | edit_needed | Hamburger, on wheat bun, 1 small patty | Review required: state_modifier_mismatch_bun. |
| usda:survey fndds:2706409:cuisine staples | edit_needed | Chili hot dog, no bun | Review required: profile_review_only, luke_overlay_review_required. |
| usda:foundation:2747661:whole foods | edit_needed | Peppers, jalapeno, seeded, raw | Review required: single_token_secondary_match_review_required. |
| usda:survey fndds:2708818:cuisine staples | edit_needed | Macaroni or noodles with cheese and meat | Review required: prepared_dish_mismatch_risk. |
| usda:sr legacy:168561:whole foods | edit_needed | Pickle relish, sweet | Review required: state_modifier_mismatch_relish. |
| usda:sr legacy:173344:proteins | edit_needed | Pulled pork in barbecue sauce | Review required: state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk. |
| usda:sr legacy:174612:proteins | edit_needed | Turkey, breast, smoked, lemon pepper flavor, 97% fat-free | Review required: state_modifier_mismatch_flavor. |
| usda:foundation:2727569:proteins | rejected | Chicken, breast, meat and skin, raw | Rejected by dry-run: low_target_token_coverage_67, macro_sanity_failed. |
| usda:foundation:2514747:proteins | rejected | Turkey, ground, 93% lean/ 7% fat, raw | Rejected by dry-run: low_target_token_coverage_50, duplicate_existing_product. |
| usda:foundation:1104962:whole foods | rejected | Onions, white, raw | Rejected by dry-run: duplicate_existing_product. |

## Candidate Detail

### baby back ribs cooked -> Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised

- candidate_key: `usda:sr legacy:172146:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 172146
- macros: 306 cal, 27.8P, 0C, 21.7F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1197g
- aliases: baby back ribs cooked, baby back ribs cookeds, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braised, beef rib back ribs bone in separable lean only trimmed to 0 fat choice cooked braiseds
- reasons: low_target_token_coverage_67

### beef hot dog -> Hot dog, beef

- candidate_key: `usda:survey fndds:2706167:proteins`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2706167
- macros: 310 cal, 11.7P, 2.89C, 28F
- units: bun length jumbo=57g, cocktail miniature=10g, cup sliced=150g, footlong=88g, g=1g, hot dog=45g, kg=1000g, lb=453.59g
- aliases: beef hot dog, hot dog beef, hot dog beefs
- reasons: profile_review_only, luke_overlay_review_required

### chicken thigh cooked -> Chicken, broilers or fryers, thigh, meat only, cooked, fried

- candidate_key: `usda:sr legacy:172387:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 172387
- macros: 218 cal, 28.2P, 1.18C, 10.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, thigh bone and skin removed=52g, unit yield from 1 lb ready to cook chicken=31g
- aliases: chicken thigh cooked, chicken thigh cookeds, chicken broilers or fryers thigh meat only cooked fried, chicken broilers or fryers thigh meat only cooked frieds
- reasons: prepared_dish_mismatch_risk

### coleslaw -> KFC, Coleslaw

- candidate_key: `usda:sr legacy:170340:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 170340
- macros: 144 cal, 0.91P, 15.6C, 8.64F
- units: cup=191g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, package=112g
- aliases: coleslaw, coleslaws, kfc coleslaw, kfc coleslaws
- reasons: single_token_secondary_match_review_required

### french fries -> Potato, french fries, NFS

- candidate_key: `usda:survey fndds:2709456:cuisine staples`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2709456
- macros: 225 cal, 2.5P, 23.23C, 14.07F
- units: crinkle cut=5g, cup=60g, fry ns as to shape=5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, shoestring=2g
- aliases: french fries, french fry, potato french fries nfs
- reasons: not_further_specified_review_required

### hamburger bun -> McDONALD'S, Hamburger

- candidate_key: `usda:sr legacy:170717:cuisine staples`
- dry_run_decision: review_required
- source: usda / SR Legacy / 170717
- macros: 264 cal, 12.9P, 30.3C, 10.1F
- units: bun=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, sandwich=95g
- aliases: hamburger bun, mcdonalds hamburger, mcdonalds hamburgers
- reasons: low_target_token_coverage_50, branded_restaurant_or_alcohol_review_required

### hamburger patty -> Hamburger, on wheat bun, 1 small patty

- candidate_key: `usda:survey fndds:2706928:proteins`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2706928
- macros: 280 cal, 17.83P, 20.14C, 13.86F
- units: g=1g, hamburger=115g, kg=1000g, lb=453.59g, oz=28.35g, patty=113g
- aliases: hamburger patty, hamburger pattys, hamburger on wheat bun 1 small patty, hamburger on wheat bun 1 small pattys
- reasons: state_modifier_mismatch_bun

### hot dog bun -> Chili hot dog, no bun

- candidate_key: `usda:survey fndds:2706409:cuisine staples`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2706409
- macros: 202 cal, 10.01P, 7.09C, 14.98F
- units: bun=50g, g=1g, hot dog=45g, hot dog with sauce=125g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: hot dog bun, chili hot dog no bun
- reasons: profile_review_only, luke_overlay_review_required

### jalapeno -> Peppers, jalapeno, seeded, raw

- candidate_key: `usda:foundation:2747661:whole foods`
- dry_run_decision: review_required
- source: usda / Foundation / 2747661
- macros: 24.1 cal, 0.62P, 5.08C, 0.15F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: jalapeno, jalapenos, peppers jalapeno seeded raw
- reasons: single_token_secondary_match_review_required

### macaroni and cheese -> Macaroni or noodles with cheese and meat

- candidate_key: `usda:survey fndds:2708818:cuisine staples`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2708818
- macros: 210 cal, 11.79P, 15.14C, 11.16F
- units: cup=230g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: macaroni and cheese, macaroni and cheeses, macaroni or noodles with cheese and meat, macaroni or noodles with cheese and meats
- reasons: prepared_dish_mismatch_risk

### pickle -> Pickle relish, sweet

- candidate_key: `usda:sr legacy:168561:whole foods`
- dry_run_decision: review_required
- source: usda / SR Legacy / 168561
- macros: 130 cal, 0.37P, 35.1C, 0.47F
- units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 2 3 tbsp=10g, tbsp=15g
- aliases: pickle, pickles, pickle relish sweet, pickle relish sweets
- reasons: state_modifier_mismatch_relish

### pulled pork -> Pulled pork in barbecue sauce

- candidate_key: `usda:sr legacy:173344:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 173344
- macros: 168 cal, 13.2P, 18.7C, 4.42F
- units: cup=249g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pulled pork, pulled porks, pulled pork in barbecue sauce, pulled pork in barbecue sauces
- reasons: state_modifier_mismatch_sauce, luke_overlay_review_required, prepared_dish_mismatch_risk

### smoked turkey breast -> Turkey, breast, smoked, lemon pepper flavor, 97% fat-free

- candidate_key: `usda:sr legacy:174612:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 174612
- macros: 95 cal, 20.9P, 1.31C, 0.69F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=28g
- aliases: smoked turkey breast, smoked turkey breasts, turkey breast smoked lemon pepper flavor 97 fat free, turkey breast smoked lemon pepper flavor 97 fat frees
- reasons: state_modifier_mismatch_flavor

### grilled chicken breast -> Chicken, breast, meat and skin, raw

- candidate_key: `usda:foundation:2727569:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2727569
- macros: 133 cal, 21.4P, -0.43C, 4.78F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: grilled chicken breast, grilled chicken breasts, chicken breast meat and skin raw
- reasons: low_target_token_coverage_67, macro_sanity_failed

### turkey burger -> Turkey, ground, 93% lean/ 7% fat, raw

- candidate_key: `usda:foundation:2514747:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2514747
- macros: 158 cal, 17.3P, 0C, 9.59F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: turkey burger, turkey burgers, turkey ground 93 lean 7 fat raw
- reasons: low_target_token_coverage_50, duplicate_existing_product

### white onion -> Onions, white, raw

- candidate_key: `usda:foundation:1104962:whole foods`
- dry_run_decision: rejected
- source: usda / Foundation / 1104962
- macros: 35 cal, 0.89P, 7.68C, 0.13F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: white onion, white onions, onions white raw
- reasons: duplicate_existing_product
