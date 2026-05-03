import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePasswordStrength } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'auth:password-reset-confirm', ...RATE_LIMITS.passwordReset });
    if (limited) return limited;

    const { token, password } = await request.json();

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      throw new ValidationError('Reset token and new password are required');
    }

    validatePasswordStrength(password);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new ValidationError('Reset link is invalid or expired');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    return handleApiError(error, 'Error confirming password reset:');
  }
}
