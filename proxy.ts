import { NextResponse, type NextRequest } from 'next/server'

const NATIVE_ROUTES = [
  '/api/claude/parse-meal',
  '/api/claude/parse-workout',
  '/api/claude/parse-workout-image',
  '/api/withings/sync',
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
