import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function sendVerificationEmail(
  to: string,
  ownerName: string,
  verificationUrl: string
): Promise<void> {
  const subject = 'Verify your Tailor Desk account';
  const html = `
    <p>Hi ${ownerName},</p>
    <p>Thanks for signing up for Tailor Desk. Click the link below to verify your email address:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>This link expires in 24 hours.</p>
    <p>— The Tailor Desk Team</p>
  `;

  if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({ to, from: process.env.FROM_EMAIL, subject, html });
    return;
  }

  if (process.env.SMTP_USER) {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return;
  }

  console.warn(`[signup] No email service configured. Verification URL for ${to}: ${verificationUrl}`);
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'auth:signup', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const body = await request.json() as Record<string, string>;
    const { businessName, ownerName, email, password, branchName, branchLocation } = body;

    if (!businessName || !ownerName || !email || !password || !branchName || !branchLocation) {
      throw new ValidationError('All fields are required');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    let slug = generateSlug(businessName);
    const slugExists = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (slugExists) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
    const emailVerificationToken = emailEnabled ? crypto.randomBytes(32).toString('hex') : null;
    const emailVerificationExpires = emailEnabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const emailVerified = !emailEnabled;

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: businessName, slug, status: 'ACTIVE', plan: 'FREE' },
      });

      await tx.branch.create({
        data: { name: branchName, location: branchLocation, tenantId: tenant.id, active: true },
      });

      await tx.user.create({
        data: {
          email,
          name: ownerName,
          password: passwordHash,
          role: 'ADMIN',
          tenantId: tenant.id,
          branchId: null,
          active: true,
          emailVerified,
          emailVerificationToken,
          emailVerificationExpires,
        },
      });

      await tx.businessProfile.create({
        data: { businessName, tenantId: tenant.id },
      });
    });

    if (emailEnabled && emailVerificationToken) {
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
      sendVerificationEmail(email, ownerName, verificationUrl).catch(() => undefined);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
