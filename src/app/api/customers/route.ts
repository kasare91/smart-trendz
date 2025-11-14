import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Build where clause
    const where: any = {};

    // Branch filtering: Non-admin users can only see their branch
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        return NextResponse.json(
          { error: 'User not assigned to a branch' },
          { status: 400 }
        );
      }
      where.branchId = user.branchId;
    }

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
    const { fullName, phoneNumber, email, branchId } = body;

    // Validation
    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Full name and phone number are required' },
        { status: 400 }
      );
    }

    // Determine branch assignment
    let assignedBranchId: string;

    if (user.role === 'ADMIN') {
      // Admin can specify branch or default to a branch
      if (!branchId) {
        return NextResponse.json(
          { error: 'Admin must specify a branch for the customer' },
          { status: 400 }
        );
      }
      assignedBranchId = branchId;
    } else {
      // Staff/Viewer must use their assigned branch
      if (!user.branchId) {
        return NextResponse.json(
          { error: 'User not assigned to a branch' },
          { status: 400 }
        );
      }
      assignedBranchId = user.branchId;
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: assignedBranchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        fullName,
        phoneNumber,
        email: email || null,
        branchId: assignedBranchId,
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
      branchId: assignedBranchId,
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
