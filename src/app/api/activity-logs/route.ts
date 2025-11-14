import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getActivityLogs, getUserActivitySummary, getBranchActivitySummary } from '@/lib/activity-log';

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
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    const branchId = searchParams.get('branchId');
    const userId = searchParams.get('userId');
    const entity = searchParams.get('entity') as any;
    const action = searchParams.get('action') as any;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const summary = searchParams.get('summary');

    // Branch summary
    if (summary === 'branch' && branchId) {
      const branchSummary = await getBranchActivitySummary(branchId);
      return NextResponse.json(branchSummary);
    }

    // User summary
    if (summary === 'user' && userId) {
      const userSummary = await getUserActivitySummary(userId);
      return NextResponse.json(userSummary);
    }

    // Non-admin users can only see their branch's activities
    let filterBranchId = branchId;
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        return NextResponse.json(
          { error: 'User not assigned to a branch' },
          { status: 400 }
        );
      }
      filterBranchId = user.branchId;
    }

    const activities = await getActivityLogs({
      branchId: filterBranchId || undefined,
      userId: userId || undefined,
      entity,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(activities);
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activity logs' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
