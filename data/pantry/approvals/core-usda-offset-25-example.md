# Pantry Approval Ledger

Run ID: `01fd3726-e1df-4c50-8ac7-51ae2dcf0682`
Generated From Artifact: 2026-05-15T23:53:46.165Z
Profile: Core USDA (data/pantry/packs/core-usda.json)
Window: offset 25, limit 25

This file is for review only. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:168324:proteins | edit_needed | Pork, bacon, rendered fat, cooked | Review required: single_token_secondary_match_review_required. |
| usda:sr legacy:168914:whole foods | edit_needed | Rice noodles, cooked | Review required: low_target_token_coverage_50. |
| usda:sr legacy:173263:whole foods | edit_needed | Rice, brown, parboiled, cooked, UNCLE BENS | Review required: brand_like_name_token_review_required. |
| usda:survey fndds:2706060:proteins | edit_needed | Chicken wing, rotisserie | Review required: state_modifier_mismatch_wing. |
| usda:sr legacy:173722:proteins | edit_needed | Salmon nuggets, cooked as purchased, unheated | Review required: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets. |
| usda:sr legacy:175180:proteins | edit_needed | Crustaceans, shrimp, cooked | Review required: single_token_secondary_match_review_required. |
| usda:foundation:2727569:proteins | rejected | Chicken, breast, meat and skin, raw | Rejected by dry-run: macro_sanity_failed. |
| usda:foundation:2727567:proteins | rejected | Chicken, thigh, meat and skin, raw | Rejected by dry-run: macro_sanity_failed. |
| usda:foundation:2646175:proteins | rejected | Beef, flank, steak, boneless, choice, raw | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:2514747:proteins | rejected | Turkey, ground, 93% lean/ 7% fat, raw | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:2646169:proteins | rejected | Pork, loin, tenderloin, boneless, raw | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:2727574:proteins | rejected | Beef, top sirloin steak, raw | Rejected by dry-run: duplicate_existing_product. |

## Candidate Detail

### bacon cooked -> Pork, bacon, rendered fat, cooked

- candidate_key: `usda:sr legacy:168324:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 168324
- macros: 898 cal, 0.07P, 0C, 99.5F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: bacon cooked, bacon cookeds, pork bacon rendered fat cooked, pork bacon rendered fat cookeds
- reasons: single_token_secondary_match_review_required

### basmati rice cooked -> Rice noodles, cooked

- candidate_key: `usda:sr legacy:168914:whole foods`
- dry_run_decision: review_required
- source: usda / SR Legacy / 168914
- macros: 108 cal, 1.79P, 24C, 0.2F
- units: cup=176g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: basmati rice cooked, basmati rice cookeds, rice noodles cooked, rice noodles cookeds
- reasons: low_target_token_coverage_50

### brown rice cooked -> Rice, brown, parboiled, cooked, UNCLE BENS

- candidate_key: `usda:sr legacy:173263:whole foods`
- dry_run_decision: review_required
- source: usda / SR Legacy / 173263
- macros: 147 cal, 3.09P, 31.3C, 0.85F
- units: cup=155g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: brown rice cooked, brown rice cookeds, rice brown parboiled cooked uncle bens, rice brown parboiled cooked uncle benss
- reasons: brand_like_name_token_review_required

### rotisserie chicken -> Chicken wing, rotisserie

- candidate_key: `usda:survey fndds:2706060:proteins`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2706060
- macros: 257 cal, 23.42P, 0.6C, 18.04F
- units: drummette=22g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, wing any size=35g
- aliases: rotisserie chicken, rotisserie chickens, chicken wing rotisserie, chicken wing rotisseries
- reasons: state_modifier_mismatch_wing

### salmon cooked -> Salmon nuggets, cooked as purchased, unheated

- candidate_key: `usda:sr legacy:173722:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 173722
- macros: 189 cal, 12P, 11.8C, 10.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: salmon cooked, salmon cookeds, salmon nuggets cooked as purchased unheated, salmon nuggets cooked as purchased unheateds
- reasons: state_modifier_mismatch_nugget, state_modifier_mismatch_nuggets

### shrimp cooked -> Crustaceans, shrimp, cooked

- candidate_key: `usda:sr legacy:175180:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 175180
- macros: 99 cal, 24P, 0.2C, 0.28F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: shrimp cooked, shrimp cookeds, crustaceans shrimp cooked, crustaceans shrimp cookeds
- reasons: single_token_secondary_match_review_required

### chicken breast raw -> Chicken, breast, meat and skin, raw

- candidate_key: `usda:foundation:2727569:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2727569
- macros: 133 cal, 21.4P, -0.43C, 4.78F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chicken breast raw, chicken breast meat and skin raw
- reasons: macro_sanity_failed

### chicken thigh raw -> Chicken, thigh, meat and skin, raw

- candidate_key: `usda:foundation:2727567:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2727567
- macros: 193 cal, 17.1P, -0.17C, 13.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: chicken thigh raw, chicken thigh meat and skin raw
- reasons: macro_sanity_failed

### flank steak -> Beef, flank, steak, boneless, choice, raw

- candidate_key: `usda:foundation:2646175:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2646175
- macros: 170 cal, 20.1P, 0C, 9.4F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: flank steak, flank steaks, beef flank steak boneless choice raw
- reasons: duplicate_existing_product

### ground turkey 93 lean raw -> Turkey, ground, 93% lean/ 7% fat, raw

- candidate_key: `usda:foundation:2514747:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2514747
- macros: 158 cal, 17.3P, 0C, 9.59F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: ground turkey 93 lean raw, turkey ground 93 lean 7 fat raw
- reasons: duplicate_existing_product

### pork tenderloin -> Pork, loin, tenderloin, boneless, raw

- candidate_key: `usda:foundation:2646169:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2646169
- macros: 125 cal, 21.6P, 0C, 3.9F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: pork tenderloin, pork tenderloins, pork loin tenderloin boneless raw
- reasons: duplicate_existing_product

### sirloin steak -> Beef, top sirloin steak, raw

- candidate_key: `usda:foundation:2727574:proteins`
- dry_run_decision: rejected
- source: usda / Foundation / 2727574
- macros: 146 cal, 22P, 0.22C, 5.71F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: sirloin steak, sirloin steaks, beef top sirloin steak raw
- reasons: duplicate_existing_product
