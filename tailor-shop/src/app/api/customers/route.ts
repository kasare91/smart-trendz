import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { Prisma } from '@prisma/client';

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
    const limited = rateLimit(request, { key: 'customers:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    // Build where clause
    const where: Prisma.CustomerWhereInput = {};

    // Tenant + branch scoping
    if (user.role === 'SUPER_ADMIN') {
      // no filter
    } else if (user.role === 'ADMIN') {
      where.branch = { tenantId: user.tenantId! };
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      where.branchId = user.branchId;
    }

    // Add search filters
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
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
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json(paginationResponse(customers, page, pageSize, total));
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching customers:');
  }
}

/**
 * POST /api/customers
 * Create a new customer
 * Branch assignment: Staff/Viewer must use their branch, Admin can specify
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'customers:post', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const body = await request.json();
    const { fullName, phoneNumber, email, branchId } = body;

    // Validation
    if (!fullName || !phoneNumber) {
      throw new ValidationError('Full name and phone number are required');
    }

    // Determine branch assignment
    let assignedBranchId: string;

    if (user.role === 'ADMIN') {
      // Admin can specify branch or default to a branch
      if (!branchId) {
        throw new ValidationError('Admin must specify a branch for the customer');
      }
      assignedBranchId = branchId;
    } else {
      // Staff/Viewer must use their assigned branch
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      assignedBranchId = user.branchId; // branch-isolated
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: assignedBranchId },
    });

    if (!branch) {
      throw new NotFoundError('Branch not found');
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
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating customer:');
  }
}
