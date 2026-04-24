# PANTHEON SESSION 16 — COMPLETION HANDOFF

**Date:** 2026-04-24
**Production:** https://pantheon.guru
**Previous session:** Session 15 (Withings Body+ scale integration)
**Trigger:** Native app (separate repo at `~/Code/pantheon-native`) was receiving HTTP 405 when calling `/api/claude/parse-meal`. Curl evidence from native-side Session 2e.1 confirmed the cause: this repo's `proxy.ts` was 307-redirecting unauthenticated POSTs to `/login`, and React Native's `fetch` follows the redirect preserving POST, landing on the GET-only `/login` route → 405.

---

## WHAT WAS BUILT

A shared-secret exemption path in `proxy.ts` for four API routes that the native app calls without a browser session. The middleware now accepts native requests via the `x-pantheon-native-secret` header while preserving the cookie-based `pantheon_session` gate for browser traffic on every other route.

### Behavior matrix

| Scenario | Outcome |
|---|---|
| Native route + correct secret header | `NextResponse.next()` (pass) |
| Native route + wrong secret header (any cookie state) | `401 { error: "Unauthorized" }` — immediate, no cookie fall-through |
| Native route + no header + valid cookie | Pass (browser path preserved) |
| Native route + no header + no cookie | Redirect to `/login` |
| Native route + any secret header + env var missing at runtime | `console.warn` + `500 { error: "Server misconfigured" }` (fail closed) |
| Non-native route + valid cookie | Pass (unchanged) |
| Non-native route + no cookie | Redirect to `/login` (unchanged) |

### Exempted routes

Exact-match only (non-dynamic paths):

1. `POST /api/claude/parse-meal`
2. `POST /api/claude/parse-workout`
3. `POST /api/claude/parse-workout-image`
4. `POST /api/withings/sync`

Other Claude routes (`/api/claude/daily-plan`, `/api/claude/score`, `/api/claude/coach`) remain behind the cookie gate — they are only called from the browser dashboard.

### Header + env var names

- **Request header:** `x-pantheon-native-secret`
- **Server env var:** `PANTHEON_NATIVE_SHARED_SECRET`
- **Native env var (future):** `EXPO_PUBLIC_PANTHEON_NATIVE_SECRET` (native follow-up session)

---

## NEW/MODIFIED FILES

```
proxy.ts                           MODIFIED — Native-secret exemption branch for 4 routes + 401 on mismatch + 500 fail-closed
.gitignore                         MODIFIED — One-line negation `!.env.example` so the example file can be committed
.env.example                       NEW      — Documents all 12 env vars used across the repo (names only, empty values)
.env.local                         MODIFIED — Appended PANTHEON_NATIVE_SHARED_SECRET (NOT committed, gitignored)
PANTHEON_SESSION_16_COMPLETION.md  NEW      — This file
```

### `.env.example` coverage

Pulled from `grep -rn "process.env.*" --include='*.{ts,tsx,js,mjs}'`. Twelve vars:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auth: `PANTHEON_PASSWORD`, `PANTHEON_NATIVE_SHARED_SECRET` (new)
- Claude: `ANTHROPIC_API_KEY`
- Withings: `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`
- Wyze (legacy, kept for /api/wyze/sync): `WYZE_EMAIL`, `WYZE_PASSWORD`, `WYZE_KEY_ID`, `WYZE_API_KEY`

---

## VERCEL PRODUCTION CONFIG

Completed during Session 16 before the commit:

```bash
# Add the secret to Vercel production env.
npx vercel env add PANTHEON_NATIVE_SHARED_SECRET production
# (value pasted from .env.local — the 64-char hex generated this session)

# Redeploy so the new env var flows into the live deployment.
npx vercel --prod --yes
```

Deployment confirmed: `dpl_8huQURhVDuSQckmz4xnRuiYLxZnG`, aliased to `https://pantheon.guru`, status READY, TypeScript clean during build. Proxy middleware + all four exempted routes present in build output.

The secret value lives in exactly three places: `.env.local` on Luke's machine, Luke's password manager, Vercel production env. Do NOT commit `.env.local`. Do NOT paste the secret into any file other than those three places.

---

## VERIFICATION — Production curl checks

Run these AFTER Vercel env add + redeploy.

### 1. Correct secret — should reach the route handler

```bash
curl -iX POST https://pantheon.guru/api/claude/parse-meal \
  -H "Content-Type: application/json" \
  -H "x-pantheon-native-secret: <SECRET>" \
  -d '{"transcript":"3 eggs"}'
```

**Expected:** `HTTP/2 200` with parsed meal JSON, OR `HTTP/2 4xx` from the route handler itself (e.g., if Claude API key is missing, or request body is malformed). What matters is **no 307/401/500** — the middleware passes the request through, and any status code comes from the route itself.

### 2. Missing header — existing browser-path behavior unchanged

```bash
curl -iX POST https://pantheon.guru/api/claude/parse-meal \
  -H "Content-Type: application/json" \
  -d '{"transcript":"3 eggs"}'
```

**Expected:** `HTTP/2 307` with `location: /login`. This is the unchanged pre-Session-16 behavior for browser-path requests without cookies.

### 3. Wrong header — immediate 401

```bash
curl -iX POST https://pantheon.guru/api/claude/parse-meal \
  -H "Content-Type: application/json" \
  -H "x-pantheon-native-secret: definitely-wrong" \
  -d '{"transcript":"3 eggs"}'
```

**Expected:** `HTTP/2 401` with body `{"error":"Unauthorized"}`. Not a 307 redirect. A stray valid `pantheon_session` cookie does NOT rescue this request — the wrong-header branch returns 401 unconditionally.

### 4. Browser session smoke test

Visit `https://pantheon.guru/dashboard` in a browser with an existing `pantheon_session=1` cookie. The dashboard should load normally. Trigger any non-exempted Claude action (e.g., score auto-calc, daily plan) to confirm the cookie gate still permits `/api/claude/score` and `/api/claude/daily-plan`. This validates that the Session 16 changes didn't break the cookie path.

---

## NATIVE-REPO FOLLOW-UP (separate session, native repo only)

The native repo `~/Code/pantheon-native` currently calls `/api/claude/parse-meal` from `app/log-food.tsx` without any auth header. This worked before the web-side auth middleware was added; since then it's been returning 405. A short follow-up session should:

1. Add `EXPO_PUBLIC_PANTHEON_NATIVE_SECRET=<SECRET>` to the native repo's `.env` (gitignored) and `app.json`'s `extra` block as needed for EAS.
2. Introduce an `apiFetch(path, init?)` wrapper colocated with `apiUrl` in `lib/api.ts`. Internally it resolves the full URL via `apiUrl(path)` and ALWAYS injects the `x-pantheon-native-secret` header. Web-side `proxy.ts` ignores the header on non-exempted routes, so sending it universally is harmless and makes it structurally impossible for a future callsite to forget.
3. Migrate the existing `fetch` in `app/log-food.tsx` to use `apiFetch`. Do NOT export a standalone `nativeHeaders()` helper — standalone helpers invite the "whoops, spread forgotten" footgun. The wrapper is the only sanctioned path.
4. When 2f/2g/etc. add the other exempted routes (`parse-workout`, `parse-workout-image`, `withings/sync`), they call `apiFetch` automatically — no TODO comments, no checklists.
5. Retest the end-to-end parse flow (Session 2e's test plan) in the simulator.

Security caveat: `EXPO_PUBLIC_*` vars are inlined into the JS bundle. For a single-user app distributed only to Luke's device via Expo Go this is acceptable; if Pantheon is ever packaged for App Store distribution, replace the shared-secret mechanism with per-device short-lived tokens.

---

## OPEN ITEMS / KNOWN ISSUES

1. **Native repo still broken on production until follow-up lands** — `/api/claude/parse-meal` will keep returning 307→405 on the native app until the `apiFetch` wrapper wires the header in. Web browser path is unaffected.
2. **RLS policies remain permissive for single-user mode** — Custom cookie auth means `auth.uid()` is always NULL, so strict RLS would block every client insert. The practical workaround (documented since Session 2) is permissive RLS + server routes using the service-role key. Revisit if/when Pantheon moves beyond single-user; not a bug for current use.
3. **Stale untracked files in git** — Session 16 deliberately did NOT stage the many pre-existing untracked docs/files from Sessions 12–15 and prior. Scope discipline: Session 16 commits only `proxy.ts`, `.gitignore`, `.env.example`, and this file. Cleanup of the stale untracked state is a candidate for a future housekeeping session.

---

## SESSION 17 CANDIDATES

- Native-repo follow-up (wire the `apiFetch` wrapper — see above)
- Wyze sync cleanup: remove `/api/wyze/sync` route + `lib/wyze/wyze.ts` + Wyze env vars from `.env.example` (flagged as legacy in Session 15)
- Per-device short-lived token scheme instead of shared secret (only if Pantheon moves beyond single-user)
- Stale untracked-files housekeeping (sweep untracked session docs into one tidy commit)
- Carry-forwards from Session 15: overview strip refresh, ManualWeightModal pre-fill, coach persistence, dayType persistence
