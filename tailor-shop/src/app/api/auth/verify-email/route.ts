import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/login?verifyError=true`);
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: { id: true, emailVerificationExpires: true },
    });

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.redirect(`${baseUrl}/login?verifyError=true`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/login?verifyError=true`);
  }
}
