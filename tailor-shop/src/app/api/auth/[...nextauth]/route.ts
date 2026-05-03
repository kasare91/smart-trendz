import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

const handler = NextAuth(authOptions);

export { handler as GET };

// Wrap POST to inject rate limiting before NextAuth handles credentials login.
// The context cast is required because NextAuth v4 types predate the App Router.
type NextAuthContext = Parameters<typeof handler>[1];

export async function POST(request: NextRequest, context: NextAuthContext) {
  const limited = rateLimit(request, { key: 'auth:login', ...RATE_LIMITS.auth });
  if (limited) return limited;

  return handler(request, context);
}
