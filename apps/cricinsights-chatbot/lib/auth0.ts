import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { NextResponse } from 'next/server';

const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3004';
/** Secure cookies only on HTTPS (Vercel). Local http://localhost stays non-secure. */
const cookieSecure = appBaseUrl.startsWith('https://');

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl,
  // Fail login faster when Auth0 is unreachable (was hanging page loads).
  httpTimeout: 8000,
  authorizationParameters: {
    scope: 'openid profile email',
  },
  // Avoid concurrent login attempts stomping each other's __txn_ cookies.
  enableParallelTransactions: false,
  session: {
    // Rolling sessions re-touch cookies on every request; keep simple for local.
    rolling: false,
    absoluteDuration: 60 * 60 * 24,
    cookie: {
      path: '/',
      sameSite: 'lax',
      secure: cookieSecure,
    },
  },
  transactionCookie: {
    path: '/',
    sameSite: 'lax',
    secure: cookieSecure,
    maxAge: 3600,
  },
  async onCallback(error, context, session) {
    const base = appBaseUrl;

    if (error) {
      const cause = (error as { cause?: { code?: string; message?: string } })
        .cause;
      console.error('[auth0] callback failed', {
        name: error.name,
        code: (error as { code?: string }).code,
        message: error.message,
        causeCode: cause?.code,
        causeMessage: cause?.message,
        returnTo: context.returnTo,
      });

      // Do NOT bounce to /auth/login here — that restarts Auth0 and hides the real error.
      const url = new URL('/auth/error', base);
      url.searchParams.set('error', error.name);
      if (cause?.code) url.searchParams.set('code', cause.code);
      if (cause?.message) url.searchParams.set('description', cause.message);
      return NextResponse.redirect(url);
    }

    console.log('[auth0] callback ok', {
      sub: session?.user?.sub,
      returnTo: context.returnTo,
    });
    return NextResponse.redirect(new URL(context.returnTo || '/', base));
  },
});
