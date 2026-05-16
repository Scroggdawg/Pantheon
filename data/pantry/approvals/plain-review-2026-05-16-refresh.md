# Plain Pantry Review

Generated: 2026-05-16T23:23:38.168Z
Referee: Pantry Review Referee v1
Rows: 200

## What You Are Reviewing

You are mostly checking identity, not exact macros.

The question for each row is:

> If I say the spoken phrase, should Pantheon understand it as the robot match?

If yes, change `decision` to `approved`.
If no, leave or change it to `rejected`.
If it needs a better food, keep `edit_needed` and write the better answer in `notes`.

Macros matter after identity is right. If the identity is wrong, the macros are automatically useless.

Important: `Already Covered` does not mean the robot match is wrong. It usually means Pantheon already has a close product, so the fix is to use the existing row or add an alias, not create a duplicate.

Example:

- You said: `steak cooked`
- Robot found: `Steak tartare`
- Your call: reject, because tartare is raw steak, not cooked steak.

A few concrete calls:

- `almond milk unsweetened` -> `Almond milk, unsweetened, plain, shelf stable`: identity-compatible, but do not add a duplicate if Pantheon already has it.
- `apple` -> `Fruit butters, apple`: reject. Apple butter is not an apple.
- `balsamic vinegar` -> `Vinegar, balsamic`: identity-compatible.
- `coconut juice` -> `Oil, coconut`: reject. Coconut juice/water is not coconut oil.
- `mint` -> `Mint julep`: reject. Mint is an herb; mint julep is a cocktail.
- `tom yum soup` -> `Campbell tomato soup`: reject. Different food.

Decision words:

- `approved`: yes, this is the right identity.
- `rejected`: no, this is the wrong identity.
- `edit_needed`: not sure yet, or it needs a better source/name.

## The Only Table You Edit

| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:sr legacy:168816:whole foods | rejected | Fruit butters, apple | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2514746:prepared common | rejected | Chicken, ground, with additives, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:167671:prepared common | rejected | CRACKER BARREL, macaroni n' cheese plate, from kid's menu | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look. |
| usda:foundation:2685575:whole foods | rejected | Brussels sprouts, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168607:prepared common | rejected | Beef, brisket, whole, separable lean only, all grades, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:foundation:2727567:proteins | rejected | Chicken, thigh, meat and skin, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The calories or macros look physically suspicious. |
| usda:survey fndds:2710169:sauces condiments oils | rejected | Garlic sauce | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:foundation:330458:beverages | rejected | Oil, coconut | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2710837:beverages | rejected | Plum, black, with skin, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:sr legacy:174126:beverages | rejected | Beverages, coffee, instant, regular, half the caffeine | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This is a combined dish, not a simple ingredient. |
| usda:sr legacy:168872:breakfast snacks | rejected | Oat bran, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious. |
| usda:sr legacy:167542:breakfast snacks | rejected | Snacks, granola bars, hard, plain | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. |
| usda:foundation:330137:breakfast snacks | rejected | Yogurt, Greek, plain, nonfat | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2747653:sauces condiments oils | rejected | Beet greens, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:foundation:2727569:proteins | rejected | Chicken, breast, meat and skin, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. The calories or macros look physically suspicious. |
| usda:foundation:2515375:sauces condiments oils | rejected | Nuts, hazelnuts or filberts, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:168914:cuisine staples | rejected | Rice noodles, cooked | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2708088:breakfast snacks | rejected | Cereal or granola bar (Kashi Chewy) | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is brand-like, so it needs a human source check. |
| usda:sr legacy:171184:whole foods | rejected | SMART SOUP, Vietnamese Carrot Lemongrass | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:167715:breakfast snacks | rejected | Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710638:beverages | rejected | Margarita | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious. This is in Luke-preference territory, so it needs a human look. This is brand-like, so it needs a human source check. |
| usda:survey fndds:2706395:prepared common | rejected | Meatballs, Puerto Rican style | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2710643:whole foods | rejected | Mint julep | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The calories or macros look physically suspicious. This is brand-like, so it needs a human source check. |
| usda:survey fndds:2705818:cuisine staples | rejected | Mozzarella cheese, tomato, and basil, with oil and vinegar dressing | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168035:prepared common | rejected | Willow, leaves in oil (Alaska Native) | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. The database result does not contain the words you actually said. |
| usda:foundation:2727573:prepared common | rejected | Beef, tenderloin steak, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:173461:cuisine staples | rejected | Dulce de Leche | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The database result does not contain the words you actually said. An important word from your phrase is missing from the match. An important word from your phrase is missing from the match. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710726:coverage buffer | rejected | Nutritional drink or shake, high protein, ready-to-drink, NFS | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. It is probably fine, but the source says "not further specified." |
| usda:sr legacy:174583:prepared common | rejected | Sandwich spread, pork, beef | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2710756:beverages | rejected | Energy Drink | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:foundation:2346408:sauces condiments oils | rejected | Cabbage, red, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:foundation:2710825:cuisine staples | rejected | Rice, black, unenriched, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:foundation:2710825:sauces condiments oils | rejected | Rice, black, unenriched, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:sr legacy:174069:cuisine staples | rejected | Dip, TOSTITOS, salsa con queso, medium | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:174606:prepared common | rejected | Sausage, turkey, hot, smoked | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:survey fndds:2708964:prepared common | rejected | Sushi roll, shrimp | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:foundation:2684443:prepared common | rejected | Crustaceans, shrimp, farm raised, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:survey fndds:2708805:whole foods | rejected | Pad Thai, meatless | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:sr legacy:174120:beverages | rejected | Beverages, tea, Oolong, brewed | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:survey fndds:2710653:prepared common | rejected | Tom Collins | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious. |
| usda:sr legacy:174547:prepared common | rejected | CAMPBELL'S, Tomato Soup, condensed | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2709735:cuisine staples | rejected | Tomato chili sauce | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:foundation:2514747:prepared common | rejected | Turkey, ground, 93% lean/ 7% fat, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2514747:proteins | rejected | Turkey, ground, 93% lean/ 7% fat, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2708560:prepared common | rejected | Burrito bowl, chicken | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:170164:cuisine staples | rejected | Nuts, chestnuts, chinese, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:sr legacy:168324:proteins | rejected | Pork, bacon, rendered fat, cooked | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. |
| usda:foundation:2727573:proteins | rejected | Beef, tenderloin steak, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:sr legacy:173734:prepared common | rejected | Beans, black, mature seeds, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:foundation:2512380:prepared common | rejected | Rice, brown, long grain, unenriched, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:survey fndds:2708607:prepared common | rejected | Fajita, vegetable | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:survey fndds:2709307:prepared common | rejected | Guacamole, NFS | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. It is probably fine, but the source says "not further specified." An important word from your phrase is missing from the match. |
| usda:sr legacy:167559:prepared common | rejected | Snacks, tortilla chips, nacho cheese | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:foundation:2512381:prepared common | rejected | Rice, white, long grain, unenriched, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:foundation:2710822:cuisine staples | rejected | Arugula, baby, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The database result does not contain the words you actually said. An important word from your phrase is missing from the match. |
| usda:foundation:2515375:coverage buffer | rejected | Nuts, hazelnuts or filberts, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. |
| usda:foundation:2514744:proteins | rejected | Beef, ground, 80% lean meat / 20% fat, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: An important word from your phrase is missing from the match. |
| usda:sr legacy:171288:cuisine staples | rejected | Cheese, Mexican blend | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:sr legacy:168766:whole foods | rejected | Candies, NESTLE, AFTER EIGHT Mints | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check. |
| usda:sr legacy:175180:proteins | rejected | Crustaceans, shrimp, cooked | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. |
| usda:foundation:2685568:whole foods | rejected | Squash, summer, green, zucchini, includes skin, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The phrase is too broad, so the second-best match might be a trap. |
| usda:sr legacy:170086:prepared common | rejected | Beans, pinto, mature seeds, sprouted, raw | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:survey fndds:2705864:prepared common | rejected | Pork, carnitas | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look. |
| usda:foundation:2647442:cuisine staples | rejected | Cheese, queso fresco, solid | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. The phrase is too broad, so the second-best match might be a trap. This is in Luke-preference territory, so it needs a human look. |
| usda:foundation:746777:sauces condiments oils | rejected | Sauce, salsa, ready-to-serve | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:174908:cuisine staples | rejected | Bread, cornbread, dry mix, enriched (includes corn muffin mix) | NO: Leave this as rejected unless you know the robot match is actually what you meant. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap. |
| usda:foundation:1999631:beverages | edit_needed | Almond milk, unsweetened, plain, shelf stable | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2709215:whole foods | edit_needed | Apple, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346414:breakfast snacks | edit_needed | Applesauce, unsweetened, with added vitamin C | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2709223:whole foods | edit_needed | Avocado, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:172241:sauces condiments oils | edit_needed | Vinegar, balsamic | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:1105314:whole foods | edit_needed | Bananas, ripe and slightly ripe, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2709780:whole foods | edit_needed | Basil, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:169458:proteins | edit_needed | Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2258590:whole foods | edit_needed | Peppers, bell, red, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:173734:whole foods | edit_needed | Beans, black, mature seeds, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:175237:cuisine staples | edit_needed | Beans, black, mature seeds, cooked, boiled, with salt | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346411:whole foods | edit_needed | Blueberries, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:747447:whole foods | edit_needed | Broccoli, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710260:sauces condiments oils | edit_needed | Sugar, brown | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710156:sauces condiments oils | edit_needed | Butter, tub | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:331960:proteins | edit_needed | Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2705406:beverages | edit_needed | Soy milk, chocolate | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:169997:whole foods | edit_needed | Coriander (cilantro) leaves, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: The phrase is too broad, so the second-best match might be a trap. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2709782:whole foods | edit_needed | Cilantro, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710182:sauces condiments oils | edit_needed | Coconut oil | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:330458:sauces condiments oils | edit_needed | Oil, coconut | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:170174:beverages | edit_needed | Nuts, coconut water (liquid from coconuts) | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:328841:coverage buffer | edit_needed | Cheese, cottage, lowfat, 2% milkfat | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:328841:proteins | edit_needed | Cheese, cottage, lowfat, 2% milkfat | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346406:whole foods | edit_needed | Cucumber, with peel, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:172183:proteins | edit_needed | Egg, white, raw, fresh | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2646175:proteins | edit_needed | Beef, flank, steak, boneless, choice, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:1104647:whole foods | edit_needed | Garlic, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:169231:whole foods | edit_needed | Ginger root, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:173032:whole foods | edit_needed | Goji berries, dried | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:173032:breakfast snacks | edit_needed | Goji berries, dried | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2705431:proteins | edit_needed | Yogurt, Greek, low fat milk, fruit | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:330137:proteins | edit_needed | Yogurt, Greek, plain, nonfat | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:170006:whole foods | edit_needed | Onions, young green, tops only | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:171917:beverages | edit_needed | Beverages, tea, green, brewed, regular | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:171506:proteins | edit_needed | Turkey, Ground, cooked | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:171255:beverages | edit_needed | Cream, fluid, half and half | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:169640:sauces condiments oils | edit_needed | Honey | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:746780:proteins | edit_needed | Sausage, Italian, pork, mild, cooked, pan-fried | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2708352:cuisine staples | edit_needed | Noodles, cooked | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:174032:proteins | edit_needed | Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168573:whole foods | edit_needed | Lemon grass (citronella), raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2709170:whole foods | edit_needed | Lime, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168156:whole foods | edit_needed | Lime juice, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168156:sauces condiments oils | edit_needed | Lime juice, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:328841:breakfast snacks | edit_needed | Cheese, cottage, lowfat, 2% milkfat | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710281:sauces condiments oils | edit_needed | Honey | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:169661:sauces condiments oils | edit_needed | Syrups, maple | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710186:sauces condiments oils | edit_needed | Olive oil | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:325036:cuisine staples | edit_needed | Cheese, parmesan, grated | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: This touches a Luke-specific preference and should not be auto-written. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2707537:sauces condiments oils | edit_needed | Peanut butter | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2515376:cuisine staples | edit_needed | Peanuts, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:173796:cuisine staples | edit_needed | Beans, pinto, mature seeds, cooked, boiled, with salt | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2646169:proteins | edit_needed | Pork, loin, tenderloin, boneless, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:168250:proteins | edit_needed | Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346397:breakfast snacks | edit_needed | Oats, whole grain, steel cut | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2710726:proteins | edit_needed | Nutritional drink or shake, high protein, ready-to-drink, NFS | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: This touches a Luke-specific preference and should not be auto-written. It is probably fine, but the source says "not further specified." Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:790577:whole foods | edit_needed | Onions, red, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:sr legacy:172240:sauces condiments oils | edit_needed | Vinegar, red wine | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346396:breakfast snacks | edit_needed | Oats, whole grain, rolled, old fashioned | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2727574:proteins | edit_needed | Beef, top sirloin steak, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2346409:whole foods | edit_needed | Strawberries, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:321360:whole foods | edit_needed | Tomatoes, grape, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:2685580:cuisine staples | edit_needed | Tomato, paste, canned, without salt added | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2708202:cuisine staples | edit_needed | Tortilla chips, plain | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:1104962:whole foods | edit_needed | Onions, white, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2708422:cuisine staples | edit_needed | Rice, white, cooked, glutinous | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2707152:proteins | edit_needed | Egg, whole, raw | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:foundation:748967:proteins | edit_needed | Eggs, Grade A, Large, egg whole | COVERED: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected. Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. |
| usda:survey fndds:2707493:cuisine staples | edit_needed | Cashews, NFS | PROBABLY YES: If "robot found" is what you mean when you say the phrase, change decision to approved. Why: It is probably fine, but the source says "not further specified." |
| usda:survey fndds:2709456:cuisine staples | edit_needed | Potato, french fries, NFS | PROBABLY YES: If "robot found" is what you mean when you say the phrase, change decision to approved. Why: It is probably fine, but the source says "not further specified." |
| usda:survey fndds:2709709:cuisine staples | edit_needed | Sweet potato fries, NFS | PROBABLY YES: If "robot found" is what you mean when you say the phrase, change decision to approved. Why: It is probably fine, but the source says "not further specified." |
| usda:sr legacy:173469:sauces condiments oils | edit_needed | Vinegar, cider | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. |
| usda:sr legacy:172146:proteins | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. |
| usda:foundation:2747665:whole foods | edit_needed | Radishes, red, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. |
| usda:foundation:2747661:whole foods | edit_needed | Peppers, jalapeno, seeded, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The phrase is too broad, so the second-best match might be a trap. |
| usda:survey fndds:2709242:prepared common | edit_needed | Mango, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. |
| usda:survey fndds:2708357:cuisine staples | edit_needed | Pasta, cooked | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. |
| usda:survey fndds:2706394:proteins | edit_needed | Steak tartare | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:survey fndds:2708402:cuisine staples | edit_needed | Rice, cooked, NFS | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: Only part of what you said matched this food. It is probably fine, but the source says "not further specified." |
| usda:sr legacy:168422:whole foods | edit_needed | Mushrooms, Chanterelle, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: This is a specific mushroom subtype, not just generic mushrooms. |
| usda:sr legacy:175036:cuisine staples | edit_needed | Tortillas, ready-to-bake or -fry, corn | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:169724:cuisine staples | edit_needed | Wheat flour, white, tortilla mix, enriched | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:170693:proteins | edit_needed | Fast foods, hamburger; single, regular patty; plain | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:169103:whole foods | edit_needed | Orange peel, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:171328:whole foods | edit_needed | Spices, oregano, dried | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap. |
| usda:sr legacy:168561:whole foods | edit_needed | Pickle relish, sweet | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:170086:whole foods | edit_needed | Beans, pinto, mature seeds, sprouted, raw | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:169742:cuisine staples | edit_needed | Rice noodles, dry | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:survey fndds:2706060:proteins | edit_needed | Chicken wing, rotisserie | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:171016:sauces condiments oils | edit_needed | Oil, sesame, salad or cooking | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:174612:proteins | edit_needed | Turkey, breast, smoked, lemon pepper flavor, 97% fat-free | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:168912:cuisine staples | edit_needed | Spaghetti, spinach, cooked | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:survey fndds:2710104:whole foods | edit_needed | Zucchini, pickled | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:173722:proteins | edit_needed | Salmon nuggets, cooked as purchased, unheated | YOUR CALL: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:survey fndds:2709217:breakfast snacks | edit_needed | Applesauce, unsweetened | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:sr legacy:172387:proteins | edit_needed | Chicken, broilers or fryers, thigh, meat only, cooked, fried | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:sr legacy:173423:proteins | edit_needed | Egg, whole, cooked, fried | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2705644:breakfast snacks | edit_needed | Ice cream cookie sandwich | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2708818:cuisine staples | edit_needed | Macaroni or noodles with cheese and meat | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:sr legacy:174278:sauces condiments oils | edit_needed | Soy sauce made from soy (tamari) | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is a combined dish, not a simple ingredient. |
| usda:sr legacy:172147:prepared common | edit_needed | Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, raw | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. |
| usda:sr legacy:173263:whole foods | edit_needed | Rice, brown, parboiled, cooked, UNCLE BENS | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is brand-like, so it needs a human source check. |
| usda:foundation:2514745:proteins | edit_needed | Pork, ground, raw | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:172986:breakfast snacks | edit_needed | Cereals ready-to-eat, QUAKER, MOTHER'S Toasted Oat Bran cereal | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is brand-like, so it needs a human source check. |
| usda:survey fndds:2705640:breakfast snacks | edit_needed | Ice cream candy bar | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. |
| usda:sr legacy:173889:breakfast snacks | edit_needed | Cereals ready-to-eat, POST, Honeycomb Cereal | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. |
| usda:sr legacy:167695:sauces condiments oils | edit_needed | Mayonnaise, made with tofu | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. |
| usda:sr legacy:169031:cuisine staples | edit_needed | ON THE BORDER, Mexican rice | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is brand-like, so it needs a human source check. |
| usda:foundation:2685582:whole foods | edit_needed | Tomato, puree, canned | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. |
| usda:sr legacy:170733:cuisine staples | edit_needed | TACO BELL, Soft Taco with steak | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: Only part of what you said matched this food. This is brand-like, so it needs a human source check. |
| usda:sr legacy:169032:cuisine staples | edit_needed | ON THE BORDER, refried beans | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is brand-like, so it needs a human source check. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:171524:prepared common | edit_needed | Chicken, broiler, rotisserie, BBQ, skin | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2706167:proteins | edit_needed | Hot dog, beef | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:169857:prepared common | edit_needed | CARRABBA'S ITALIAN GRILL, chicken parmesan without cavatappi pasta | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:170717:cuisine staples | edit_needed | McDONALD'S, Hamburger | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: Only part of what you said matched this food. This is brand-like, so it needs a human source check. |
| usda:sr legacy:174090:cuisine staples | edit_needed | Rolls, hamburger or hot dog, whole wheat | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2708758:prepared common | edit_needed | Lasagna, meatless | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2708804:prepared common | edit_needed | Pad Thai, NFS | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. It is probably fine, but the source says "not further specified." This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:173170:coverage buffer | edit_needed | Beverages, SLIMFAST, Meal replacement,  High Protein Shake, Ready-To-Drink, 3-2-1 plan | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2706437:prepared common | edit_needed | Chicken curry | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:172461:proteins | edit_needed | MORI-NU, Tofu, silken, firm | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This is brand-like, so it needs a human source check. This is brand-like, so it needs a human source check. |
| usda:sr legacy:173180:proteins | edit_needed | Beverages, Protein powder whey based | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. |
| usda:sr legacy:174523:sauces condiments oils | edit_needed | Sauce, barbecue | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2706457:sauces condiments oils | edit_needed | Fish sauce | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:172886:sauces condiments oils | edit_needed | Sauce, hoisin, ready-to-serve | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2709744:sauces condiments oils | edit_needed | Hot Thai sauce | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:foundation:332282:cuisine staples | edit_needed | Sauce, pasta, spaghetti/marinara, ready-to-serve | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:171575:sauces condiments oils | edit_needed | Sauce, peanut, made from coconut, water, sugar, peanuts | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2707442:sauces condiments oils | edit_needed | Soy sauce | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:survey fndds:2706470:prepared common | edit_needed | Spaghetti sauce with meat | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. This is a combined dish, not a simple ingredient. This is in Luke-preference territory, so it needs a human look. |
| usda:survey fndds:2710175:sauces condiments oils | edit_needed | Pesto sauce | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: This touches a Luke-specific preference and should not be auto-written. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:173344:proteins | edit_needed | Pulled pork in barbecue sauce | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |
| usda:sr legacy:171186:sauces condiments oils | edit_needed | Sauce, hot chile, sriracha | NOT AUTO: Do not approve from this packet unless you are confident the source and serving are right. Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient. |

## Plain-English Detail

## Obvious No (66)

These are rows where the robot match is probably not what you meant, or the system already found a strong risk.

### You said: apple

- Robot found: Fruit butters, apple
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 173 cal, 0.39P, 42.5C, 0.3F
- Natural speech units: cup=282g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=17g, tbsp=17g
- Source: usda / SR Legacy / 168816
- Candidate key: `usda:sr legacy:168816:whole foods`

### You said: banh mi chicken

- Robot found: Chicken, ground, with additives, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 138 cal, 17.9P, 0C, 7.16F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2514746
- Candidate key: `usda:foundation:2514746:prepared common`

### You said: bbq plate

- Robot found: CRACKER BARREL, macaroni n' cheese plate, from kid's menu
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 192 cal, 6.46P, 15.6C, 11.5F
- Natural speech units: cup=149g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=257g
- Source: usda / SR Legacy / 167671
- Candidate key: `usda:sr legacy:167671:prepared common`

### You said: bean sprouts

- Robot found: Brussels sprouts, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 48.8 cal, 3.98P, 9.62C, 0.56F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2685575
- Candidate key: `usda:foundation:2685575:whole foods`

### You said: brisket sandwich

- Robot found: Beef, brisket, whole, separable lean only, all grades, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 157 cal, 20.7P, 0.6C, 7.37F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168607
- Candidate key: `usda:sr legacy:168607:prepared common`

### You said: chicken thigh raw

- Robot found: Chicken, thigh, meat and skin, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The calories or macros look physically suspicious.
- Macros, only after identity is right: 193 cal, 17.1P, -0.17C, 13.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2727567
- Candidate key: `usda:foundation:2727567:proteins`

### You said: chili garlic sauce

- Robot found: Garlic sauce
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 683 cal, 1.43P, 2.87C, 74.02F
- Natural speech units: dipping size container=28g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2710169
- Candidate key: `usda:survey fndds:2710169:sauces condiments oils`

### You said: coconut juice

- Robot found: Oil, coconut
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 833 cal, 0P, 0.84C, 99.1F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=11.6g
- Source: usda / Foundation / 330458
- Candidate key: `usda:foundation:330458:beverages`

### You said: coffee black

- Robot found: Plum, black, with skin, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 52.7 cal, 0.58P, 13.5C, 0.28F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2710837
- Candidate key: `usda:foundation:2710837:beverages`

### You said: coffee with half and half

- Robot found: Beverages, coffee, instant, regular, half the caffeine
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 352 cal, 14.4P, 73.2C, 0.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet=2g, tsp=1g
- Source: usda / SR Legacy / 174126
- Candidate key: `usda:sr legacy:174126:beverages`

### You said: Cracklin Oat Bran

- Robot found: Oat bran, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious.
- Macros, only after identity is right: 246 cal, 17.3P, 66.2C, 7.03F
- Natural speech units: cup=94g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168872
- Candidate key: `usda:sr legacy:168872:breakfast snacks`

### You said: granola

- Robot found: Snacks, granola bars, hard, plain
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 471 cal, 10.1P, 64.4C, 19.8F
- Natural speech units: bar=21g, bar 1 oz=28g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 167542
- Candidate key: `usda:sr legacy:167542:breakfast snacks`

### You said: Greek yogurt bar

- Robot found: Yogurt, Greek, plain, nonfat
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 61 cal, 10.3P, 3.64C, 0.37F
- Natural speech units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 330137
- Candidate key: `usda:foundation:330137:breakfast snacks`

### You said: green curry paste

- Robot found: Beet greens, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 26.4 cal, 1.61P, 4.66C, 0.14F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2747653
- Candidate key: `usda:foundation:2747653:sauces condiments oils`

### You said: grilled chicken breast

- Robot found: Chicken, breast, meat and skin, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food. The calories or macros look physically suspicious.
- Macros, only after identity is right: 133 cal, 21.4P, -0.43C, 4.78F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2727569
- Candidate key: `usda:foundation:2727569:proteins`

### You said: hazelnut stevia drops

- Robot found: Nuts, hazelnuts or filberts, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 602 cal, 13.5P, 26.5C, 53.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2515375
- Candidate key: `usda:foundation:2515375:sauces condiments oils`

### You said: jasmine rice cooked

- Robot found: Rice noodles, cooked
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 108 cal, 1.79P, 24C, 0.2F
- Natural speech units: cup=176g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168914
- Candidate key: `usda:sr legacy:168914:cuisine staples`

### You said: Kashi cereal

- Robot found: Cereal or granola bar (Kashi Chewy)
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 390 cal, 16.67P, 63.42C, 7.69F
- Natural speech units: bar=78g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708088
- Candidate key: `usda:survey fndds:2708088:breakfast snacks`

### You said: lemongrass

- Robot found: SMART SOUP, Vietnamese Carrot Lemongrass
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 44 cal, 1.3P, 8.2C, 1.06F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz 1 pouch=28.3g
- Source: usda / SR Legacy / 171184
- Candidate key: `usda:sr legacy:171184:whole foods`

### You said: Magic Spoon cereal

- Robot found: Cereals ready-to-eat, POST, Shredded Wheat n' Bran, spoon-size
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 339 cal, 10.9P, 80.6C, 2.06F
- Natural speech units: cup 1 nlea serving=47.2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 167715
- Candidate key: `usda:sr legacy:167715:breakfast snacks`

### You said: margarita on the rocks

- Robot found: Margarita
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious. This is in Luke-preference territory, so it needs a human look. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 122 cal, 0.08P, 16.06C, 0.08F
- Natural speech units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2710638
- Candidate key: `usda:survey fndds:2710638:beverages`

### You said: meatballs

- Robot found: Meatballs, Puerto Rican style
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 225 cal, 14.33P, 6.9C, 15.31F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, meatball=28g, meatball with sauce=50g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2706395
- Candidate key: `usda:survey fndds:2706395:prepared common`

### You said: mint

- Robot found: Mint julep
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The calories or macros look physically suspicious. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 187 cal, 0P, 5.75C, 0.01F
- Natural speech units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2710643
- Candidate key: `usda:survey fndds:2710643:whole foods`

### You said: mozzarella cheese

- Robot found: Mozzarella cheese, tomato, and basil, with oil and vinegar dressing
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 139 cal, 7.17P, 3.86C, 10.87F
- Natural speech units: cup=160g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2705818
- Candidate key: `usda:survey fndds:2705818:cuisine staples`

### You said: nuoc cham

- Robot found: Willow, leaves in oil (Alaska Native)
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. The database result does not contain the words you actually said.
- Macros, only after identity is right: 592 cal, 2.6P, 8.1C, 61F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168035
- Candidate key: `usda:sr legacy:168035:prepared common`

### You said: pho beef

- Robot found: Beef, tenderloin steak, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 149 cal, 21.1P, 0.18C, 6.46F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2727573
- Candidate key: `usda:foundation:2727573:prepared common`

### You said: pico de gallo

- Robot found: Dulce de Leche
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The database result does not contain the words you actually said. An important word from your phrase is missing from the match. An important word from your phrase is missing from the match. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 315 cal, 6.84P, 55.4C, 7.35F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=19g
- Source: usda / SR Legacy / 173461
- Candidate key: `usda:sr legacy:173461:cuisine staples`

### You said: protein shake dextrose

- Robot found: Nutritional drink or shake, high protein, ready-to-drink, NFS
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. It is probably fine, but the source says "not further specified."
- Macros, only after identity is right: 61 cal, 6.59P, 0.85C, 3.38F
- Natural speech units: bottle 14 fl oz myoplex=448g, bottle 20 fl oz monster milk=640g, bottle or box nfs=544g, cup=256g, fl oz=32g, g=1g, kg=1000g, lb=453.59g
- Source: usda / Survey (FNDDS) / 2710726
- Candidate key: `usda:survey fndds:2710726:coverage buffer`

### You said: pulled pork sandwich

- Robot found: Sandwich spread, pork, beef
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 235 cal, 7.66P, 11.9C, 17.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / SR Legacy / 174583
- Candidate key: `usda:sr legacy:174583:prepared common`

### You said: REBBL drink

- Robot found: Energy Drink
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 43 cal, 0.46P, 10.23C, 0F
- Natural speech units: can or bottle 12 fl oz=372g, can or bottle 16 fl oz=496g, can or bottle 24 fl oz=744g, can or bottle 32 fl oz=992g, can or bottle 8 fl oz=248g, cup=248g, fl oz=31g, g=1g
- Source: usda / Survey (FNDDS) / 2710756
- Candidate key: `usda:survey fndds:2710756:beverages`

### You said: red curry paste

- Robot found: Cabbage, red, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 29.9 cal, 1.24P, 6.79C, 0.21F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346408
- Candidate key: `usda:foundation:2346408:sauces condiments oils`

### You said: rice paper wrapper

- Robot found: Rice, black, unenriched, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 361 cal, 7.57P, 77.2C, 3.44F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, wrapper=22g
- Source: usda / Foundation / 2710825
- Candidate key: `usda:foundation:2710825:cuisine staples`

### You said: rice vinegar

- Robot found: Rice, black, unenriched, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 361 cal, 7.57P, 77.2C, 3.44F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2710825
- Candidate key: `usda:foundation:2710825:sauces condiments oils`

### You said: salsa

- Robot found: Dip, TOSTITOS, salsa con queso, medium
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 133 cal, 2.92P, 11.7C, 8.26F
- Natural speech units: cup=250g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / SR Legacy / 174069
- Candidate key: `usda:sr legacy:174069:cuisine staples`

### You said: smoked turkey sandwich

- Robot found: Sausage, turkey, hot, smoked
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 158 cal, 15P, 4.65C, 8.75F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 174606
- Candidate key: `usda:sr legacy:174606:prepared common`

### You said: spring roll shrimp

- Robot found: Sushi roll, shrimp
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 100 cal, 7.01P, 15.67C, 0.55F
- Natural speech units: cup=150g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=30g, roll=85g
- Source: usda / Survey (FNDDS) / 2708964
- Candidate key: `usda:survey fndds:2708964:prepared common`

### You said: summer roll shrimp

- Robot found: Crustaceans, shrimp, farm raised, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 75.7 cal, 15.6P, 0.49C, 0.8F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, roll=85g
- Source: usda / Foundation / 2684443
- Candidate key: `usda:foundation:2684443:prepared common`

### You said: thai basil

- Robot found: Pad Thai, meatless
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 165 cal, 5.79P, 16.34C, 9.2F
- Natural speech units: cup=200g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708805
- Candidate key: `usda:survey fndds:2708805:whole foods`

### You said: thai iced tea

- Robot found: Beverages, tea, Oolong, brewed
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 1 cal, 0P, 0.15C, 0F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 174120
- Candidate key: `usda:sr legacy:174120:beverages`

### You said: tom kha soup

- Robot found: Tom Collins
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. The calories or macros look physically suspicious.
- Macros, only after identity is right: 123 cal, 0.08P, 16.11C, 0.08F
- Natural speech units: drink=225g, fl oz=30g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2710653
- Candidate key: `usda:survey fndds:2710653:prepared common`

### You said: tom yum soup

- Robot found: CAMPBELL'S, Tomato Soup, condensed
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 71 cal, 1.46P, 15.2C, 0.44F
- Natural speech units: cup condensed=248g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 174547
- Candidate key: `usda:sr legacy:174547:prepared common`

### You said: tomato sauce

- Robot found: Tomato chili sauce
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 92 cal, 2.5P, 19.79C, 0.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- Source: usda / Survey (FNDDS) / 2709735
- Candidate key: `usda:survey fndds:2709735:cuisine staples`

### You said: turkey bolognese

- Robot found: Turkey, ground, 93% lean/ 7% fat, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 158 cal, 17.3P, 0C, 9.59F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2514747
- Candidate key: `usda:foundation:2514747:prepared common`

### You said: turkey meatballs

- Robot found: Turkey, ground, 93% lean/ 7% fat, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 158 cal, 17.3P, 0C, 9.59F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, meatball=28g, oz=28.35g
- Source: usda / Foundation / 2514747
- Candidate key: `usda:foundation:2514747:proteins`

### You said: vermicelli bowl chicken

- Robot found: Burrito bowl, chicken
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 161 cal, 21.04P, 0.27C, 8.11F
- Natural speech units: cup=120g, g=1g, item any size=225g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708560
- Candidate key: `usda:survey fndds:2708560:prepared common`

### You said: water chestnuts

- Robot found: Nuts, chestnuts, chinese, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 224 cal, 4.2P, 49.1C, 1.11F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 170164
- Candidate key: `usda:sr legacy:170164:cuisine staples`

### You said: bacon cooked

- Robot found: Pork, bacon, rendered fat, cooked
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 898 cal, 0.07P, 0C, 99.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168324
- Candidate key: `usda:sr legacy:168324:proteins`

### You said: barbacoa beef

- Robot found: Beef, tenderloin steak, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 149 cal, 21.1P, 0.18C, 6.46F
- Natural speech units: bar=65g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2727573
- Candidate key: `usda:foundation:2727573:proteins`

### You said: Chipotle black beans

- Robot found: Beans, black, mature seeds, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 341 cal, 21.6P, 62.4C, 1.42F
- Natural speech units: chip=2g, cup=194g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=12.1g
- Source: usda / SR Legacy / 173734
- Candidate key: `usda:sr legacy:173734:prepared common`

### You said: Chipotle brown rice

- Robot found: Rice, brown, long grain, unenriched, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 368 cal, 7.25P, 76.7C, 3.31F
- Natural speech units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2512380
- Candidate key: `usda:foundation:2512380:prepared common`

### You said: Chipotle fajita vegetables

- Robot found: Fajita, vegetable
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 166 cal, 3.22P, 20.43C, 7.84F
- Natural speech units: chip=2g, cup=120g, fajita=95g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708607
- Candidate key: `usda:survey fndds:2708607:prepared common`

### You said: Chipotle guacamole

- Robot found: Guacamole, NFS
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. It is probably fine, but the source says "not further specified." An important word from your phrase is missing from the match.
- Macros, only after identity is right: 155 cal, 1.95P, 8.45C, 14.18F
- Natural speech units: chip=2g, g=1g, individual container=70g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / Survey (FNDDS) / 2709307
- Candidate key: `usda:survey fndds:2709307:prepared common`

### You said: Chipotle tortilla chips

- Robot found: Snacks, tortilla chips, nacho cheese
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 519 cal, 7.36P, 60.8C, 27.4F
- Natural speech units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- Source: usda / SR Legacy / 167559
- Candidate key: `usda:sr legacy:167559:prepared common`

### You said: Chipotle white rice

- Robot found: Rice, white, long grain, unenriched, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 370 cal, 7.04P, 80.3C, 1.03F
- Natural speech units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2512381
- Candidate key: `usda:foundation:2512381:prepared common`

### You said: fajita vegetables

- Robot found: Arugula, baby, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The database result does not contain the words you actually said. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 25.9 cal, 1.65P, 5.37C, 0.33F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2710822
- Candidate key: `usda:foundation:2710822:cuisine staples`

### You said: hazelnut stevia drops

- Robot found: Nuts, hazelnuts or filberts, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 602 cal, 13.5P, 26.5C, 53.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2515375
- Candidate key: `usda:foundation:2515375:coverage buffer`

### You said: lean ground beef taco meat

- Robot found: Beef, ground, 80% lean meat / 20% fat, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: An important word from your phrase is missing from the match.
- Macros, only after identity is right: 248 cal, 17.5P, 0C, 19.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2514744
- Candidate key: `usda:foundation:2514744:proteins`

### You said: Mexican crema

- Robot found: Cheese, Mexican blend
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 384 cal, 23.5P, 0.13C, 32.1F
- Natural speech units: can=355g, cup shredded=112g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 171288
- Candidate key: `usda:sr legacy:171288:cuisine staples`

### You said: mint

- Robot found: Candies, NESTLE, AFTER EIGHT Mints
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 432 cal, 1.67P, 79.5C, 11.9F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=8.4g, serving 5 mints=42g
- Source: usda / SR Legacy / 168766
- Candidate key: `usda:sr legacy:168766:whole foods`

### You said: shrimp cooked

- Robot found: Crustaceans, shrimp, cooked
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 99 cal, 24P, 0.2C, 0.28F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 175180
- Candidate key: `usda:sr legacy:175180:proteins`

### You said: zucchini

- Robot found: Squash, summer, green, zucchini, includes skin, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 16 cal, 0.98P, 3.27C, 0.21F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2685568
- Candidate key: `usda:foundation:2685568:whole foods`

### You said: Chipotle pinto beans

- Robot found: Beans, pinto, mature seeds, sprouted, raw
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 62 cal, 5.25P, 11.6C, 0.9F
- Natural speech units: chip=2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 170086
- Candidate key: `usda:sr legacy:170086:prepared common`

### You said: Chipotle carnitas

- Robot found: Pork, carnitas
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 271 cal, 24.57P, 0C, 18.33F
- Natural speech units: chip=2g, cup=135g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz yields=20g
- Source: usda / Survey (FNDDS) / 2705864
- Candidate key: `usda:survey fndds:2705864:prepared common`

### You said: queso

- Robot found: Cheese, queso fresco, solid
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. The phrase is too broad, so the second-best match might be a trap. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 297 cal, 18.9P, 2.96C, 23.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2647442
- Candidate key: `usda:foundation:2647442:cuisine staples`

### You said: bbq sauce

- Robot found: Sauce, salsa, ready-to-serve
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 29 cal, 1.44P, 6.74C, 0.19F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 746777
- Candidate key: `usda:foundation:746777:sauces condiments oils`

### You said: cornbread

- Robot found: Bread, cornbread, dry mix, enriched (includes corn muffin mix)
- My suggested call: NO
- What you do: Leave this as rejected unless you know the robot match is actually what you meant.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 418 cal, 7P, 69.5C, 12.2F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, package 8 5 oz=241g
- Source: usda / SR Legacy / 174908
- Candidate key: `usda:sr legacy:174908:cuisine staples`

## Already Covered (69)

These may be identity-compatible, but Pantheon already has a close row. The job here is only to catch true mismatches; compatible duplicates stay edit_needed.

### You said: almond milk unsweetened

- Robot found: Almond milk, unsweetened, plain, shelf stable
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 14.6 cal, 0.56P, 0.34C, 1.22F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 1999631
- Candidate key: `usda:foundation:1999631:beverages`

### You said: apple

- Robot found: Apple, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 61 cal, 0.17P, 14.8C, 0.15F
- Natural speech units: cup=125g, extra large=295g, g=1g, kg=1000g, large=242g, lb=453.59g, medium=200g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2709215
- Candidate key: `usda:survey fndds:2709215:whole foods`

### You said: applesauce

- Robot found: Applesauce, unsweetened, with added vitamin C
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 46.4 cal, 0.27P, 12.3C, 0.16F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346414
- Candidate key: `usda:foundation:2346414:breakfast snacks`

### You said: avocado

- Robot found: Avocado, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 160 cal, 2P, 8.53C, 14.66F
- Natural speech units: cup=150g, cup mashed or pureed=230g, fruit=150g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=15g
- Source: usda / Survey (FNDDS) / 2709223
- Candidate key: `usda:survey fndds:2709223:whole foods`

### You said: balsamic vinegar

- Robot found: Vinegar, balsamic
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 88 cal, 0.49P, 17C, 0F
- Natural speech units: cup=255g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g, tsp=5.3g
- Source: usda / SR Legacy / 172241
- Candidate key: `usda:sr legacy:172241:sauces condiments oils`

### You said: banana

- Robot found: Bananas, ripe and slightly ripe, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 97 cal, 0.74P, 23C, 0.29F
- Natural speech units: banana=115g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 1105314
- Candidate key: `usda:foundation:1105314:whole foods`

### You said: basil

- Robot found: Basil, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 23 cal, 3.15P, 2.65C, 0.64F
- Natural speech units: cup=24g, g=1g, kg=1000g, lb=453.59g, leaf=0.5g, oz=28.35g, tbsp=3g
- Source: usda / Survey (FNDDS) / 2709780
- Candidate key: `usda:survey fndds:2709780:whole foods`

### You said: beef sirloin cooked

- Robot found: Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 219 cal, 29P, 0C, 10.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, steak yield from 532 g raw meat=393g
- Source: usda / SR Legacy / 169458
- Candidate key: `usda:sr legacy:169458:proteins`

### You said: bell pepper

- Robot found: Peppers, bell, red, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 27 cal, 0.9P, 6.65C, 0.13F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2258590
- Candidate key: `usda:foundation:2258590:whole foods`

### You said: black beans

- Robot found: Beans, black, mature seeds, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 341 cal, 21.6P, 62.4C, 1.42F
- Natural speech units: cup=194g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=12.1g
- Source: usda / SR Legacy / 173734
- Candidate key: `usda:sr legacy:173734:whole foods`

### You said: black beans cooked

- Robot found: Beans, black, mature seeds, cooked, boiled, with salt
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 132 cal, 8.86P, 23.7C, 0.54F
- Natural speech units: cup=172g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 175237
- Candidate key: `usda:sr legacy:175237:cuisine staples`

### You said: blueberries

- Robot found: Blueberries, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 57.4 cal, 0.7P, 14.6C, 0.31F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346411
- Candidate key: `usda:foundation:2346411:whole foods`

### You said: broccoli

- Robot found: Broccoli, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 31 cal, 2.57P, 6.27C, 0.34F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 747447
- Candidate key: `usda:foundation:747447:whole foods`

### You said: brown sugar

- Robot found: Sugar, brown
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 380 cal, 0.12P, 98.09C, 0F
- Natural speech units: cup nfs=220g, g=1g, guideline amount per fl oz of beverage=1.4g, kg=1000g, lb=453.59g, oz=28.35g, teaspoon nfs=4.6g
- Source: usda / Survey (FNDDS) / 2710260
- Candidate key: `usda:survey fndds:2710260:sauces condiments oils`

### You said: butter

- Robot found: Butter, tub
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 731 cal, 0.49P, 0C, 78.3F
- Natural speech units: cup=224g, g=1g, guideline amount on large sandwich=28g, guideline amount on regular sandwich=14g, guideline amount per slice of bread roll=7g, individual container=5g, kg=1000g, lb=453.59g
- Source: usda / Survey (FNDDS) / 2710156
- Candidate key: `usda:survey fndds:2710156:sauces condiments oils`

### You said: chicken breast cooked

- Robot found: Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 166 cal, 32.1P, 0C, 3.24F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=174g
- Source: usda / Foundation / 331960
- Candidate key: `usda:foundation:331960:proteins`

### You said: chocolate soy milk

- Robot found: Soy milk, chocolate
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 64 cal, 3.35P, 8.32C, 2.03F
- Natural speech units: cup=244g, fl oz=30.5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2705406
- Candidate key: `usda:survey fndds:2705406:beverages`

### You said: cilantro

- Robot found: Coriander (cilantro) leaves, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: The phrase is too broad, so the second-best match might be a trap. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 23 cal, 2.13P, 3.67C, 0.52F
- Natural speech units: cup=16g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, sprigs=2.22g
- Source: usda / SR Legacy / 169997
- Candidate key: `usda:sr legacy:169997:whole foods`

### You said: cilantro

- Robot found: Cilantro, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 23 cal, 2.13P, 3.67C, 0.52F
- Natural speech units: cup=16g, g=1g, guideline amount per item=0.3g, kg=1000g, lb=453.59g, oz=28.35g, sprig=1g
- Source: usda / Survey (FNDDS) / 2709782
- Candidate key: `usda:survey fndds:2709782:whole foods`

### You said: coconut oil

- Robot found: Coconut oil
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 895 cal, 0P, 0.84C, 99.1F
- Natural speech units: cup=224g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14g
- Source: usda / Survey (FNDDS) / 2710182
- Candidate key: `usda:survey fndds:2710182:sauces condiments oils`

### You said: coconut oil

- Robot found: Oil, coconut
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 833 cal, 0P, 0.84C, 99.1F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=11.6g
- Source: usda / Foundation / 330458
- Candidate key: `usda:foundation:330458:sauces condiments oils`

### You said: coconut water

- Robot found: Nuts, coconut water (liquid from coconuts)
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 19 cal, 0.72P, 3.71C, 0.2F
- Natural speech units: coconut yields=206g, cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / SR Legacy / 170174
- Candidate key: `usda:sr legacy:170174:beverages`

### You said: cottage cheese bowl

- Robot found: Cheese, cottage, lowfat, 2% milkfat
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 84 cal, 11P, 4.31C, 2.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 328841
- Candidate key: `usda:foundation:328841:coverage buffer`

### You said: cottage cheese nonfat

- Robot found: Cheese, cottage, lowfat, 2% milkfat
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 84 cal, 11P, 4.31C, 2.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 328841
- Candidate key: `usda:foundation:328841:proteins`

### You said: cucumber

- Robot found: Cucumber, with peel, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 13.9 cal, 0.63P, 2.95C, 0.18F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346406
- Candidate key: `usda:foundation:2346406:whole foods`

### You said: egg white

- Robot found: Egg, white, raw, fresh
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 52 cal, 10.9P, 0.73C, 0.17F
- Natural speech units: cup=243g, egg=50g, g=1g, kg=1000g, large=33g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 172183
- Candidate key: `usda:sr legacy:172183:proteins`

### You said: flank steak

- Robot found: Beef, flank, steak, boneless, choice, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 170 cal, 20.1P, 0C, 9.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2646175
- Candidate key: `usda:foundation:2646175:proteins`

### You said: garlic

- Robot found: Garlic, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 143 cal, 6.62P, 28.2C, 0.38F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 1104647
- Candidate key: `usda:foundation:1104647:whole foods`

### You said: ginger

- Robot found: Ginger root, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 80 cal, 1.82P, 17.8C, 0.75F
- Natural speech units: cup slices 1 dia=96g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, slices 1 dia=2.2g, tsp=2g
- Source: usda / SR Legacy / 169231
- Candidate key: `usda:sr legacy:169231:whole foods`

### You said: goji berries dried

- Robot found: Goji berries, dried
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 349 cal, 14.3P, 77.1C, 0.39F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=5.6g
- Source: usda / SR Legacy / 173032
- Candidate key: `usda:sr legacy:173032:whole foods`

### You said: goji berries dried

- Robot found: Goji berries, dried
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 349 cal, 14.3P, 77.1C, 0.39F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=5.6g
- Source: usda / SR Legacy / 173032
- Candidate key: `usda:sr legacy:173032:breakfast snacks`

### You said: Greek yogurt low fat

- Robot found: Yogurt, Greek, low fat milk, fruit
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 91 cal, 9.11P, 10.78C, 1.33F
- Natural speech units: 5 3 oz container=150g, 6 oz container=170g, container nfs=150g, cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2705431
- Candidate key: `usda:survey fndds:2705431:proteins`

### You said: Greek yogurt nonfat

- Robot found: Yogurt, Greek, plain, nonfat
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 61 cal, 10.3P, 3.64C, 0.37F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 330137
- Candidate key: `usda:foundation:330137:proteins`

### You said: green onion

- Robot found: Onions, young green, tops only
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 27 cal, 0.97P, 5.74C, 0.47F
- Natural speech units: cup chopped=71g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, stalk=12g, tbsp=6g
- Source: usda / SR Legacy / 170006
- Candidate key: `usda:sr legacy:170006:whole foods`

### You said: green tea

- Robot found: Beverages, tea, green, brewed, regular
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 1 cal, 0.22P, 0C, 0F
- Natural speech units: cup=245g, fl oz=29.6g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 171917
- Candidate key: `usda:sr legacy:171917:beverages`

### You said: ground turkey cooked

- Robot found: Turkey, Ground, cooked
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 203 cal, 27.4P, 0C, 10.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty 4 oz raw yield after cooking=82g, unit yield from 1 lb raw=330g
- Source: usda / SR Legacy / 171506
- Candidate key: `usda:sr legacy:171506:proteins`

### You said: half and half

- Robot found: Cream, fluid, half and half
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 131 cal, 3.13P, 4.3C, 11.5F
- Natural speech units: container individual 5 fl oz=15g, cup=242g, fl oz=30.2g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / SR Legacy / 171255
- Candidate key: `usda:sr legacy:171255:beverages`

### You said: honey

- Robot found: Honey
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 304 cal, 0.3P, 82.4C, 0F
- Natural speech units: cup=339g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 0 5 oz=14g, tbsp=21g
- Source: usda / SR Legacy / 169640
- Candidate key: `usda:sr legacy:169640:sauces condiments oils`

### You said: Italian sausage cooked

- Robot found: Sausage, Italian, pork, mild, cooked, pan-fried
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 322 cal, 18.2P, 2.15C, 26.2F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 746780
- Candidate key: `usda:foundation:746780:proteins`

### You said: lasagna noodles cooked

- Robot found: Noodles, cooked
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 137 cal, 4.51P, 25.01C, 2.06F
- Natural speech units: cup cooked=160g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz dry yields=75g
- Source: usda / Survey (FNDDS) / 2708352
- Candidate key: `usda:survey fndds:2708352:cuisine staples`

### You said: lean ground beef cooked

- Robot found: Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 250 cal, 25.9P, 0C, 15.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty yield from 1 4 lb raw meat=77g
- Source: usda / SR Legacy / 174032
- Candidate key: `usda:sr legacy:174032:proteins`

### You said: lemon

- Robot found: Lemon grass (citronella), raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 99 cal, 1.82P, 25.3C, 0.49F
- Natural speech units: cup=67g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=4.8g
- Source: usda / SR Legacy / 168573
- Candidate key: `usda:sr legacy:168573:whole foods`

### You said: lime

- Robot found: Lime, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 30 cal, 0.7P, 10.54C, 0.2F
- Natural speech units: cup=200g, fruit=65g, g=1g, kg=1000g, lb=453.59g, lime=67g, oz=28.35g, slice or wedge=8g
- Source: usda / Survey (FNDDS) / 2709170
- Candidate key: `usda:survey fndds:2709170:whole foods`

### You said: lime

- Robot found: Lime juice, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 25 cal, 0.42P, 8.42C, 0.07F
- Natural speech units: cup=242g, fl oz=30.8g, g=1g, kg=1000g, lb=453.59g, lime yields=44g, oz=28.35g
- Source: usda / SR Legacy / 168156
- Candidate key: `usda:sr legacy:168156:whole foods`

### You said: lime juice

- Robot found: Lime juice, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 25 cal, 0.42P, 8.42C, 0.07F
- Natural speech units: cup=242g, fl oz=30.8g, g=1g, kg=1000g, lb=453.59g, lime yields=44g, oz=28.35g
- Source: usda / SR Legacy / 168156
- Candidate key: `usda:sr legacy:168156:sauces condiments oils`

### You said: low fat cottage cheese

- Robot found: Cheese, cottage, lowfat, 2% milkfat
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 84 cal, 11P, 4.31C, 2.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 328841
- Candidate key: `usda:foundation:328841:breakfast snacks`

### You said: manuka honey

- Robot found: Honey
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 304 cal, 0.3P, 82.4C, 0F
- Natural speech units: cup=320g, g=1g, guideline amount per fl oz of beverage=2.4g, guideline amount per slice of bread roll=10g, kg=1000g, lb=453.59g, oz=28.35g, single serving container=14g
- Source: usda / Survey (FNDDS) / 2710281
- Candidate key: `usda:survey fndds:2710281:sauces condiments oils`

### You said: maple syrup

- Robot found: Syrups, maple
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 260 cal, 0.04P, 67C, 0.06F
- Natural speech units: cup=315g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving 1 4 cup=83g, tbsp=20g
- Source: usda / SR Legacy / 169661
- Candidate key: `usda:sr legacy:169661:sauces condiments oils`

### You said: olive oil

- Robot found: Olive oil
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 900 cal, 0P, 0C, 100F
- Natural speech units: cup=224g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14g
- Source: usda / Survey (FNDDS) / 2710186
- Candidate key: `usda:survey fndds:2710186:sauces condiments oils`

### You said: parmesan cheese

- Robot found: Cheese, parmesan, grated
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: This touches a Luke-specific preference and should not be auto-written. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 421 cal, 29.6P, 12.4C, 28F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 325036
- Candidate key: `usda:foundation:325036:cuisine staples`

### You said: peanut butter

- Robot found: Peanut butter
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 598 cal, 22.21P, 22.31C, 51.36F
- Natural speech units: g=1g, guideline amount per sandwich=32g, guideline amount per slice of bread roll=16g, kg=1000g, lb=453.59g, oz=28.35g, single serving=45g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2707537
- Candidate key: `usda:survey fndds:2707537:sauces condiments oils`

### You said: peanuts

- Robot found: Peanuts, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 551 cal, 23.2P, 26.5C, 43.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2515376
- Candidate key: `usda:foundation:2515376:cuisine staples`

### You said: pinto beans cooked

- Robot found: Beans, pinto, mature seeds, cooked, boiled, with salt
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 143 cal, 9.01P, 26.2C, 0.65F
- Natural speech units: cup=171g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173796
- Candidate key: `usda:sr legacy:173796:cuisine staples`

### You said: pork tenderloin

- Robot found: Pork, loin, tenderloin, boneless, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 125 cal, 21.6P, 0C, 3.9F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2646169
- Candidate key: `usda:foundation:2646169:proteins`

### You said: pork tenderloin cooked

- Robot found: Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 143 cal, 26.2P, 0C, 3.51F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece cooked excluding refuse yield from 1 lb raw meat with refuse=333g, roast=402g
- Source: usda / SR Legacy / 168250
- Candidate key: `usda:sr legacy:168250:proteins`

### You said: protein oats

- Robot found: Oats, whole grain, steel cut
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Only part of what you said matched this food. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 379 cal, 12.5P, 69.8C, 5.8F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346397
- Candidate key: `usda:foundation:2346397:breakfast snacks`

### You said: protein shake

- Robot found: Nutritional drink or shake, high protein, ready-to-drink, NFS
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: This touches a Luke-specific preference and should not be auto-written. It is probably fine, but the source says "not further specified." Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 61 cal, 6.59P, 0.85C, 3.38F
- Natural speech units: bottle 14 fl oz myoplex=448g, bottle 20 fl oz monster milk=640g, bottle or box nfs=544g, cup=256g, fl oz=32g, g=1g, kg=1000g, lb=453.59g
- Source: usda / Survey (FNDDS) / 2710726
- Candidate key: `usda:survey fndds:2710726:proteins`

### You said: red onion

- Robot found: Onions, red, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 44 cal, 0.94P, 9.93C, 0.1F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, onion=197g, oz=28.35g
- Source: usda / Foundation / 790577
- Candidate key: `usda:foundation:790577:whole foods`

### You said: red wine vinegar

- Robot found: Vinegar, red wine
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 19 cal, 0.04P, 0.27C, 0F
- Natural speech units: cup=239g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14.9g, tsp=5g
- Source: usda / SR Legacy / 172240
- Candidate key: `usda:sr legacy:172240:sauces condiments oils`

### You said: rolled oats

- Robot found: Oats, whole grain, rolled, old fashioned
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 379 cal, 13.5P, 68.7C, 5.89F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2346396
- Candidate key: `usda:foundation:2346396:breakfast snacks`

### You said: sirloin steak

- Robot found: Beef, top sirloin steak, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 146 cal, 22P, 0.22C, 5.71F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2727574
- Candidate key: `usda:foundation:2727574:proteins`

### You said: strawberries

- Robot found: Strawberries, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 32.7 cal, 0.64P, 7.96C, 0.22F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, strawberry=12g
- Source: usda / Foundation / 2346409
- Candidate key: `usda:foundation:2346409:whole foods`

### You said: tomato

- Robot found: Tomatoes, grape, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 27 cal, 0.83P, 5.51C, 0.63F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 321360
- Candidate key: `usda:foundation:321360:whole foods`

### You said: tomato paste

- Robot found: Tomato, paste, canned, without salt added
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 88.5 cal, 4.23P, 20.2C, 0.73F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2685580
- Candidate key: `usda:foundation:2685580:cuisine staples`

### You said: tortilla chips

- Robot found: Tortilla chips, plain
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 472 cal, 7.1P, 67.78C, 20.68F
- Natural speech units: 100 calorie package=20g, chip=3g, cup=30g, g=1g, kg=1000g, large single serving bag=85g, lb=453.59g, medium single serving bag=57g
- Source: usda / Survey (FNDDS) / 2708202
- Candidate key: `usda:survey fndds:2708202:cuisine staples`

### You said: white onion

- Robot found: Onions, white, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 35 cal, 0.89P, 7.68C, 0.13F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 1104962
- Candidate key: `usda:foundation:1104962:whole foods`

### You said: white rice cooked

- Robot found: Rice, white, cooked, glutinous
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 96 cal, 2.01P, 20.97C, 0.19F
- Natural speech units: cup cooked=174g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708422
- Candidate key: `usda:survey fndds:2708422:cuisine staples`

### You said: whole egg

- Robot found: Egg, whole, raw
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 143 cal, 12.4P, 0.96C, 9.96F
- Natural speech units: cup=245g, egg=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2707152
- Candidate key: `usda:survey fndds:2707152:proteins`

### You said: whole egg

- Robot found: Eggs, Grade A, Large, egg whole
- My suggested call: COVERED
- What you do: Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.
- Why: Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.
- Macros, only after identity is right: 148 cal, 12.4P, 0.96C, 9.96F
- Natural speech units: egg=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 748967
- Candidate key: `usda:foundation:748967:proteins`

## Probably Yes (3)

These are boring USDA rows. You only need to approve them if the phrase and match mean the same food to you.

### You said: cashews

- Robot found: Cashews, NFS
- My suggested call: PROBABLY YES
- What you do: If "robot found" is what you mean when you say the phrase, change decision to approved.
- Why: It is probably fine, but the source says "not further specified."
- Macros, only after identity is right: 574 cal, 15.31P, 32.69C, 46.35F
- Natural speech units: cup=130g, g=1g, kg=1000g, lb=453.59g, nut=1.5g, oz=28.35g, package=50g
- Source: usda / Survey (FNDDS) / 2707493
- Candidate key: `usda:survey fndds:2707493:cuisine staples`

### You said: french fries

- Robot found: Potato, french fries, NFS
- My suggested call: PROBABLY YES
- What you do: If "robot found" is what you mean when you say the phrase, change decision to approved.
- Why: It is probably fine, but the source says "not further specified."
- Macros, only after identity is right: 225 cal, 2.5P, 23.23C, 14.07F
- Natural speech units: crinkle cut=5g, cup=60g, fry ns as to shape=5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, shoestring=2g
- Source: usda / Survey (FNDDS) / 2709456
- Candidate key: `usda:survey fndds:2709456:cuisine staples`

### You said: sweet potato fries

- Robot found: Sweet potato fries, NFS
- My suggested call: PROBABLY YES
- What you do: If "robot found" is what you mean when you say the phrase, change decision to approved.
- Why: It is probably fine, but the source says "not further specified."
- Macros, only after identity is right: 192 cal, 2.27P, 37.45C, 9.39F
- Natural speech units: cup=60g, fry any cut=5g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2709709
- Candidate key: `usda:survey fndds:2709709:cuisine staples`

## Needs Your Choice (23)

These need a human call because the system cannot safely infer your intent.

### You said: apple cider vinegar

- Robot found: Vinegar, cider
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 21 cal, 0P, 0.93C, 0F
- Natural speech units: cup=239g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=14.9g, tsp=5g
- Source: usda / SR Legacy / 173469
- Candidate key: `usda:sr legacy:173469:sauces condiments oils`

### You said: baby back ribs cooked

- Robot found: Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, cooked, braised
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 306 cal, 27.8P, 0C, 21.7F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1197g
- Source: usda / SR Legacy / 172146
- Candidate key: `usda:sr legacy:172146:proteins`

### You said: daikon radish

- Robot found: Radishes, red, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 19.6 cal, 0.66P, 4.06C, 0.08F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2747665
- Candidate key: `usda:foundation:2747665:whole foods`

### You said: jalapeno

- Robot found: Peppers, jalapeno, seeded, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 24.1 cal, 0.62P, 5.08C, 0.15F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2747661
- Candidate key: `usda:foundation:2747661:whole foods`

### You said: mango sticky rice

- Robot found: Mango, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 60 cal, 0.82P, 14.98C, 0.38F
- Natural speech units: cup=165g, g=1g, kg=1000g, lb=453.59g, mango=210g, oz=28.35g, slice chunk=25g
- Source: usda / Survey (FNDDS) / 2709242
- Candidate key: `usda:survey fndds:2709242:prepared common`

### You said: penne pasta cooked

- Robot found: Pasta, cooked
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food.
- Macros, only after identity is right: 157 cal, 5.76P, 30.68C, 0.92F
- Natural speech units: cup cooked=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, oz dry yields=80g
- Source: usda / Survey (FNDDS) / 2708357
- Candidate key: `usda:survey fndds:2708357:cuisine staples`

### You said: steak cooked

- Robot found: Steak tartare
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 216 cal, 17.45P, 0.34C, 15.6F
- Natural speech units: cup=225g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2706394
- Candidate key: `usda:survey fndds:2706394:proteins`

### You said: sticky rice cooked

- Robot found: Rice, cooked, NFS
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: Only part of what you said matched this food. It is probably fine, but the source says "not further specified."
- Macros, only after identity is right: 129 cal, 2.67P, 27.99C, 0.28F
- Natural speech units: cup cooked=158g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708402
- Candidate key: `usda:survey fndds:2708402:cuisine staples`

### You said: mushrooms

- Robot found: Mushrooms, Chanterelle, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: This is a specific mushroom subtype, not just generic mushrooms.
- Macros, only after identity is right: 32 cal, 1.49P, 6.86C, 0.53F
- Natural speech units: cup=54g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, piece=5.4g
- Source: usda / SR Legacy / 168422
- Candidate key: `usda:sr legacy:168422:whole foods`

### You said: corn tortilla

- Robot found: Tortillas, ready-to-bake or -fry, corn
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 218 cal, 5.7P, 44.6C, 2.85F
- Natural speech units: enchilada=19g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- Source: usda / SR Legacy / 175036
- Candidate key: `usda:sr legacy:175036:cuisine staples`

### You said: flour tortilla

- Robot found: Wheat flour, white, tortilla mix, enriched
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 405 cal, 9.66P, 67.1C, 10.6F
- Natural speech units: cup=111g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tortilla=24g
- Source: usda / SR Legacy / 169724
- Candidate key: `usda:sr legacy:169724:cuisine staples`

### You said: hamburger patty

- Robot found: Fast foods, hamburger; single, regular patty; plain
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 297 cal, 16.5P, 31.5C, 12F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, patty=113g, sandwich=78g
- Source: usda / SR Legacy / 170693
- Candidate key: `usda:sr legacy:170693:proteins`

### You said: orange

- Robot found: Orange peel, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 97 cal, 1.5P, 25C, 0.2F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=6g, tsp=2g
- Source: usda / SR Legacy / 169103
- Candidate key: `usda:sr legacy:169103:whole foods`

### You said: oregano

- Robot found: Spices, oregano, dried
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap.
- Macros, only after identity is right: 265 cal, 9P, 68.9C, 4.28F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tsp ground=1.8g, tsp leaves=1g
- Source: usda / SR Legacy / 171328
- Candidate key: `usda:sr legacy:171328:whole foods`

### You said: pickle

- Robot found: Pickle relish, sweet
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 130 cal, 0.37P, 35.1C, 0.47F
- Natural speech units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet 2 3 tbsp=10g, tbsp=15g
- Source: usda / SR Legacy / 168561
- Candidate key: `usda:sr legacy:168561:whole foods`

### You said: pinto beans

- Robot found: Beans, pinto, mature seeds, sprouted, raw
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 62 cal, 5.25P, 11.6C, 0.9F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 170086
- Candidate key: `usda:sr legacy:170086:whole foods`

### You said: rice noodles

- Robot found: Rice noodles, dry
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 364 cal, 5.95P, 80.2C, 0.56F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 169742
- Candidate key: `usda:sr legacy:169742:cuisine staples`

### You said: rotisserie chicken

- Robot found: Chicken wing, rotisserie
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 257 cal, 23.42P, 0.6C, 18.04F
- Natural speech units: drummette=22g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, wing any size=35g
- Source: usda / Survey (FNDDS) / 2706060
- Candidate key: `usda:survey fndds:2706060:proteins`

### You said: sesame oil

- Robot found: Oil, sesame, salad or cooking
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 884 cal, 0P, 0C, 100F
- Natural speech units: cup=218g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=13.6g, tsp=4.5g
- Source: usda / SR Legacy / 171016
- Candidate key: `usda:sr legacy:171016:sauces condiments oils`

### You said: smoked turkey breast

- Robot found: Turkey, breast, smoked, lemon pepper flavor, 97% fat-free
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 95 cal, 20.9P, 1.31C, 0.69F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=28g
- Source: usda / SR Legacy / 174612
- Candidate key: `usda:sr legacy:174612:proteins`

### You said: spaghetti cooked

- Robot found: Spaghetti, spinach, cooked
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 130 cal, 4.58P, 26.2C, 0.63F
- Natural speech units: cup=140g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 168912
- Candidate key: `usda:sr legacy:168912:cuisine staples`

### You said: zucchini

- Robot found: Zucchini, pickled
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 35 cal, 1P, 7.44C, 0.28F
- Natural speech units: cup=170g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2710104
- Candidate key: `usda:survey fndds:2710104:whole foods`

### You said: salmon cooked

- Robot found: Salmon nuggets, cooked as purchased, unheated
- My suggested call: YOUR CALL
- What you do: Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 189 cal, 12P, 11.8C, 10.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173722
- Candidate key: `usda:sr legacy:173722:proteins`

## Needs Better Source (39)

These need better source work before auto-writing: brands, restaurants, cocktails, supplements, or combined dishes.

### You said: applesauce unsweetened

- Robot found: Applesauce, unsweetened
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 52 cal, 0.27P, 12.26C, 0.16F
- Natural speech units: cup=245g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, pouch=90g, snack size container=113g
- Source: usda / Survey (FNDDS) / 2709217
- Candidate key: `usda:survey fndds:2709217:breakfast snacks`

### You said: chicken thigh cooked

- Robot found: Chicken, broilers or fryers, thigh, meat only, cooked, fried
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 218 cal, 28.2P, 1.18C, 10.3F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, thigh bone and skin removed=52g, unit yield from 1 lb ready to cook chicken=31g
- Source: usda / SR Legacy / 172387
- Candidate key: `usda:sr legacy:172387:proteins`

### You said: egg cooked

- Robot found: Egg, whole, cooked, fried
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 196 cal, 13.6P, 0.83C, 14.8F
- Natural speech units: egg=50g, g=1g, kg=1000g, large=46g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173423
- Candidate key: `usda:sr legacy:173423:proteins`

### You said: ice cream sandwich low calorie

- Robot found: Ice cream cookie sandwich
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 317 cal, 4.61P, 43.35C, 14.11F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, sandwich=75g
- Source: usda / Survey (FNDDS) / 2705644
- Candidate key: `usda:survey fndds:2705644:breakfast snacks`

### You said: macaroni and cheese

- Robot found: Macaroni or noodles with cheese and meat
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 210 cal, 11.79P, 15.14C, 11.16F
- Natural speech units: cup=230g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708818
- Candidate key: `usda:survey fndds:2708818:cuisine staples`

### You said: soy sauce

- Robot found: Soy sauce made from soy (tamari)
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 60 cal, 10.5P, 5.57C, 0.1F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=18g, tsp=6g
- Source: usda / SR Legacy / 174278
- Candidate key: `usda:sr legacy:174278:sauces condiments oils`

### You said: bbq ribs

- Robot found: Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0" fat, choice, raw
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. An important word from your phrase is missing from the match.
- Macros, only after identity is right: 252 cal, 18.7P, 0.64C, 19.4F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, rib=85g, ribs=1604g
- Source: usda / SR Legacy / 172147
- Candidate key: `usda:sr legacy:172147:prepared common`

### You said: brown rice cooked

- Robot found: Rice, brown, parboiled, cooked, UNCLE BENS
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 147 cal, 3.09P, 31.3C, 0.85F
- Natural speech units: cup=155g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173263
- Candidate key: `usda:sr legacy:173263:whole foods`

### You said: carnitas pork

- Robot found: Pork, ground, raw
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 233 cal, 17.8P, 0C, 17.5F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2514745
- Candidate key: `usda:foundation:2514745:proteins`

### You said: cereal oat bran

- Robot found: Cereals ready-to-eat, QUAKER, MOTHER'S Toasted Oat Bran cereal
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 372 cal, 11.4P, 75.4C, 5.04F
- Natural speech units: cup 1 nlea serving=42.67g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 172986
- Candidate key: `usda:sr legacy:172986:breakfast snacks`

### You said: ice cream bar low calorie

- Robot found: Ice cream candy bar
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written.
- Macros, only after identity is right: 323 cal, 4.4P, 30.9C, 20.2F
- Natural speech units: bar=50g, g=1g, kg=1000g, lb=453.59g, miniature snicker bar 1 fl oz=25g, oz=28.35g, snickers bar 2 fl oz=50g
- Source: usda / Survey (FNDDS) / 2705640
- Candidate key: `usda:survey fndds:2705640:breakfast snacks`

### You said: Kashi cereal

- Robot found: Cereals ready-to-eat, POST, Honeycomb Cereal
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 394 cal, 6.01P, 86.6C, 2.93F
- Natural speech units: cup 1 nlea serving=21.33g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173889
- Candidate key: `usda:sr legacy:173889:breakfast snacks`

### You said: mayonnaise

- Robot found: Mayonnaise, made with tofu
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc.
- Macros, only after identity is right: 322 cal, 5.95P, 3.06C, 31.8F
- Natural speech units: cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=15g
- Source: usda / SR Legacy / 167695
- Candidate key: `usda:sr legacy:167695:sauces condiments oils`

### You said: Mexican rice

- Robot found: ON THE BORDER, Mexican rice
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 195 cal, 3.56P, 34.2C, 4.86F
- Natural speech units: can=355g, cup=114g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 169031
- Candidate key: `usda:sr legacy:169031:cuisine staples`

### You said: San Marzano tomatoes canned

- Robot found: Tomato, puree, canned
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food.
- Macros, only after identity is right: 34.8 cal, 1.58P, 8.04C, 0.27F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 2685582
- Candidate key: `usda:foundation:2685582:whole foods`

### You said: taco seasoning

- Robot found: TACO BELL, Soft Taco with steak
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: Only part of what you said matched this food. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 225 cal, 11.8P, 17.2C, 12.1F
- Natural speech units: g=1g, item=127g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 170733
- Candidate key: `usda:sr legacy:170733:cuisine staples`

### You said: refried beans

- Robot found: ON THE BORDER, refried beans
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is brand-like, so it needs a human source check. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 144 cal, 7.3P, 17.5C, 5F
- Natural speech units: cup=135g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 169032
- Candidate key: `usda:sr legacy:169032:cuisine staples`

### You said: bbq chicken

- Robot found: Chicken, broiler, rotisserie, BBQ, skin
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 378 cal, 15.2P, 0.7C, 35.2F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=85g
- Source: usda / SR Legacy / 171524
- Candidate key: `usda:sr legacy:171524:prepared common`

### You said: beef hot dog

- Robot found: Hot dog, beef
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 310 cal, 11.7P, 2.89C, 28F
- Natural speech units: bun length jumbo=57g, cocktail miniature=10g, cup sliced=150g, footlong=88g, g=1g, hot dog=45g, kg=1000g, lb=453.59g
- Source: usda / Survey (FNDDS) / 2706167
- Candidate key: `usda:survey fndds:2706167:proteins`

### You said: chicken parmesan

- Robot found: CARRABBA'S ITALIAN GRILL, chicken parmesan without cavatappi pasta
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 206 cal, 19P, 7.8C, 11F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, serving=339g
- Source: usda / SR Legacy / 169857
- Candidate key: `usda:sr legacy:169857:prepared common`

### You said: hamburger bun

- Robot found: McDONALD'S, Hamburger
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: Only part of what you said matched this food. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 264 cal, 12.9P, 30.3C, 10.1F
- Natural speech units: bun=50g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, sandwich=95g
- Source: usda / SR Legacy / 170717
- Candidate key: `usda:sr legacy:170717:cuisine staples`

### You said: hot dog bun

- Robot found: Rolls, hamburger or hot dog, whole wheat
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 269 cal, 12.4P, 44.9C, 4.38F
- Natural speech units: bun=50g, g=1g, hot dog=45g, kg=1000g, lb=453.59g, oz=28.35g, roll=56g
- Source: usda / SR Legacy / 174090
- Candidate key: `usda:sr legacy:174090:cuisine staples`

### You said: lasagna

- Robot found: Lasagna, meatless
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 130 cal, 6.54P, 13.84C, 5.33F
- Natural speech units: cup=250g, g=1g, kg=1000g, lasagna 7 x 12=2048g, lasagna 8 square=1360g, lb=453.59g, oz=28.35g, piece 1 6 of 8 square approx 2 1 2 x 4=227g
- Source: usda / Survey (FNDDS) / 2708758
- Candidate key: `usda:survey fndds:2708758:prepared common`

### You said: pad thai

- Robot found: Pad Thai, NFS
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. It is probably fine, but the source says "not further specified." This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 154 cal, 8.13P, 14.36C, 7.5F
- Natural speech units: cup=200g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2708804
- Candidate key: `usda:survey fndds:2708804:prepared common`

### You said: protein shake dextrose

- Robot found: Beverages, SLIMFAST, Meal replacement,  High Protein Shake, Ready-To-Drink, 3-2-1 plan
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is brand-like, so it needs a human source check. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 61 cal, 6.59P, 0.85C, 3.38F
- Natural speech units: bottle=295g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173170
- Candidate key: `usda:sr legacy:173170:coverage buffer`

### You said: red curry chicken

- Robot found: Chicken curry
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. Only part of what you said matched this food. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 107 cal, 6.48P, 6.54C, 6.48F
- Natural speech units: cup=240g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2706437
- Candidate key: `usda:survey fndds:2706437:prepared common`

### You said: tofu firm

- Robot found: MORI-NU, Tofu, silken, firm
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This is brand-like, so it needs a human source check. This is brand-like, so it needs a human source check.
- Macros, only after identity is right: 62 cal, 6.9P, 2.4C, 2.7F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, slice=84g
- Source: usda / SR Legacy / 172461
- Candidate key: `usda:sr legacy:172461:proteins`

### You said: whey protein powder

- Robot found: Beverages, Protein powder whey based
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 352 cal, 78.1P, 6.25C, 1.56F
- Natural speech units: cup=96.97g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173180
- Candidate key: `usda:sr legacy:173180:proteins`

### You said: barbecue sauce

- Robot found: Sauce, barbecue
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 172 cal, 0.82P, 40.8C, 0.63F
- Natural speech units: bar=65g, cup=279g, g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- Source: usda / SR Legacy / 174523
- Candidate key: `usda:sr legacy:174523:sauces condiments oils`

### You said: fish sauce

- Robot found: Fish sauce
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 35 cal, 5.06P, 3.64C, 0.01F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2706457
- Candidate key: `usda:survey fndds:2706457:sauces condiments oils`

### You said: hoisin sauce

- Robot found: Sauce, hoisin, ready-to-serve
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 220 cal, 3.31P, 44.1C, 3.39F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- Source: usda / SR Legacy / 172886
- Candidate key: `usda:sr legacy:172886:sauces condiments oils`

### You said: hot sauce

- Robot found: Hot Thai sauce
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 74 cal, 1.03P, 16.58C, 0.66F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, packet=9g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2709744
- Candidate key: `usda:survey fndds:2709744:sauces condiments oils`

### You said: marinara sauce

- Robot found: Sauce, pasta, spaghetti/marinara, ready-to-serve
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 45 cal, 1.41P, 8.05C, 1.48F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Foundation / 332282
- Candidate key: `usda:foundation:332282:cuisine staples`

### You said: peanut sauce

- Robot found: Sauce, peanut, made from coconut, water, sugar, peanuts
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 179 cal, 2.02P, 28.5C, 6.34F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=17g
- Source: usda / SR Legacy / 171575
- Candidate key: `usda:sr legacy:171575:sauces condiments oils`

### You said: soy sauce

- Robot found: Soy sauce
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 53 cal, 8.14P, 4.93C, 0.57F
- Natural speech units: g=1g, guideline amount per piece of sushi=2g, individual packet=9g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2707442
- Candidate key: `usda:survey fndds:2707442:sauces condiments oils`

### You said: spaghetti with meat sauce

- Robot found: Spaghetti sauce with meat
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. This is a combined dish, not a simple ingredient. This is in Luke-preference territory, so it needs a human look.
- Macros, only after identity is right: 90 cal, 5.94P, 6.54C, 4.36F
- Natural speech units: cup=260g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / Survey (FNDDS) / 2706470
- Candidate key: `usda:survey fndds:2706470:prepared common`

### You said: pesto

- Robot found: Pesto sauce
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: This touches a Luke-specific preference and should not be auto-written. The state is different: cooked/raw/dried/peeled/canned/frozen/etc. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 580 cal, 8.61P, 5.67C, 59.17F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tbsp=16g
- Source: usda / Survey (FNDDS) / 2710175
- Candidate key: `usda:survey fndds:2710175:sauces condiments oils`

### You said: pulled pork

- Robot found: Pulled pork in barbecue sauce
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 168 cal, 13.2P, 18.7C, 4.42F
- Natural speech units: cup=249g, g=1g, kg=1000g, lb=453.59g, oz=28.35g
- Source: usda / SR Legacy / 173344
- Candidate key: `usda:sr legacy:173344:proteins`

### You said: sriracha

- Robot found: Sauce, hot chile, sriracha
- My suggested call: NOT AUTO
- What you do: Do not approve from this packet unless you are confident the source and serving are right.
- Why: The state is different: cooked/raw/dried/peeled/canned/frozen/etc. The phrase is too broad, so the second-best match might be a trap. This is in Luke-preference territory, so it needs a human look. This is a combined dish, not a simple ingredient.
- Macros, only after identity is right: 93 cal, 1.93P, 19.2C, 0.93F
- Natural speech units: g=1g, kg=1000g, lb=453.59g, oz=28.35g, tsp=6.5g
- Source: usda / SR Legacy / 171186
- Candidate key: `usda:sr legacy:171186:sauces condiments oils`
