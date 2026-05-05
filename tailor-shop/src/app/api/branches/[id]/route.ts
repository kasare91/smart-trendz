import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logActivity } from '@/lib/activity-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: 'branches:patch', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'SUPER_ADMIN']);
    const body = await request.json();
    const { name, location, active } = body;

    if (name !== undefined && !name.trim()) {
      throw new ValidationError('Branch name cannot be empty');
    }

    const existing = await prisma.branch.findFirst({
      where: { id: params.id, tenantId: user.tenantId ?? undefined },
    });
    if (!existing) throw new NotFoundError('Branch not found');

    const branch = await prisma.branch.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(location !== undefined && { location: location.trim() }),
        ...(active !== undefined && { active }),
      },
      include: { _count: { select: { users: true, customers: true, orders: true } } },
    });

    await logActivity({
      userId: user.id,
      userName: user.name ?? 'Unknown',
      branchId: params.id,
      action: 'UPDATE',
      entity: 'CUSTOMER',
      entityId: params.id,
      description: `Updated branch "${branch.name}"`,
    });

    return NextResponse.json(branch);
  } catch (error: unknown) {
    return handleApiError(error, 'Error updating branch:');
  }
}
