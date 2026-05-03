import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export default withAuth(function middleware(req: NextRequest) {
  if (
    req.method === 'POST' &&
    req.nextUrl.pathname === '/api/auth/callback/credentials'
  ) {
    const limited = rateLimit(req, { key: 'auth:login', ...RATE_LIMITS.auth });
    if (limited) return limited;
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',
    '/settings/:path*',
    '/api/auth/callback/credentials',
    '/orders/:path*',
    '/customers/:path*',
    '/payments/:path*',
    '/analytics/:path*',
    '/users/:path*',
    '/reports/:path*',
    '/activity-logs/:path*',
    '/fabric-stock/:path*',
  ],
};
