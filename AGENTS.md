<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pantheon Web Agent Guide

Pantheon Web is no longer the primary user experience. Treat it as the backend/admin/API surface for Pantheon Native unless Luke explicitly scopes web UI work.

## Responsibilities

- AI parsing routes (`/api/claude/*`)
- Whisper transcription
- Withings OAuth and sync
- Admin/pantry product workflows
- Meal plan generation/promotion routes
- Vercel deployment surface

## Operating Rules

- Do not mutate production Supabase data without explicit approval.
- Do not run migrations without explicit approval.
- Do not deploy, promote, rollback, or alter Vercel production settings without explicit approval.
- Do not print raw `.env.local` values, service-role keys, API keys, OAuth secrets, or password-manager data.
- Keep native compatibility in mind for every API response shape.
- The native app calls web through a shared-secret header on selected routes; do not weaken that boundary.
- Prefer server routes/RPCs for risky writes instead of expanding browser-direct Supabase writes.

## Standard Checks

For meaningful web changes, run:

```bash
npm run typecheck
npm run lint
```

Use `npm run build` when changing Next.js routing, middleware, server/runtime behavior, or deployment-sensitive code.

## Native/Web Contract

Native is the canonical app. Web should remain reliable as the control room: API, admin, pantry, AI, Withings, and Vercel. Shared contracts must be updated deliberately across both repos.

## Multi-Chat Coordination

When more than one Codex/agent chat is active, read `docs/CODEX_MULTI_CHAT_PROTOCOL.md` before planning or editing. Treat it as the current coordination contract for branch/worktree ownership, OTA/native release boundaries, shared-file locks, and handoff expectations.

If work may overlap with another chat, declare:

- Branch/worktree in use.
- Owned scope and files.
- Files intentionally avoided.
- Release lane: web deploy, native OTA, native EAS build, data/migration, or no release.

Do not publish OTA, run EAS build/submit, deploy/promote/rollback Vercel, run migrations, or mutate production data unless Luke explicitly asks for that action in the current chat or the active handoff says it is already approved.
