-- Pantheon Seed Data: Staple Meals
-- Run after user onboarding to populate saved_meals for the user
-- Replace USER_ID_HERE with the actual user UUID

-- Note: This needs to be run AFTER the user has been created via onboarding.
-- Alternatively, use the seed script at /lib/seed.ts which auto-detects the user.

INSERT INTO saved_meals (user_id, name, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, tags, is_staple) VALUES
-- Egg & Bacon Breakfast
((SELECT id FROM users LIMIT 1), 'Egg & Bacon Breakfast', '[{"name":"Eggs","qty":3,"unit":"large","calories":210,"protein_g":18,"carbs_g":1,"fat_g":15},{"name":"Bacon","qty":3,"unit":"strips","calories":180,"protein_g":10,"carbs_g":1,"fat_g":15}]', 390, 28, 2, 30, ARRAY['breakfast'], true),

-- Egg White Scramble
((SELECT id FROM users LIMIT 1), 'Egg White Scramble', '[{"name":"Egg whites","qty":8,"unit":"large","calories":136,"protein_g":28,"carbs_g":2,"fat_g":0},{"name":"Spinach","qty":1,"unit":"cup","calories":7,"protein_g":1,"carbs_g":1,"fat_g":0},{"name":"Feta cheese","qty":1,"unit":"oz","calories":70,"protein_g":9,"carbs_g":1,"fat_g":5}]', 213, 38, 4, 5, ARRAY['breakfast'], true),

-- Protein Shake
((SELECT id FROM users LIMIT 1), 'Protein Shake', '[{"name":"Whey protein powder","qty":1,"unit":"scoop","calories":120,"protein_g":24,"carbs_g":3,"fat_g":1},{"name":"Water","qty":12,"unit":"oz","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},{"name":"Ice","qty":4,"unit":"cubes","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}]', 130, 25, 5, 2, ARRAY['breakfast','snack'], true),

-- Greek Yogurt Bowl
((SELECT id FROM users LIMIT 1), 'Greek Yogurt Bowl', '[{"name":"Greek yogurt (nonfat)","qty":1,"unit":"cup","calories":130,"protein_g":18,"carbs_g":8,"fat_g":0},{"name":"Blueberries","qty":0.5,"unit":"cup","calories":42,"protein_g":1,"carbs_g":11,"fat_g":0},{"name":"Honey","qty":1,"unit":"tsp","calories":21,"protein_g":0,"carbs_g":6,"fat_g":0},{"name":"Almonds (sliced)","qty":0.5,"unit":"oz","calories":14,"protein_g":1,"carbs_g":0,"fat_g":3}]', 207, 20, 25, 3, ARRAY['breakfast','snack'], true),

-- Chicken Rice Bowl
((SELECT id FROM users LIMIT 1), 'Chicken Rice Bowl', '[{"name":"Grilled chicken breast","qty":8,"unit":"oz","calories":280,"protein_g":44,"carbs_g":0,"fat_g":6},{"name":"White rice (cooked)","qty":1,"unit":"cup","calories":170,"protein_g":3,"carbs_g":37,"fat_g":0},{"name":"Steamed broccoli","qty":1,"unit":"cup","calories":22,"protein_g":1,"carbs_g":4,"fat_g":0},{"name":"Soy sauce","qty":1,"unit":"tbsp","calories":0,"protein_g":0,"carbs_g":1,"fat_g":0}]', 472, 48, 52, 8, ARRAY['lunch','dinner','meal-prep'], true),

-- Larb (Thai Chicken)
((SELECT id FROM users LIMIT 1), 'Larb (Thai Chicken)', '[{"name":"Ground chicken","qty":6,"unit":"oz","calories":270,"protein_g":36,"carbs_g":0,"fat_g":14},{"name":"Fish sauce","qty":1,"unit":"tbsp","calories":10,"protein_g":2,"carbs_g":0,"fat_g":0},{"name":"Lime juice","qty":1,"unit":"tbsp","calories":4,"protein_g":0,"carbs_g":1,"fat_g":0},{"name":"Shallots","qty":2,"unit":"tbsp","calories":14,"protein_g":0,"carbs_g":3,"fat_g":0},{"name":"Mint & cilantro","qty":0.25,"unit":"cup","calories":2,"protein_g":0,"carbs_g":0,"fat_g":0},{"name":"Toasted rice powder","qty":1,"unit":"tbsp","calories":36,"protein_g":1,"carbs_g":8,"fat_g":0},{"name":"Chili flakes","qty":0.5,"unit":"tsp","calories":3,"protein_g":0,"carbs_g":0,"fat_g":0}]', 366, 40, 12, 18, ARRAY['lunch','dinner'], true),

-- Poke Bowl
((SELECT id FROM users LIMIT 1), 'Poke Bowl', '[{"name":"Ahi tuna (raw)","qty":6,"unit":"oz","calories":180,"protein_g":36,"carbs_g":0,"fat_g":2},{"name":"Sushi rice","qty":0.75,"unit":"cup","calories":180,"protein_g":2,"carbs_g":40,"fat_g":0},{"name":"Edamame","qty":0.25,"unit":"cup","calories":50,"protein_g":5,"carbs_g":4,"fat_g":2},{"name":"Avocado","qty":0.25,"unit":"whole","calories":60,"protein_g":1,"carbs_g":3,"fat_g":5},{"name":"Soy sauce & sesame","qty":1,"unit":"tbsp","calories":24,"protein_g":0,"carbs_g":2,"fat_g":1}]', 494, 38, 55, 14, ARRAY['lunch','dinner'], true),

-- Salmon Nigiri 6pc
((SELECT id FROM users LIMIT 1), 'Salmon Nigiri 6pc', '[{"name":"Salmon nigiri","qty":6,"unit":"pieces","calories":292,"protein_g":18,"carbs_g":36,"fat_g":8}]', 292, 18, 36, 8, ARRAY['lunch','dinner','sushi'], true),

-- Spicy Tuna Roll
((SELECT id FROM users LIMIT 1), 'Spicy Tuna Roll', '[{"name":"Spicy tuna roll","qty":8,"unit":"pieces","calories":380,"protein_g":20,"carbs_g":48,"fat_g":12}]', 380, 20, 48, 12, ARRAY['lunch','dinner','sushi'], true),

-- Salad with Chicken
((SELECT id FROM users LIMIT 1), 'Salad with Chicken', '[{"name":"Grilled chicken breast","qty":6,"unit":"oz","calories":210,"protein_g":38,"carbs_g":0,"fat_g":5},{"name":"Mixed greens","qty":3,"unit":"cups","calories":20,"protein_g":2,"carbs_g":3,"fat_g":0},{"name":"Cherry tomatoes","qty":0.5,"unit":"cup","calories":15,"protein_g":1,"carbs_g":3,"fat_g":0},{"name":"Cucumber","qty":0.5,"unit":"cup","calories":8,"protein_g":0,"carbs_g":2,"fat_g":0},{"name":"Olive oil & lemon dressing","qty":1,"unit":"tbsp","calories":121,"protein_g":0,"carbs_g":1,"fat_g":13}]', 374, 44, 10, 18, ARRAY['lunch','dinner'], true),

-- Chicken Shawarma Wrap
((SELECT id FROM users LIMIT 1), 'Chicken Shawarma Wrap', '[{"name":"Chicken shawarma","qty":6,"unit":"oz","calories":270,"protein_g":36,"carbs_g":4,"fat_g":12},{"name":"Pita wrap","qty":1,"unit":"large","calories":170,"protein_g":5,"carbs_g":33,"fat_g":2},{"name":"Tahini sauce","qty":1,"unit":"tbsp","calories":89,"protein_g":3,"carbs_g":3,"fat_g":8},{"name":"Pickled turnips & veggies","qty":0.25,"unit":"cup","calories":10,"protein_g":0,"carbs_g":2,"fat_g":0}]', 464, 38, 42, 16, ARRAY['lunch','dinner'], true),

-- Cottage Cheese Bowl
((SELECT id FROM users LIMIT 1), 'Cottage Cheese Bowl', '[{"name":"Cottage cheese (2%)","qty":1,"unit":"cup","calories":183,"protein_g":24,"carbs_g":10,"fat_g":5},{"name":"Pineapple chunks","qty":0.25,"unit":"cup","calories":21,"protein_g":0,"carbs_g":5,"fat_g":0},{"name":"Everything bagel seasoning","qty":0.5,"unit":"tsp","calories":5,"protein_g":0,"carbs_g":1,"fat_g":0}]', 221, 25, 18, 5, ARRAY['breakfast','snack'], true);
