# Codex Multi-Chat Startup Checklist

Use this when spinning up two or more Pantheon Codex chats.

## Fast Answer

Copying a brief from `docs/CODEX_CHAT_BRIEFS.md` is enough to orient a chat, but it is not enough to make parallel work safe by itself. Safe parallel work also needs separate branches/worktrees, clean handoffs, and one integration owner before release.

## One-Time Setup

1. Make sure each real repo has a committed baseline.

   ```bash
   git status --short --branch
   git log --oneline -5
   ```

   If Git says there are no commits yet, create an initial checkpoint before using worktrees.

2. Confirm the repo paths.

   Web is usually:

   ```text
   /Users/scroggdawg/Code/pantheon
   ```

   Native is usually:

   ```text
   /Users/scroggdawg/Code/pantheon-native
   ```

3. Put the coordination docs where both repos/chats can see them.

   At minimum, each chat should be pointed to:

   ```text
   AGENTS.md
   docs/CODEX_MULTI_CHAT_PROTOCOL.md
   docs/CODEX_CHAT_BRIEFS.md
   docs/CODEX_HANDOFF_TEMPLATE.md
   ```

## Starting Two Worker Chats

1. Decide the lanes.

   Examples:

   ```text
   Chat A: Web/API lane
   Chat B: Native OTA lane
   Chat C: Integration lane
   ```

2. Create one branch/worktree per worker from a clean base.

   Example:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only
   git worktree add ../pantheon-web-parse-contract -b codex/web-parse-contract origin/main
   git worktree add ../pantheon-native-ota-log-food -b codex/native-ota-log-food origin/main
   ```

   Use the native repo for native worktrees and the web repo for web worktrees.

3. Paste the matching brief from `docs/CODEX_CHAT_BRIEFS.md` into each chat.

4. Add the exact assignment:

   ```text
   Your worktree is [absolute path].
   Your branch is [branch].
   Your goal is [specific goal].
   Your integration owner is [integration chat/branch].
   Do not push or release until I say so.
   ```

## During Work

- Keep each chat inside its lane.
- If a chat needs a shared lock file, stop and route that through integration.
- Ask chats for a quick status ping before they touch overlapping files.
- Have each worker finish with `docs/CODEX_HANDOFF_TEMPLATE.md`.

## Integration Step

Do not go directly from two worker chats to release.

Start or use an integration chat and give it:

- The integration brief from `docs/CODEX_CHAT_BRIEFS.md`.
- Each worker handoff.
- Each branch/worktree path.

The integration chat owns:

- Merging/rebasing.
- Shared-file conflicts.
- Final checks.
- Release order.
- OTA vs EAS verdict.
- Push/deploy/build commands that still need approval.

## Minimum Release Gate

Before any push, OTA, EAS build, migration, or deploy:

- `git status --short --branch`
- Review `git diff --stat`.
- Confirm no unowned shared-lock edits.
- Run web checks if web changed.
- Run native checks/smoke if native changed.
- Confirm API contract compatibility if both web and native changed.
- Confirm migration/data approval if database work changed.
- Confirm OTA/EAS decision if native changed.

## The Copy-Paste Starter

Use this if you want the shortest possible instruction:

```text
Before editing, read AGENTS.md, docs/CODEX_MULTI_CHAT_PROTOCOL.md, docs/CODEX_CHAT_BRIEFS.md, and docs/CODEX_HANDOFF_TEMPLATE.md.

Your worktree is [absolute path].
Your branch is [branch].
Your lane is [Web/API | Native OTA | Native Runtime/EAS | Integration].
Your goal is [specific goal].
Your integration owner is [integration chat/branch].

Stay inside your lane. Do not touch shared lock files unless you call it out first. End with the handoff template. Do not push, deploy, publish OTA, run EAS, run migrations, or mutate production data unless I explicitly approve it in this chat.
```
