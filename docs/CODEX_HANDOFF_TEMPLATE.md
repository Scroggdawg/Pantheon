# Codex Handoff Template

Use this for active work handoffs. Keep it short enough that the next chat can act on it without rereading the entire conversation.

```md
# Pantheon Handoff: [short title]

Date: [YYYY-MM-DD]
Author/chat: [Codex chat name if useful]
Repo/worktree: [absolute path]
Branch: [branch name]
Base branch/commit: [base]
Release lane: [web deploy | native OTA | native EAS build | migration/data | no release | integration review]
Status: [complete | partial | blocked | needs integration]

## Goal

[One or two sentences.]

## Summary

[What changed and why.]

## Files Changed

- `[path]` - [purpose]

## Files Intentionally Avoided

- `[path or pattern]` - [reason]

## Shared Locks Touched

- None

or

- `[path]` - [why this chat touched it and what integration must check]

## Verification

- `[command/check]` - [pass/fail/not run and why]

## API / Data / Release Impact

- API contract: [none/backward compatible/breaking/needs native follow-up]
- Migration/data: [none/approval needed/applied with approval]
- Native OTA: [not applicable/safe/blocked/build required/needs integration review]
- Web deploy: [not applicable/safe/approval needed]

## Risks

- [Known risk or "None known."]

## Next Step

[The single next action the next chat should take.]

## Approval Needed

- [Explicit approval needed before release/migration/build/push, or "None."]
```
