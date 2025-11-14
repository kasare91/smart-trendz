import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { resolveBranchId, buildBranchFilter } from '@/lib/branch';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/customers
 * List all customers with optional search
 * Branch filtering: Non-admin users only see their branch's customers
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    // Build where clause with branch filter
    const where: any = buildBranchFilter(user);

    // Add search filters
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(customers);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customers' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * POST /api/customers
 * Create a new customer
 * Branch assignment: Staff/Viewer must use their branch, Admin can specify
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { fullName, phoneNumber, email, branchId: bodyBranchId } = body;

    // Validation
    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Full name and phone number are required' },
        { status: 400 }
      );
    }

    // Resolve branch ID based on user role
    const branchId = resolveBranchId(user, bodyBranchId);

    if (!branchId) {
      return NextResponse.json(
        { error: user.role === 'ADMIN'
          ? 'Admin must specify a branch for the customer'
          : 'User not assigned to a branch'
        },
        { status: 400 }
      );
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Create customer with branch connection
    const customer = await prisma.customer.create({
      data: {
        fullName,
        phoneNumber,
        email: email || null,
        branch: {
          connect: { id: branchId }
        },
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: branchId,
      action: 'CREATE',
      entity: 'CUSTOMER',
      entityId: customer.id,
      description: `Created customer ${customer.fullName}`,
      metadata: {
        phoneNumber: customer.phoneNumber,
        email: customer.email,
        branchName: branch.name,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
