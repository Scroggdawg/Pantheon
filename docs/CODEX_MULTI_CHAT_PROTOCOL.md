# Codex Multi-Chat Protocol

Status: current operating protocol for Pantheon multi-agent work.

Pantheon can safely use multiple Codex chats at once if each chat has a clear Git lane, release lane, and handoff contract. The goal is not to avoid overlap forever; the goal is to make overlap visible early enough that it can be integrated deliberately.

## Mental Model

- Project: the product context and docs.
- Chat: one worker with its own conversation state.
- Worktree: one durable Git checkout tied to one branch.
- Integration chat: the only chat that merges overlapping work and decides release order.

Default rule:

```text
one active chat = one branch/worktree = one bounded job
```

If two chats both need the same file, pause one of them or assign that file to the integration chat.

## Recommended Worktrees

Use permanent worktrees for long-running Pantheon work because native and web both have setup cost, generated state, and release-sensitive files.

Suggested local layout:

```text
/Users/scroggdawg/Code/pantheon-web-main          main/develop checkout
/Users/scroggdawg/Code/pantheon-web-ota-api       codex/web-ota-api-bridge
/Users/scroggdawg/Code/pantheon-native-ota-ui     codex/native-ota-ui
/Users/scroggdawg/Code/pantheon-native-build      codex/native-build-runtime
/Users/scroggdawg/Code/pantheon-integration       codex/integration-YYYY-MM-DD
```

Create a new permanent worktree from a clean base branch:

```bash
git fetch origin
git switch main
git pull --ff-only
git worktree add ../pantheon-native-ota-ui -b codex/native-ota-ui origin/main
```

If the repo has no commits yet, make an initial checkpoint commit before relying on worktrees. Git worktrees need committed branch history to be useful.

## Branch Naming

Use names that reveal lane and intent:

```text
codex/web-parse-contract
codex/web-pantry-admin
codex/native-ota-log-food
codex/native-build-healthkit
codex/integration-release-2026-05-20
```

Avoid branch names like `codex/fixes` or `codex/update`; they do not help the other chats reason about collisions.

## Work Lanes

### Web/API Lane

Owns:

- `app/api/**`
- `lib/claude/**`
- `lib/pantry-builder/**`
- `lib/supabase/**`
- `scripts/**`
- `supabase/migrations/**` only with explicit migration approval
- admin/pantry web surfaces

Release lane:

- Vercel deploy if pushed to a deploy-connected branch.
- Production deploy/promote/rollback requires explicit approval.
- Supabase migrations require explicit approval.

Verify:

```bash
npm run typecheck
npm run lint
npm run build
```

Use `npm run build` for routing, middleware, runtime, or deployment-sensitive changes.

### Native OTA Lane

Owns:

- React Native screens/components/hooks.
- JS/TS-only UX work.
- Copy, loading states, form state, data presentation.
- API caller changes that stay compatible with the current native runtime.

Avoid unless explicitly scoped:

- `ios/**`
- `android/**`
- native module installs
- Expo config/plugin changes
- `patches/**`
- `eas.json`
- runtime/version policy

Release lane:

- OTA only after reading native `OTA_RUNBOOK.md`.
- Use `eas update --platform ios` when publishing OTA.
- Do not publish OTA without explicit approval in the current chat.

### Native Runtime / EAS Lane

Owns:

- `ios/**`
- `android/**`
- `app.json` / `app.config.*`
- `eas.json`
- native modules
- permissions
- widgets/App Groups
- HealthKit and other native integrations
- patch files

Release lane:

- EAS build/TestFlight.
- Never run build/submit/publish casually.
- Coordinate with any OTA lane before and after the build because the binary base may change.

### Integration Lane

Owns:

- Merging/rebasing branches.
- Shared dependency/config files.
- Release order.
- Final verification matrix.
- Commit/push/PR packaging.

The integration chat should be created when:

- Two branches edit the same file.
- Web and native contracts change together.
- An OTA depends on a web deploy.
- A migration and client UI change need to land atomically.
- A native build changes the binary base for future OTAs.

## Shared-File Locks

These files are high-collision. Only one chat should edit them at a time unless the integration chat is active:

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
app.json
app.config.*
eas.json
next.config.*
vercel.json
tsconfig.json
AGENTS.md
README.md
supabase/migrations/**
types/**
shared API/client modules
release/version/build-info files
```

If a non-integration chat discovers it must edit one of these, it should say so in its handoff before editing or ask Luke to promote the task to integration.

## Native/Web Contract Changes

Treat API response shape changes as shared contract work.

Before changing a web API consumed by native:

1. Identify native callers.
2. Keep backward compatibility when possible.
3. Add optional fields before requiring new ones.
4. Update native and web in separate branches only if an integration chat owns the final merge.
5. Document the release order: web first, native first, OTA after web, or build required.

If old native clients would break, this is not a normal OTA-safe change.

## OTA vs Native Build Decision

OTA-safe examples:

- UI layout/copy inside existing JS surfaces.
- Client-side state handling.
- Displaying optional fields from an existing response.
- Bug fix in JS that does not change native config or dependencies.

Build-required examples:

- New native dependency.
- Expo config/plugin change.
- Permission change.
- `ios/**`, `android/**`, `patches/**`, or `eas.json` edits.
- Widget/App Group/native target changes.
- Runtime/version policy change.

When uncertain, classify as "needs integration review" rather than guessing.

## Handoff Contract

Every meaningful chat should end with a handoff that includes:

- Branch/worktree.
- Goal and current status.
- Files changed.
- Files intentionally avoided.
- Tests/checks run and results.
- Known risks.
- Release lane and release status.
- Next recommended step.

Use `docs/CODEX_HANDOFF_TEMPLATE.md` for new handoffs.

## Integration Checklist

Before push/release, the integration chat should verify:

- `git status --short --branch`
- `git diff --stat` and targeted `git diff`
- No unowned shared-file edits.
- Web checks passed if web changed.
- Native checks/simulator smoke passed if native changed.
- API response compatibility checked if web/native touched the same flow.
- Migration approval exists if migrations changed.
- OTA/EAS decision recorded if native changed.
- Rollback path known for deploy/OTA/build.

## What To Tell A New Chat

Give the other chat one of the paste-ready briefs in `docs/CODEX_CHAT_BRIEFS.md`, then tell it which branch/worktree it owns.

The brief matters more than the exact wording. The key is that every chat knows its lane, the shared-file locks, and who owns final integration.
