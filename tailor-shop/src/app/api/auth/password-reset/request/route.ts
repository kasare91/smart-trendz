import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GENERIC_RESPONSE = {
  message: 'If an account exists for that email, a password reset link has been sent.',
};

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'auth:password-reset-request', ...RATE_LIMITS.passwordReset });
    if (limited) return limited;

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, active: true },
    });

    if (!user || !user.active) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const resetLink = `${origin}/reset-password?token=${token}`;

    const emailSent = await sendPasswordResetEmail(user.email, resetLink);
    if (!emailSent) {
      console.error('Password reset token created but email delivery failed for user', user.id, '— check email service configuration');
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    return handleApiError(error, 'Error requesting password reset:');
  }
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
