import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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
