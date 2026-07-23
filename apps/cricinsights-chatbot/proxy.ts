import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Fast proxy:
 * - `/auth/*` → full Auth0 handlers (may hit network for discovery on login/callback)
 * - everything else → cookie-only session check (no Auth0 network call)
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  if (pathname === '/auth/error') {
    return NextResponse.next();
  }

  // Auth routes only — login/callback/logout need the SDK handlers.
  if (pathname.startsWith('/auth')) {
    if (pathname.startsWith('/auth/callback')) {
      console.log('[auth0] incoming callback', {
        search,
        cookieNames: request.cookies.getAll().map((c) => c.name),
      });
    }

    try {
      const authRes = await auth0.middleware(request);
      if (pathname.startsWith('/auth/callback')) {
        const names =
          typeof authRes.headers.getSetCookie === 'function'
            ? authRes.headers.getSetCookie().map((c) => c.split('=')[0])
            : [];
        console.log('[auth0] callback response', {
          status: authRes.status,
          location: authRes.headers.get('location'),
          setCookieNames: names,
        });
      }
      return authRes;
    } catch (err) {
      console.error('[auth0] /auth handler failed:', err);
      const url = new URL('/auth/error', request.nextUrl.origin);
      url.searchParams.set('error', 'auth_unavailable');
      url.searchParams.set(
        'description',
        err instanceof Error ? err.message : 'Auth0 request failed',
      );
      return NextResponse.redirect(url);
    }
  }

  // Cookie decrypt only — must not call Auth0 over the network.
  let session = null;
  try {
    session = await auth0.getSession(request);
  } catch (err) {
    console.warn('[auth0] getSession failed:', err);
  }

  if (!session?.user) {
    const returnTo = `${pathname}${search}` || '/';
    const loginUrl = new URL('/auth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
