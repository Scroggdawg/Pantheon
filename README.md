# Pantheon Web

Pantheon Web is the backend/admin/API companion to Pantheon Native.

Native is the primary user experience. This repo remains live because it hosts server-side capabilities that native depends on.

## Main Responsibilities

- AI meal/workout parsing routes
- Whisper transcription
- Withings OAuth and sync
- Admin/pantry product workflows
- Meal-plan generation and promotion
- Supabase migrations and server-side data utilities
- Vercel deployment

## Quick Start

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Important Files

- `app/api/claude/parse-meal/route.ts` - native/web meal parse entrypoint.
- `lib/claude/tools/search-user-library.ts` - personal library matcher.
- `lib/claude/parse-meal-library-shortcut.ts` - shortcut/candidates/segmenter layer.
- `app/api/meals/log/route.ts` - server-side meal logging route used by native.
- `app/api/admin/pantry/*` - product search/save workflows.
- `supabase/migrations/` - database migrations.
- `AGENTS.md` - operating rules for agents.
- `docs/CODEX_MULTI_CHAT_PROTOCOL.md` - branch/worktree and multi-chat coordination rules.
- `docs/CODEX_MULTI_CHAT_STARTUP.md` - practical checklist for starting parallel chats.
- `docs/CODEX_CHAT_BRIEFS.md` - paste-ready prompts for parallel Codex chats.

## Environment

Do not commit raw env values. `.env*` is ignored except `.env.example`.

Important env var categories:

- Supabase URL/anon/service-role keys
- Anthropic/OpenAI keys
- Native shared secret
- Withings OAuth credentials
- Vercel/project settings

## Deployment Notes

Vercel production changes require explicit approval. Database migrations require explicit approval. Production data mutations require explicit approval.

When changing API response shapes, check native callers in `/Users/scrogdawg/Code/pantheon-native`.
