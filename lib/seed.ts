// Seed script for Pantheon staple meals
// Run with: npx tsx lib/seed.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Parse .env.local manually to avoid dotenv dependency
const envFile = readFileSync('.env.local', 'utf-8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STAPLE_MEALS = [
  {
    name: 'Egg & Bacon Breakfast',
    foods_json: [
      { name: 'Eggs', qty: 3, unit: 'large', calories: 210, protein_g: 18, carbs_g: 1, fat_g: 15 },
      { name: 'Bacon', qty: 3, unit: 'strips', calories: 180, protein_g: 10, carbs_g: 1, fat_g: 15 },
    ],
    total_calories: 390, total_protein_g: 28, total_carbs_g: 2, total_fat_g: 30,
    tags: ['breakfast'], is_favorite: true,
  },
  {
    name: 'Egg White Scramble',
    foods_json: [
      { name: 'Egg whites', qty: 8, unit: 'large', calories: 136, protein_g: 28, carbs_g: 2, fat_g: 0 },
      { name: 'Spinach', qty: 1, unit: 'cup', calories: 7, protein_g: 1, carbs_g: 1, fat_g: 0 },
      { name: 'Feta cheese', qty: 1, unit: 'oz', calories: 70, protein_g: 9, carbs_g: 1, fat_g: 5 },
    ],
    total_calories: 213, total_protein_g: 38, total_carbs_g: 4, total_fat_g: 5,
    tags: ['breakfast'], is_favorite: true,
  },
  {
    name: 'Protein Shake',
    foods_json: [
      { name: 'Whey protein powder', qty: 1, unit: 'scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1 },
      { name: 'Water', qty: 12, unit: 'oz', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ],
    total_calories: 130, total_protein_g: 25, total_carbs_g: 5, total_fat_g: 2,
    tags: ['breakfast', 'snack'], is_favorite: true,
  },
  {
    name: 'Greek Yogurt Bowl',
    foods_json: [
      { name: 'Greek yogurt (nonfat)', qty: 1, unit: 'cup', calories: 130, protein_g: 18, carbs_g: 8, fat_g: 0 },
      { name: 'Blueberries', qty: 0.5, unit: 'cup', calories: 42, protein_g: 1, carbs_g: 11, fat_g: 0 },
      { name: 'Honey', qty: 1, unit: 'tsp', calories: 21, protein_g: 0, carbs_g: 6, fat_g: 0 },
      { name: 'Almonds (sliced)', qty: 0.5, unit: 'oz', calories: 14, protein_g: 1, carbs_g: 0, fat_g: 3 },
    ],
    total_calories: 207, total_protein_g: 20, total_carbs_g: 25, total_fat_g: 3,
    tags: ['breakfast', 'snack'], is_favorite: true,
  },
  {
    name: 'Chicken Rice Bowl',
    foods_json: [
      { name: 'Grilled chicken breast', qty: 8, unit: 'oz', calories: 280, protein_g: 44, carbs_g: 0, fat_g: 6 },
      { name: 'White rice (cooked)', qty: 1, unit: 'cup', calories: 170, protein_g: 3, carbs_g: 37, fat_g: 0 },
      { name: 'Steamed broccoli', qty: 1, unit: 'cup', calories: 22, protein_g: 1, carbs_g: 4, fat_g: 0 },
    ],
    total_calories: 472, total_protein_g: 48, total_carbs_g: 52, total_fat_g: 8,
    tags: ['lunch', 'dinner', 'meal-prep'], is_favorite: true,
  },
  {
    name: 'Larb (Thai Chicken)',
    foods_json: [
      { name: 'Ground chicken', qty: 6, unit: 'oz', calories: 270, protein_g: 36, carbs_g: 0, fat_g: 14 },
      { name: 'Fish sauce, lime, herbs', qty: 1, unit: 'serving', calories: 30, protein_g: 2, carbs_g: 4, fat_g: 0 },
      { name: 'Toasted rice powder', qty: 1, unit: 'tbsp', calories: 36, protein_g: 1, carbs_g: 8, fat_g: 0 },
    ],
    total_calories: 366, total_protein_g: 40, total_carbs_g: 12, total_fat_g: 18,
    tags: ['lunch', 'dinner'], is_favorite: true,
  },
  {
    name: 'Poke Bowl',
    foods_json: [
      { name: 'Ahi tuna (raw)', qty: 6, unit: 'oz', calories: 180, protein_g: 36, carbs_g: 0, fat_g: 2 },
      { name: 'Sushi rice', qty: 0.75, unit: 'cup', calories: 180, protein_g: 2, carbs_g: 40, fat_g: 0 },
      { name: 'Edamame', qty: 0.25, unit: 'cup', calories: 50, protein_g: 5, carbs_g: 4, fat_g: 2 },
      { name: 'Avocado', qty: 0.25, unit: 'whole', calories: 60, protein_g: 1, carbs_g: 3, fat_g: 5 },
    ],
    total_calories: 494, total_protein_g: 38, total_carbs_g: 55, total_fat_g: 14,
    tags: ['lunch', 'dinner'], is_favorite: true,
  },
  {
    name: 'Salmon Nigiri 6pc',
    foods_json: [
      { name: 'Salmon nigiri', qty: 6, unit: 'pieces', calories: 292, protein_g: 18, carbs_g: 36, fat_g: 8 },
    ],
    total_calories: 292, total_protein_g: 18, total_carbs_g: 36, total_fat_g: 8,
    tags: ['lunch', 'dinner', 'sushi'], is_favorite: true,
  },
  {
    name: 'Spicy Tuna Roll',
    foods_json: [
      { name: 'Spicy tuna roll', qty: 8, unit: 'pieces', calories: 380, protein_g: 20, carbs_g: 48, fat_g: 12 },
    ],
    total_calories: 380, total_protein_g: 20, total_carbs_g: 48, total_fat_g: 12,
    tags: ['lunch', 'dinner', 'sushi'], is_favorite: true,
  },
  {
    name: 'Salad with Chicken',
    foods_json: [
      { name: 'Grilled chicken breast', qty: 6, unit: 'oz', calories: 210, protein_g: 38, carbs_g: 0, fat_g: 5 },
      { name: 'Mixed greens', qty: 3, unit: 'cups', calories: 20, protein_g: 2, carbs_g: 3, fat_g: 0 },
      { name: 'Olive oil & lemon dressing', qty: 1, unit: 'tbsp', calories: 121, protein_g: 0, carbs_g: 1, fat_g: 13 },
    ],
    total_calories: 374, total_protein_g: 44, total_carbs_g: 10, total_fat_g: 18,
    tags: ['lunch', 'dinner'], is_favorite: true,
  },
  {
    name: 'Chicken Shawarma Wrap',
    foods_json: [
      { name: 'Chicken shawarma', qty: 6, unit: 'oz', calories: 270, protein_g: 36, carbs_g: 4, fat_g: 12 },
      { name: 'Pita wrap', qty: 1, unit: 'large', calories: 170, protein_g: 5, carbs_g: 33, fat_g: 2 },
      { name: 'Tahini sauce', qty: 1, unit: 'tbsp', calories: 89, protein_g: 3, carbs_g: 3, fat_g: 8 },
    ],
    total_calories: 464, total_protein_g: 38, total_carbs_g: 42, total_fat_g: 16,
    tags: ['lunch', 'dinner'], is_favorite: true,
  },
  {
    name: 'Cottage Cheese Bowl',
    foods_json: [
      { name: 'Cottage cheese (2%)', qty: 1, unit: 'cup', calories: 183, protein_g: 24, carbs_g: 10, fat_g: 5 },
      { name: 'Pineapple chunks', qty: 0.25, unit: 'cup', calories: 21, protein_g: 0, carbs_g: 5, fat_g: 0 },
      { name: 'Everything bagel seasoning', qty: 0.5, unit: 'tsp', calories: 5, protein_g: 0, carbs_g: 1, fat_g: 0 },
    ],
    total_calories: 221, total_protein_g: 25, total_carbs_g: 18, total_fat_g: 5,
    tags: ['breakfast', 'snack'], is_favorite: true,
  },
]

async function seed() {
  // Get the first user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1)

  if (userError || !users?.length) {
    console.error('No users found. Complete onboarding first.')
    process.exit(1)
  }

  const userId = users[0].id
  console.log(`Seeding staple meals for user: ${userId}`)

  for (const meal of STAPLE_MEALS) {
    const { error } = await supabase.from('saved_meals').upsert(
      { ...meal, user_id: userId },
      { onConflict: 'id' }
    )

    if (error) {
      console.error(`Failed to seed "${meal.name}":`, error.message)
    } else {
      console.log(`  + ${meal.name}`)
    }
  }

  console.log('Done!')
}

seed()
