// Seed staple meals via Supabase Management API (bypasses RLS)
const TOKEN = 'sbp_c310e68f8505db245fdcf129d9ba009a4338596c'
const PROJECT_REF = 'qlkjgguxjddalbswoxpm'
const URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

async function query(sql) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (res.status !== 201) {
    console.error('SQL Error:', text)
    return null
  }
  return JSON.parse(text)
}

// Check if any users exist
const users = await query("SELECT id FROM public.users LIMIT 1;")
if (!users || users.length === 0) {
  console.log('No users found yet. You need to sign up + complete onboarding first.')
  console.log('After that, re-run: node lib/run-seed.mjs')
  process.exit(0)
}

const userId = users[0].id
console.log(`Seeding staple meals for user: ${userId}`)

const seedSQL = `
INSERT INTO saved_meals (user_id, name, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, tags, is_staple) VALUES
('${userId}', 'Egg & Bacon Breakfast', '[{"name":"Eggs","qty":3,"unit":"large","calories":210,"protein_g":18,"carbs_g":1,"fat_g":15},{"name":"Bacon","qty":3,"unit":"strips","calories":180,"protein_g":10,"carbs_g":1,"fat_g":15}]', 390, 28, 2, 30, ARRAY['breakfast'], true),
('${userId}', 'Egg White Scramble', '[{"name":"Egg whites","qty":8,"unit":"large","calories":136,"protein_g":28,"carbs_g":2,"fat_g":0},{"name":"Spinach","qty":1,"unit":"cup","calories":7,"protein_g":1,"carbs_g":1,"fat_g":0},{"name":"Feta cheese","qty":1,"unit":"oz","calories":70,"protein_g":9,"carbs_g":1,"fat_g":5}]', 213, 38, 4, 5, ARRAY['breakfast'], true),
('${userId}', 'Protein Shake', '[{"name":"Whey protein powder","qty":1,"unit":"scoop","calories":120,"protein_g":24,"carbs_g":3,"fat_g":1},{"name":"Water","qty":12,"unit":"oz","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}]', 130, 25, 5, 2, ARRAY['breakfast','snack'], true),
('${userId}', 'Greek Yogurt Bowl', '[{"name":"Greek yogurt (nonfat)","qty":1,"unit":"cup","calories":130,"protein_g":18,"carbs_g":8,"fat_g":0},{"name":"Blueberries","qty":0.5,"unit":"cup","calories":42,"protein_g":1,"carbs_g":11,"fat_g":0},{"name":"Honey","qty":1,"unit":"tsp","calories":21,"protein_g":0,"carbs_g":6,"fat_g":0}]', 207, 20, 25, 3, ARRAY['breakfast','snack'], true),
('${userId}', 'Chicken Rice Bowl', '[{"name":"Grilled chicken breast","qty":8,"unit":"oz","calories":280,"protein_g":44,"carbs_g":0,"fat_g":6},{"name":"White rice (cooked)","qty":1,"unit":"cup","calories":170,"protein_g":3,"carbs_g":37,"fat_g":0},{"name":"Steamed broccoli","qty":1,"unit":"cup","calories":22,"protein_g":1,"carbs_g":4,"fat_g":0}]', 472, 48, 52, 8, ARRAY['lunch','dinner','meal-prep'], true),
('${userId}', 'Larb (Thai Chicken)', '[{"name":"Ground chicken","qty":6,"unit":"oz","calories":270,"protein_g":36,"carbs_g":0,"fat_g":14},{"name":"Fish sauce, lime, herbs","qty":1,"unit":"serving","calories":30,"protein_g":2,"carbs_g":4,"fat_g":0},{"name":"Toasted rice powder","qty":1,"unit":"tbsp","calories":36,"protein_g":1,"carbs_g":8,"fat_g":0}]', 366, 40, 12, 18, ARRAY['lunch','dinner'], true),
('${userId}', 'Poke Bowl', '[{"name":"Ahi tuna (raw)","qty":6,"unit":"oz","calories":180,"protein_g":36,"carbs_g":0,"fat_g":2},{"name":"Sushi rice","qty":0.75,"unit":"cup","calories":180,"protein_g":2,"carbs_g":40,"fat_g":0},{"name":"Edamame","qty":0.25,"unit":"cup","calories":50,"protein_g":5,"carbs_g":4,"fat_g":2},{"name":"Avocado","qty":0.25,"unit":"whole","calories":60,"protein_g":1,"carbs_g":3,"fat_g":5}]', 494, 38, 55, 14, ARRAY['lunch','dinner'], true),
('${userId}', 'Salmon Nigiri 6pc', '[{"name":"Salmon nigiri","qty":6,"unit":"pieces","calories":292,"protein_g":18,"carbs_g":36,"fat_g":8}]', 292, 18, 36, 8, ARRAY['lunch','dinner','sushi'], true),
('${userId}', 'Spicy Tuna Roll', '[{"name":"Spicy tuna roll","qty":8,"unit":"pieces","calories":380,"protein_g":20,"carbs_g":48,"fat_g":12}]', 380, 20, 48, 12, ARRAY['lunch','dinner','sushi'], true),
('${userId}', 'Salad with Chicken', '[{"name":"Grilled chicken breast","qty":6,"unit":"oz","calories":210,"protein_g":38,"carbs_g":0,"fat_g":5},{"name":"Mixed greens","qty":3,"unit":"cups","calories":20,"protein_g":2,"carbs_g":3,"fat_g":0},{"name":"Olive oil & lemon dressing","qty":1,"unit":"tbsp","calories":121,"protein_g":0,"carbs_g":1,"fat_g":13}]', 374, 44, 10, 18, ARRAY['lunch','dinner'], true),
('${userId}', 'Chicken Shawarma Wrap', '[{"name":"Chicken shawarma","qty":6,"unit":"oz","calories":270,"protein_g":36,"carbs_g":4,"fat_g":12},{"name":"Pita wrap","qty":1,"unit":"large","calories":170,"protein_g":5,"carbs_g":33,"fat_g":2},{"name":"Tahini sauce","qty":1,"unit":"tbsp","calories":89,"protein_g":3,"carbs_g":3,"fat_g":8}]', 464, 38, 42, 16, ARRAY['lunch','dinner'], true),
('${userId}', 'Cottage Cheese Bowl', '[{"name":"Cottage cheese (2%)","qty":1,"unit":"cup","calories":183,"protein_g":24,"carbs_g":10,"fat_g":5},{"name":"Pineapple chunks","qty":0.25,"unit":"cup","calories":21,"protein_g":0,"carbs_g":5,"fat_g":0},{"name":"Everything bagel seasoning","qty":0.5,"unit":"tsp","calories":5,"protein_g":0,"carbs_g":1,"fat_g":0}]', 221, 25, 18, 5, ARRAY['breakfast','snack'], true)
ON CONFLICT DO NOTHING;
`

const result = await query(seedSQL)
if (result !== null) {
  console.log('Staple meals seeded successfully!')
  const count = await query("SELECT count(*) as n FROM saved_meals;")
  console.log(`Total saved meals: ${count[0].n}`)
} else {
  console.log('Seed failed — check error above.')
}
