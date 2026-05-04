import { NextRequest, NextResponse } from 'next/server';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

export const RATE_LIMITS = {
  auth: { limit: 5, windowMs: 60 * 1000 },
  signup: { limit: 3, windowMs: 15 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 15 * 60 * 1000 },
  upload: { limit: 10, windowMs: 60 * 1000 },
  payment: { limit: 20, windowMs: 60 * 1000 },
  cron: { limit: 5, windowMs: 60 * 1000 },
  general: { limit: 120, windowMs: 60 * 1000 },
};

export function rateLimit(request: NextRequest, options: RateLimitOptions) {
  const ip = getClientIp(request);
  const now = Date.now();
  const bucketKey = `${options.key}:${ip}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count++;

  if (bucket.count > options.limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((bucket.resetAt - now) / 1000).toString(),
        },
      }
    );
  }

  return null;
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

// Prune expired buckets every 5 minutes to prevent unbounded Map growth.
// On Vercel serverless, instances are short-lived so this is belt-and-suspenders.
// For multi-instance deployments replace the in-memory Map with Upstash Redis.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  }, 5 * 60 * 1000);
}
