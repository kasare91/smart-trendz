import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/branches
 * List all branches
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const branches = await prisma.branch.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            orders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(branches);
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch branches' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
