import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { getBusinessProfile, sanitizeBusinessProfileInput } from '@/lib/business-profile';
import { handleApiError, ConflictError, NotFoundError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const session = await requireAuth();
    const profile = await getBusinessProfile(session.tenantId);
    return NextResponse.json({ data: profile, needsSetup: !profile });
  } catch (error) {
    return handleApiError(error, 'Error fetching business profile:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:post', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const session = await requireRole(['ADMIN']);
    const existingProfile = await getBusinessProfile(session.tenantId);
    if (existingProfile) {
      throw new ConflictError('Business profile already exists. Use PATCH to update it.');
    }

    const raw = sanitizeBusinessProfileInput(await request.json()) as ReturnType<typeof sanitizeBusinessProfileInput> & { businessName: string };
    const profile = await prisma.businessProfile.create({
      data: { ...raw, tenantId: session.tenantId },
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Error creating business profile:');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:patch', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const session = await requireRole(['ADMIN']);
    const profile = await getBusinessProfile(session.tenantId);
    if (!profile) throw new NotFoundError('Business profile not found');

    const data = sanitizeBusinessProfileInput(await request.json(), false);
    const updated = await prisma.businessProfile.update({
      where: { id: profile.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Error updating business profile:');
  }
}
