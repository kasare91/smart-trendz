import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '@/lib/auth';
import { handleApiError, ValidationError, ForbiddenError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getPlanAccess, isFreePlan } from '@/lib/billing';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/branches
 * List all branches
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'branches:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const session = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Prisma.BranchWhereInput = {
      ...(session.role !== 'SUPER_ADMIN' && session.tenantId != null && { tenantId: session.tenantId }),
      ...(activeOnly && { active: true }),
    };

    const branches = await prisma.branch.findMany({
      where,
      include: {
        _count: {
          select: { users: true, customers: true, orders: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(branches);
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching branches:');
  }
}

/**
 * POST /api/branches
 * Create a new branch (ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'branches:post', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'SUPER_ADMIN']);
    const body = await request.json();
    const { name, location } = body;

    if (!name || !location) {
      throw new ValidationError('Branch name and location are required');
    }

    if (user.tenantId) {
      const access = await getPlanAccess(user.tenantId);
      if (isFreePlan(access)) {
        const branchCount = await prisma.branch.count({ where: { tenantId: user.tenantId } });
        if (branchCount >= 1) {
          throw new ForbiddenError('Free plan allows 1 branch. Upgrade to PRO for unlimited branches.');
        }
      }
    }

    if (!user.tenantId && user.role !== 'SUPER_ADMIN') {
      throw new ValidationError('No tenant found for this user');
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
        tenantId: user.tenantId!,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating branch:');
  }
}
