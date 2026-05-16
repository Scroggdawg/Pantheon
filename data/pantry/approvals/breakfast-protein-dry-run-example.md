# Pantry Approval Ledger

Run ID: `e2a0e687-87f5-45a6-a227-b12c05f3bbaf`
Generated From Artifact: 2026-05-16T00:00:54.608Z
Profile: Breakfast Protein (data/pantry/packs/breakfast-protein.json)
Window: offset 0, limit 25

This file is for review only. It does not apply rows to Supabase.

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:168816:whole foods | edit_needed | Fruit butters, apple | Review required: single_token_secondary_match_review_required. |
| usda:survey fndds:2707933:breakfast snacks | edit_needed | Cookie, granola | Review required: single_token_secondary_match_review_required. |
| usda:survey fndds:2708088:breakfast snacks | edit_needed | Cereal or granola bar (Kashi Chewy) | Review required: profile_review_only, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required. |
| usda:foundation:2346397:breakfast snacks | edit_needed | Oats, whole grain, steel cut | Review required: low_target_token_coverage_50. |
| usda:sr legacy:173180:proteins | edit_needed | Beverages, Protein powder whey based | Review required: profile_review_only, luke_overlay_review_required. |
| usda:survey fndds:2709216:breakfast snacks | rejected | Applesauce, regular | Rejected by dry-run: duplicate_existing_product, prepared_dish_mismatch_risk. |
| usda:foundation:1105314:whole foods | rejected | Bananas, ripe and slightly ripe, raw | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:168872:breakfast snacks | rejected | Oat bran, raw | Rejected by dry-run: profile_review_only, low_target_token_coverage_67, macro_sanity_failed. |
| usda:sr legacy:169640:sauces condiments oils | rejected | Honey | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:172226:breakfast snacks | rejected | Ice cream sandwich | Rejected by dry-run: duplicate_existing_product, prepared_dish_mismatch_risk. |
| usda:foundation:328841:breakfast snacks | rejected | Cheese, cottage, lowfat, 2% milkfat | Rejected by dry-run: duplicate_existing_product. |
| usda:sr legacy:167715:breakfast snacks | rejected | Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size | Rejected by dry-run: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, duplicate_existing_product. |
| usda:survey fndds:2710726:proteins | rejected | Nutritional drink or shake, high protein, ready-to-drink, NFS | Rejected by dry-run: profile_review_only, duplicate_existing_product. |
| usda:foundation:2346396:breakfast snacks | rejected | Oats, whole grain, rolled, old fashioned | Rejected by dry-run: duplicate_existing_product. |
| usda:foundation:330137:breakfast snacks | rejected | Yogurt, Greek, plain, nonfat | Rejected by dry-run: profile_review_only, low_target_token_coverage_50, duplicate_existing_product. |

## Candidate Detail

### apple -> Fruit butters, apple

- candidate_key: `usda:sr legacy:168816:whole foods`
- dry_run_decision: review_required
- source: usda / SR Legacy / 168816
- macros: 173 cal, 0.39P, 42.5C, 0.3F
- units: cup=282g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=17g, tbsp=17g
- aliases: apple, apples, fruit butters apple, fruit butters apples
- reasons: single_token_secondary_match_review_required

### granola -> Cookie, granola

- candidate_key: `usda:survey fndds:2707933:breakfast snacks`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2707933
- macros: 464 cal, 9.8P, 66.7C, 17.6F
- units: g=1g, kg=1000g, large=45g, lb=453.59g, medium=30g, miniature bite size=5g, oz=28.35g, small=20g
- aliases: granola, granolas, cookie granola, cookie granolas
- reasons: single_token_secondary_match_review_required

### Kashi cereal -> Cereal or granola bar (Kashi Chewy)

- candidate_key: `usda:survey fndds:2708088:breakfast snacks`
- dry_run_decision: review_required
- source: usda / Survey (FNDDS) / 2708088
- macros: 390 cal, 16.67P, 63.42C, 7.69F
- units: bar=78g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: kashi cereal, kashi cereals, cereal or granola bar kashi chewy, cereal or granola bar kashi chewys
- reasons: profile_review_only, luke_overlay_review_required, branded_restaurant_or_alcohol_review_required

### protein oats -> Oats, whole grain, steel cut

- candidate_key: `usda:foundation:2346397:breakfast snacks`
- dry_run_decision: review_required
- source: usda / Foundation / 2346397
- macros: 379 cal, 12.5P, 69.8C, 5.8F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: protein oats, protein oatss, oats whole grain steel cut
- reasons: low_target_token_coverage_50

### protein powder whey -> Beverages, Protein powder whey based

- candidate_key: `usda:sr legacy:173180:proteins`
- dry_run_decision: review_required
- source: usda / SR Legacy / 173180
- macros: 352 cal, 78.1P, 6.25C, 1.56F
- units: cup=96.97g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: protein powder whey, protein powder wheys, beverages protein powder whey based, beverages protein powder whey baseds
- reasons: profile_review_only, luke_overlay_review_required

### applesauce -> Applesauce, regular

- candidate_key: `usda:survey fndds:2709216:breakfast snacks`
- dry_run_decision: rejected
- source: usda / Survey (FNDDS) / 2709216
- macros: 75 cal, 0.25P, 17.97C, 0.17F
- units: cup=250g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, pouch=90g, snack size container=113g
- aliases: applesauce, applesauces, applesauce regular, applesauce regulars
- reasons: duplicate_existing_product, prepared_dish_mismatch_risk

### banana -> Bananas, ripe and slightly ripe, raw

- candidate_key: `usda:foundation:1105314:whole foods`
- dry_run_decision: rejected
- source: usda / Foundation / 1105314
- macros: 97 cal, 0.74P, 23C, 0.29F
- units: banana=118g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: banana, bananas, bananas ripe and slightly ripe raw
- reasons: duplicate_existing_product

### Cracklin Oat Bran -> Oat bran, raw

- candidate_key: `usda:sr legacy:168872:breakfast snacks`
- dry_run_decision: rejected
- source: usda / SR Legacy / 168872
- macros: 246 cal, 17.3P, 66.2C, 7.03F
- units: cup=94g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: cracklin oat bran, cracklin oat brans, oat bran raw
- reasons: profile_review_only, low_target_token_coverage_67, macro_sanity_failed

### honey -> Honey

- candidate_key: `usda:sr legacy:169640:sauces condiments oils`
- dry_run_decision: rejected
- source: usda / SR Legacy / 169640
- macros: 304 cal, 0.3P, 82.4C, 0F
- units: cup=339g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 0 5 oz=14g, tbsp=21g
- aliases: honey, honeys
- reasons: duplicate_existing_product

### ice cream sandwich low calorie -> Ice cream sandwich

- candidate_key: `usda:sr legacy:172226:breakfast snacks`
- dry_run_decision: rejected
- source: usda / SR Legacy / 172226
- macros: 237 cal, 4.29P, 37.1C, 8.57F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=70g
- aliases: ice cream sandwich low calorie, ice cream sandwich low calories, ice cream sandwich, ice cream sandwichs
- reasons: duplicate_existing_product, prepared_dish_mismatch_risk

### low fat cottage cheese -> Cheese, cottage, lowfat, 2% milkfat

- candidate_key: `usda:foundation:328841:breakfast snacks`
- dry_run_decision: rejected
- source: usda / Foundation / 328841
- macros: 84 cal, 11P, 4.31C, 2.3F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: low fat cottage cheese, low fat cottage cheeses, cheese cottage lowfat 2 milkfat, cheese cottage lowfat 2 milkfats
- reasons: duplicate_existing_product

### Magic Spoon cereal -> Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size

- candidate_key: `usda:sr legacy:167715:breakfast snacks`
- dry_run_decision: rejected
- source: usda / SR Legacy / 167715
- macros: 339 cal, 10.9P, 80.6C, 2.06F
- units: cup 1 nlea serving=47.2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: magic spoon cereal, magic spoon cereals, cereals ready to eat post shredded wheat n bran spoon size, cereals ready to eat post shredded wheat n bran spoon sizes
- reasons: profile_review_only, low_target_token_coverage_67, brand_like_name_token_review_required, duplicate_existing_product

### protein shake -> Nutritional drink or shake, high protein, ready-to-drink, NFS

- candidate_key: `usda:survey fndds:2710726:proteins`
- dry_run_decision: rejected
- source: usda / Survey (FNDDS) / 2710726
- macros: 61 cal, 6.59P, 0.85C, 3.38F
- units: bottle 14 fl oz myoplex=448g, bottle 20 fl oz monster milk=640g, bottle or box nfs=544g, cup=256g, fl oz=32g, g=1g, kg=1000g, lb=453.59g
- aliases: protein shake, protein shakes, nutritional drink or shake high protein ready to drink nfs
- reasons: profile_review_only, duplicate_existing_product

### rolled oats -> Oats, whole grain, rolled, old fashioned

- candidate_key: `usda:foundation:2346396:breakfast snacks`
- dry_run_decision: rejected
- source: usda / Foundation / 2346396
- macros: 379 cal, 13.5P, 68.7C, 5.89F
- units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: rolled oats, rolled oatss, oats whole grain rolled old fashioned, oats whole grain rolled old fashioneds
- reasons: duplicate_existing_product

### Yasso Greek yogurt bar -> Yogurt, Greek, plain, nonfat

- candidate_key: `usda:foundation:330137:breakfast snacks`
- dry_run_decision: rejected
- source: usda / Foundation / 330137
- macros: 61 cal, 10.3P, 3.64C, 0.37F
- units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- aliases: yasso greek yogurt bar, yogurt greek plain nonfat, yogurt greek plain nonfats
- reasons: profile_review_only, low_target_token_coverage_50, duplicate_existing_product
