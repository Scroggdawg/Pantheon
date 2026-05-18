# Pantheon S28 Quartermaster Event Telemetry 1

Date: 2026-05-18
Status: Web event stream implemented; database migration applied; native event hooks prepared locally.

## Summary

Quartermaster v0 could audit saved food logs, but could not see failures that happened before a save row existed.

This pass adds the web-side event stream needed for Quartermaster v1:

- schema migration for `food_log_events`;
- native-authenticated web endpoint at `/api/food-log-events`;
- Quartermaster reader support for event rows;
- docs describing the new visibility layer.

The native log-food screen has also been locally wired to emit best-effort events around parse, edit, and save moments. Those native edits are intentionally not committed from the web repo because the native worktree already contains unrelated in-progress changes on `codex/log-food-plate-workflow`.

## Web Files

Added:

- `supabase/migrations/022_food_log_events.sql`
- `app/api/food-log-events/route.ts`
- `docs/handoffs/PANTHEON_S28_QUARTERMASTER_EVENT_TELEMETRY_1.md`

Updated:

- `proxy.ts`
- `scripts/quartermaster-audit.ts`
- `docs/QUARTERMASTER.md`

## Event Types

Supported event types:

- `parse_requested`
- `parse_returned`
- `parse_failed`
- `parse_abandoned`
- `food_item_edited`
- `food_item_deleted`
- `food_item_added`
- `disambiguation_selected`
- `save_requested`
- `save_succeeded`
- `save_failed`
- `quick_add_after_parse`
- `retry_after_parse`

## Migration Status

Applied on 2026-05-18 after installing and logging into Supabase CLI on Hive.

Commands/results:

```bash
supabase link --project-ref qlkjgguxjddalbswoxpm
supabase migration list
supabase db push
```

Remote status now shows local/remote migration `022` applied.

Direct verification via service-role query returned `food_log_events count: 0`, which is expected before native sends events.

Quartermaster now sees the event table and reports `event_table_available: yes`.

## Native Local Patch

Native repo:

```text
/Users/scroggdawg/Code/pantheon-native
```

Touched local file:

- `app/log-food.tsx`

The local patch emits best-effort events to `/api/food-log-events` for:

- parse requested;
- parse returned;
- parse failed;
- food item added;
- food item edited;
- food item deleted;
- disambiguation selected;
- save requested;
- save succeeded;
- save failed;
- parse abandoned via clear/cancel.

The event calls use `apiFetch`, so they carry the same native shared-secret header as existing parse/save routes.

Do not publish OTA/EAS from this handoff alone. First coordinate with the existing native dirty worktree and run simulator smoke.

## Verification

Passed in web repo:

- `npm run typecheck`
- `npm run lint`
- `npm run quartermaster -- --limit=5`

Passed in native repo for touched surface:

- `npx tsc --noEmit`
- `npx eslint app/log-food.tsx`

Full native `npm run lint` remains blocked by an existing generated-file resolver issue:

```text
components/ui/VersionFooter.tsx
Unable to resolve path to module '@/constants/buildInfo'
```

`constants/buildInfo.ts` can be generated with `node scripts/write-build-info.js`, but Expo lint still reports the resolver issue. This appears unrelated to the Quartermaster event hook patch.

## Next Steps

1. Coordinate/commit the native event hook patch with the existing native branch owner.
2. Run a simulator food-log smoke now that the event table exists.
3. Re-run Quartermaster and confirm `event_rows_read` increases after a parse/save/fail cycle.
4. Use the first real event-backed report to prioritize failed-save/edit/unit-preservation work.
