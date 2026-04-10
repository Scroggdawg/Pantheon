-- Add yield_servings to saved_meals for recipe portion support
ALTER TABLE saved_meals ADD COLUMN yield_servings int NOT NULL DEFAULT 1;
