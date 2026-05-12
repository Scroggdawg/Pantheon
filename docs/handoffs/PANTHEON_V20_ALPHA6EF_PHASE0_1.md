# Op FASTRAK Brick Alpha.6 Sub-fix E+F — Phase 0

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code changes. Eight P0 questions answered. Awaiting V20 confirmation on Path A vs B + Pattern 1 lookup before EXECUTE.

---

## §0 — Status

Recon complete. Both web (useDailyLog hook) and native (Pantheon.tsx Promise.all) fetch food_log_entries via direct Supabase queries — there is no `/api/dashboard/today` endpoint. The is_favorite augmentation lives in the data-fetching layer of each side, not in a shared API endpoint.

Three load-bearing decisions surfaced for V20 confirmation:
- **Path A** (small Sub-fix C.1 endpoint extension before E+F) over Path B (fold into E+F bundle)
- **Pattern 1** for per-food saved_meal lookup (match on `(user_id, lower(trim(name)), coalesce(foods_json[0]->>'source_ref', ''))` with `jsonb_array_length=1` constraint)
- **Shape β at fetch boundary** for is_favorite projection (each side's data hook fetches favorites separately + enriches inline; TodayLog sees pre-enriched entries)

---

## §1 — Verbatim source for files referenced

| File | What I read |
|---|---|
| `app/dashboard/page.tsx:97,438,642` | useDailyLog hook gives `entries`; TodayLog at line 438 with `onEdit={setEditingEntry}`; `<FoodEntryEditModal>` at 642 |
| `hooks/useDailyLog.ts` (full file, 53 lines) | Direct supabase.from('food_log_entries').select('*') with logged_at range filter; returns entries+totals+refresh+deleteEntry |
| `components/dashboard/FoodEntryEditModal.tsx:34-80` | Takes `entry: FoodLogEntry` + onSaved/onDeleted/onClose props; iterates `editFoods.map((f, i) => ...)`; **no focus param yet** |
| `components/dashboard/TodayLog.tsx` (web, 169 lines) | Iterates entries → renders one button per entry with `foodNames = foods_json.map(name).join(', ')` |
| `components/screens/Pantheon.tsx:120-160,500` | Promise.all over food_log_entries + workout_sessions + weight_readings; setEntries(foodRows); TodayLog at line 500 |
| `components/dashboard/TodayLog.tsx` (native, 152 lines) | Same shape as web — iterates entries, foods_json.map(name).join(', ') in row title |
| `app/edit-food/[id].tsx` (native, 1-60 + 480-540) | useLocalSearchParams<{id}>; iterates editFoods.map((food, i) => ...) with qty + macros + close button per food; **no focus param yet** |
| `app/log-food.tsx:169,464,485` | 3 dead-code references to `saved_meal_action === 'created'`: comment + type union member + Undo overlay branch |

---

## §2 — Eight P0 answers

### P0.1 — Existing TodayLog state

**Web** (`components/dashboard/TodayLog.tsx:115-148`):
```tsx
{mealEntries.map((entry) => {
  const foodNames = entry.foods_json.map((f) => f.name).join(', ')
  return (
    <button onClick={() => onEdit(entry)} ...>
      <span>{foodNames}</span>
      <span>{entry.total_calories} cal</span>
    </button>
  )
})}
```

**Native** (`components/dashboard/TodayLog.tsx:71-99`):
```tsx
{mealEntries.map((entry, i) => {
  const foodNames = entry.foods_json.map((f) => f.name).join(", ")
  return (
    <Pressable onPress={() => onPressEntry?.(entry)}>
      <Text>{foodNames}</Text>
      <Text>{entry.total_calories} cal</Text>
    </Pressable>
  )
})}
```

**Cleanest insertion point for per-food iteration:** replace the `mealEntries.map(entry => ... <single row> ...)` with `mealEntries.flatMap(entry => entry.foods_json.map((food, foodIndex) => <card key={\`${entry.id}-${foodIndex}\`} ... />))` — same nesting, additional inner map.

**Web edit prop:** currently `onEdit(entry)` opens FoodEntryEditModal. To add focus support, change to `onEdit(entry, focusFoodIndex)` and lift the focus state into the parent dashboard's `setEditingEntry({entry, focusFoodIndex})`.

**Native edit nav:** currently `onPressEntry?.(entry)` triggers `router.push("/edit-food/" + entry.id)` (need to verify how Pantheon.tsx wires onPressEntry). To add focus, append `?focus=<index>` to the route.

### P0.2 — Heart endpoint extension cleavage (RECOMMEND PATH A)

**Recommend Path A — Sub-fix C.1 small dedicated commit before E+F.**

Reasoning:
1. Endpoint contract change is reviewable in isolation (same smoke pattern as Sub-fix C — curl + DB checks). UI work doesn't need to ride along.
2. C.1 commit is structurally a *signature widening* of an existing endpoint, not a new feature — it's the kind of small focused commit that's easy to revert if needed without touching UI.
3. If E+F UI surfaces issues during EXECUTE, the endpoint stays clean and shipped.
4. Single-purpose commits make git archeology easier later (e.g., "when did the heart endpoint start accepting food_index?").
5. V20's brief explicitly leaves this as Terminal's call. Path A matches the existing per-sub-fix discipline.

Tradeoff acknowledged: Path A means C.1's smoke validates a feature with no UI consumers yet — slightly less "real-world" than bundling. But the curl-based smoke pattern from Sub-fix C is sufficient.

### P0.3 — Per-food saved_meal lookup pattern (RECOMMEND PATTERN 1)

**Recommend Pattern 1 — match on `(user_id, lower(trim(name)), coalesce(foods_json[0]->>'source_ref', ''))` with `jsonb_array_length(foods_json) = 1` constraint.**

```sql
SELECT id FROM saved_meals
WHERE user_id = $1
  AND lower(trim(name)) = lower(trim($2))
  AND coalesce(foods_json->0->>'source_ref', '') = coalesce($3, '')
  AND jsonb_array_length(foods_json) = 1
LIMIT 1
```

Reasoning:
1. **No new schema.** Mirrors the existing dedup_key pattern from Phase 0 §P0.2 (the `recent_foods` view dedup, now hourly_go_tos dedup post-D.1). Single source of truth for "is this the same food entity."
2. **`jsonb_array_length(foods_json) = 1`** prevents per-food hearts from accidentally matching multi-food recipe saved_meals (created via select-mode "Save as Meal"). Recipes have foods_json with N>1 items; per-food hearts have 1.
3. **Idempotent lookup.** Re-hearting the same food finds the existing single-food saved_meal and flips is_favorite=true (no-op if already true). No duplicate creation.
4. **Survives source_ref nulls** via `coalesce` — legacy pre-Alpha.7 foods + USDA-sourced foods (with `usda:` prefix source_refs) all dedup correctly.

**food_log_entries.saved_meal_id audit column:** stays unchanged. Continues to track whole-entry → saved_meal correspondence used by the meals/log increment path. Per-food hearts don't read or write this column. Independent semantics, no conflict.

**Edge case considered:** Luke logs "3 eggs" via voice (no library_source_ref, source_ref might be null on the food). The food's source_ref might or might not be `lib:saved_meal:b4c2ac48-...` depending on whether the matcher resolved it pre-log. Pattern 1 still finds the existing saved_meal "3 eggs" (case-insensitive name match + source_ref match) → flips is_favorite=true on the existing row. No duplicate created. ✓

### P0.4 — Dashboard endpoint augmentation shape (RECOMMEND SHAPE β AT FETCH BOUNDARY)

**Recommend Shape β at the data-fetching layer in each side's existing hook/state machinery.**

Reasoning:
1. **No `/api/dashboard/today` endpoint exists.** Both web (useDailyLog) and native (Pantheon.tsx Promise.all) hit Supabase directly. There's no shared backend join surface to host Shape α cleanly.
2. **Shape α-via-Postgres-view** would require a new view that lateral-joins food_log_entries.foods_json[] against saved_meals.is_favorite, then somehow projects each food's is_favorite back into the entry's foods_json[] — JSONB-modifying views are awkward and brittle.
3. **Shape β at fetch boundary** lets each side add a parallel `saved_meals?is_favorite=eq.true` query in its existing fetch logic. Build a `Set<dedup_key>` of favorited entries, then enrich each `foods_json[i]` with `is_favorite = favorites.has(dedupKey(food))` before passing to TodayLog.
4. **Both repos share the dedup_key logic** — extract a small helper (`favoritesDedupKey(name, source_ref)`) used by both sides. Native + web codebases each get a copy; ~5 lines.
5. **TodayLog stays clean** — receives entries with foods_json items already enriched. No conditional rendering branches.

**Implementation outline (web side — useDailyLog.ts):**
```ts
const [entriesRes, favsRes] = await Promise.all([
  supabase.from('food_log_entries').select('*').eq('user_id', userId).gte/lte/order...,
  supabase.from('saved_meals').select('id, name, foods_json').eq('user_id', userId).eq('is_favorite', true),
])
const favSet = new Set<string>()
for (const sm of favsRes.data ?? []) {
  if (jsonb_array_length(sm.foods_json) === 1) {
    favSet.add(favKey(sm.name, sm.foods_json[0].source_ref))
  }
}
const enriched = (entriesRes.data ?? []).map(entry => ({
  ...entry,
  foods_json: entry.foods_json.map(food => ({
    ...food,
    is_favorite: favSet.has(favKey(food.name, food.source_ref)),
  }))
}))
```

Native gets the same pattern in Pantheon.tsx.

### P0.5 — Card visual primitive (RECOMMEND inline extension, no new component)

**Recommend extending existing patterns inline. No new FoodCard component file for this brick.**

Reasoning:
1. **Both TodayLog files are small** (web 169 lines, native 152 lines) — refactoring to per-food cards in-place stays under ~200 lines each.
2. **Pantheon's existing visual system** (web Tailwind divs with gold accent, native View+StyleSheet under GlassPanel) doesn't have a generalized "card" primitive that would benefit from extraction. GlassPanel is the OUTER container; the items inside are flex rows.
3. **Card semantic = "smaller styled flex row inside the existing GlassPanel."** Same shape as today's row, just iterated per-food instead of per-entry, with one heart icon added.
4. **YAGNI** — if Brick Zeta+ surface adds more card-shaped UI elsewhere (FoodPicker, MealHistory, etc.), extraction can happen then. For now, keep the per-food card definition local to each TodayLog.tsx.

If V20 disagrees and prefers a `FoodCard` component file, the extraction is a small follow-up — but I think it's premature.

### P0.6 — meal_label sectioning logic preserves cleanly

**Confirmed.** Both files have `groupByMeal(entries)` which buckets entries by `meal_label`. The refactor: iterate entries within each meal_label bucket → flatMap(entry.foods_json.map((food, i) => <card>)) within each bucket. The grouping operates on entries; the card-rendering operates on foods within each grouped entry. Sort within meal_label = parent entry's `logged_at` ascending (already the case via the supabase `.order('logged_at', { ascending: true })` query).

No structural changes to grouping. Just an additional inner `.map((food, foodIndex) => ...)` loop.

### P0.7 — Web edit modal focus support

**Status: not yet implemented. Needs small extension.**

Current `FoodEntryEditModal` props:
```ts
interface FoodEntryEditModalProps {
  entry: FoodLogEntry
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}
```

Target:
```ts
interface FoodEntryEditModalProps {
  entry: FoodLogEntry
  focusFoodIndex?: number     // NEW
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}
```

Behavior: on mount, if `focusFoodIndex !== undefined`, scroll to that food's row in the list + apply a brief gold-border highlight (~1.5s pulse) to draw the eye. The modal already iterates `editFoods.map((f, i) => ...)` — the scroll target would be a `<div ref={focusRef}>` wrapper at index === focusFoodIndex.

**Scope:** ~15 lines of focus-on-mount logic in the modal + 1 prop addition. Trivial.

**Dashboard page state:** `setEditingEntry` becomes `setEditingEntry({entry, focusFoodIndex})` (new tuple type). TodayLog's onEdit callback signature changes from `(entry) => void` to `(entry, focusFoodIndex) => void`.

### P0.8 — Sub-fix split timing (RECOMMEND THREE COMMITS)

**Recommend three separate commits, but bundled under one Gate 1 review:**

1. **Sub-fix C.1 (web repo):** Heart endpoint extension. Smoke-validated with curl. Lands first.
2. **Sub-fix F (web repo):** Web TodayLog refactor + FoodEntryEditModal focus prop + useDailyLog augmentation. Heart UI consumes the C.1 endpoint.
3. **Sub-fix E (native repo):** Native TodayLog refactor + edit-food/[id].tsx focus param + Pantheon.tsx augmentation. Heart UI consumes the C.1 endpoint.

**Why 3 commits, 1 Gate 1:**
- Web vs native are different repos — they MUST be different commits
- C.1 is a clean small commit with its own smoke surface; bundling it into F couples backend contract change with UI work
- Single Gate 1 review keeps the bundle coherent (V20 reviews the trio together)

If V20 wants strictly two commits (one per repo), I can fold C.1 into F. Mild loss of clarity in git history but works.

---

## §3 — Flags / surprises / disagreements

### F.1 — Carry-forward grep findings (per Sub-fix B §S.2)

3 dead-code references to `saved_meal_action === 'created'` in `/Users/scrogdawg/Code/pantheon-native/app/log-food.tsx`:
- Line 169 — comment
- Line 464 — type union member `"incremented" | "created" | "none"`
- Line 485 — `if (action === 'created' && respJson.saved_meal_id) { setPendingUndo(...) }` — entire Undo overlay branch is dead

The Undo overlay code (lines 480-end-of-block) was tied to auto-promote — now removed. The whole pendingUndo state + countdown + UI is dead. Trim during Sub-fix E.

**Web side:** 0 hits via grep. Web didn't have an Undo overlay.

**Disposition:** Dead-code trim on native log-food.tsx is part of Sub-fix E scope. I'll consolidate it into the native commit alongside the TodayLog refactor.

### F.2 — Per-food card adds rendering volume

Luke's typical multi-food meal entry has 2-5 foods. Post-refactor, a 5-food entry renders 5 cards instead of 1 row. For a typical day with ~5 entries × ~3 foods avg = ~15 cards in TodayLog. Layout-fine at this scale, but flagging in case V20 wants to pre-empt with virtualization (`FlatList` on native, react-window on web). **My read:** premature; revisit if perf surfaces.

### F.3 — `is_favorite` enrichment on foods_json[i]

The data-fetching enrichment writes a render-only `is_favorite: boolean` field onto each food in the in-memory entries. The DB foods_json items don't have this field. If any code path reads-then-writes-back foods_json (e.g., edit screen save), the enrichment field would silently persist into the DB.

**Mitigation:** strip `is_favorite` from foods at the edit-screen save boundary. Or use a parallel structure (entries.foods_with_favorites: {food, is_favorite}[]). The strip-at-write approach is simpler.

**Disposition:** Will use strip-at-write. Cleaner for the consumer code; the only writeback is in the edit modal save path which already does `setFoods(editFoods.map(...))` — easy to add `({...food}` and drop `is_favorite`).

### F.4 — No disagreements with the brief

Locked product decisions D.1-D.6 are clear. The 8 P0 questions are well-scoped. My judgment calls (Path A, Pattern 1, Shape β, inline cards, three-commit split) are within the latitude V20 explicitly granted in the brief.

---

## §4 — Asks / greenlight requests

**A.1 — V20 confirms Path A (small Sub-fix C.1 first, then F + E).** Green: proceed. Red: I fold C.1 into F.

**A.2 — V20 confirms Pattern 1 for per-food lookup.** Green: proceed. Red: surface alternative (Pattern 2 mapping table) for further discussion.

**A.3 — V20 confirms Shape β at fetch boundary.** Green: proceed. Red: discuss Postgres view alternative.

**A.4 — V20 confirms inline cards (no new FoodCard component).** Green: proceed. Red: extract FoodCard.tsx in each repo.

**A.5 — Greenlight EXECUTE on the bundle in three commits (C.1 → F → E).** With A.1-A.4 confirmed, EXECUTE proceeds.

**A.6 — Sub-fix G brief has not yet arrived in my queue.** V20 mentioned it was sent but I haven't received it. Will fire G whenever the brief lands; can interleave with E+F or run after.

---

## §5 — Plan re-evaluation

E+F bundle scope is well-understood. Three commits estimated:
- C.1: ~30 turns of code reading + 1 turn implementation + smoke + commit
- F: web TodayLog refactor + useDailyLog augmentation + FoodEntryEditModal focus prop + heart UI wiring + dashboard page state shape change. ~2 turns.
- E: native TodayLog refactor + Pantheon.tsx fetch augmentation + edit-food focus param + heart UI wiring + dead-code trim on log-food.tsx. ~2 turns.

Bundle smoke (after all three commit): 1 turn.

Estimate: **5-6 turns** for the bundle including this Phase 0. Tracks V20's 3-5 turn estimate (Phase 0 was scoped as 1 turn; the rest follows).

After E+F + G land + bundle smoke clean: Gate 2 PROCEED PUSH (single push window for all 8 commits across web + native), eas update OTA, Brick Alpha.6 closes.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6EF_PHASE0_1.md
