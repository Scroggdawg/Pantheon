-- Op FASTRAK Alpha.6 Sub-fix A — rename is_staple → is_favorite.
-- The pre-existing is_staple flag served the same semantic role (user-
-- designated pinned meal) that Alpha.6's heart icon now drives. Rather
-- than carry two flags with overlapping meaning, rename in place.
-- Forward-only; defaults transfer cleanly via RENAME COLUMN.

ALTER TABLE saved_meals RENAME COLUMN is_staple TO is_favorite;
