import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserActivitySummary, getBranchActivitySummary } from '@/lib/activity-log';
import { prisma } from '@/lib/prisma';
import { handleApiError, ValidationError, ForbiddenError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/activity-logs
 * Get activity logs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'activity-logs:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    const branchId = searchParams.get('branchId');
    const userId = searchParams.get('userId');
    const entity = searchParams.get('entity');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const summary = searchParams.get('summary');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    // Branch summary
    if (summary === 'branch' && branchId) {
      // Require ADMIN or SUPER_ADMIN for branch summaries
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Branch summaries require admin access');
      }
      const branchSummary = await getBranchActivitySummary(branchId);
      return NextResponse.json(branchSummary);
    }

    // User summary
    if (summary === 'user' && userId) {
      // Staff can only view their own activity; ADMIN can view any user in their tenant
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && userId !== user.id) {
        throw new ForbiddenError('Insufficient permissions to view this user summary');
      }
      const userSummary = await getUserActivitySummary(userId);
      return NextResponse.json(userSummary);
    }

    let filterBranchId = branchId;
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      filterBranchId = user.branchId;
    }

    // Build tenant scope filter for branch-level isolation
    const tenantScope: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { branch: { tenantId: user.tenantId! } } // tenantId non-null for non-SUPER_ADMIN users
          : {};  // STAFF/VIEWER are already constrained by filterBranchId

    const where: Record<string, unknown> = {
      ...tenantScope,
      ...(filterBranchId && { branchId: filterBranchId }),
      ...(userId && { userId }),
      ...(entity && { entity }),
      ...(action && { action }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [activities, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          branch: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json(paginationResponse(activities, page, pageSize, total));
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching activity logs:');
  }
}
