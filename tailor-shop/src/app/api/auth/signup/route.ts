import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { handleApiError, ValidationError, ConflictError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return slug || 'boutique';
}

async function sendVerificationEmail(
  to: string,
  ownerName: string,
  verificationUrl: string
): Promise<void> {
  const subject = 'Verify your Tailor Desk account';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <p>Hi ${esc(ownerName)},</p>
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
    const limited = rateLimit(request, { key: 'auth:signup', ...RATE_LIMITS.signup });
    if (limited) return limited;

    const raw: unknown = await request.json();
    if (typeof raw !== 'object' || raw === null) throw new ValidationError('Invalid request body');
    const { businessName, ownerName, email, password, branchName, branchLocation } =
      raw as Record<string, unknown>;
    if (
      typeof businessName !== 'string' ||
      typeof ownerName !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof branchName !== 'string' ||
      typeof branchLocation !== 'string'
    ) {
      throw new ValidationError('All fields are required');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    if (password.length > 128) {
      throw new ValidationError('Password must be 128 characters or fewer');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const baseSlug = generateSlug(businessName);
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

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
          email: normalizedEmail,
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
      const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
      sendVerificationEmail(normalizedEmail, ownerName, verificationUrl).catch(() => undefined);
    }

    return NextResponse.json({ success: true, emailSent: emailEnabled }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
