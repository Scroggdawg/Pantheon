import { NextResponse, type NextRequest } from 'next/server'

const NATIVE_ROUTES = [
  '/api/claude/parse-meal',
  '/api/claude/parse-workout',
  '/api/claude/parse-workout-image',
  '/api/claude/parse-recipe',
  '/api/whisper/transcribe',
  '/api/withings/sync',
  // S26 Step 3: native meal-log writer (post-Op-FASTRAK-Alpha.6 ships
  // increment-only — auto-promote create path moved to /api/saved_meals/heart).
  '/api/meals/log',
  // Quartermaster v1 — native food-log UX breadcrumbs: failed saves,
  // abandoned parses, edits, and other events that do not always become
  // food_log_entries rows.
  '/api/food-log-events',
  // Op FASTRAK Alpha.6 — heart-icon save/un-save handler. POST hearts a
  // food_log_entries row (creates saved_meal or flips is_favorite=true);
  // DELETE un-hearts (flips is_favorite=false).
  '/api/saved_meals/heart',
  // Pre-gated for Step 6 (camera lane). Routes are empty 404 stubs today;
  // gating now means Step 6 ships gated by default rather than retrofitted.
  '/api/food/barcode',
  '/api/food/search',
]

const NATIVE_SECRET_HEADER = 'x-pantheon-native-secret'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — never gate
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Native app routes — allow via shared-secret header
  if (NATIVE_ROUTES.includes(pathname)) {
    const providedSecret = request.headers.get(NATIVE_SECRET_HEADER)
    if (providedSecret) {
      const expectedSecret = process.env.PANTHEON_NATIVE_SHARED_SECRET
      if (!expectedSecret) {
        console.warn(
          '[proxy] PANTHEON_NATIVE_SHARED_SECRET is not set. Rejecting native request on',
          pathname,
        )
        return NextResponse.json(
          { error: 'Server misconfigured' },
          { status: 500 },
        )
      }
      if (providedSecret === expectedSecret) {
        return NextResponse.next()
      }
      // Header present but wrong → immediate 401 (no cookie fall-through).
      // Browsers never send this header, so presence means a native client
      // (or someone probing). Either way, don't let a stray valid cookie rescue.
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }
    // No header at all → fall through to cookie check (browser can still hit these routes)
  }

  // If pantheon_session cookie is set, pass through
  if (request.cookies.get('pantheon_session')?.value === '1') {
    return NextResponse.next()
  }

  // Everything else → login
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
