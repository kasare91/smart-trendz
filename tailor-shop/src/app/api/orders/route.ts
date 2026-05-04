import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/utils';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { handleApiError, ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getBusinessProfile, DEFAULT_INVOICE_PREFIX } from '@/lib/business-profile';
import { Prisma } from '@prisma/client';
import { getPlanAccess, isFreePlan } from '@/lib/billing';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/orders
 * List orders with filters
 * Branch filtering: Non-admin users only see their branch's orders
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'orders:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    // Tenant + branch scoping
    if (user.role === 'SUPER_ADMIN') {
      // no filter
    } else if (user.role === 'ADMIN') {
      where.branch = { tenantId: user.tenantId! }; // tenantId non-null for ADMIN role
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      where.branchId = user.branchId;
    }

    // Add search filters
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (from || to) {
      where.dueDate = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          payments: true,
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json(paginationResponse(orders, page, pageSize, total));
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching orders:');
  }
}

/**
 * POST /api/orders
 * Create a new order (optionally with initial payment)
 * Branch assignment: Inherits from customer's branch
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'orders:post', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const body = await request.json();
    const {
      customerId,
      description,
      images = [],
      totalAmount,
      orderDate,
      dueDate,
      status = 'PENDING',
      garmentType,
      fabricType,
      initialPayment,
    } = body;

    // Validation
    if (!customerId || !description || !totalAmount || !orderDate || !dueDate) {
      throw new ValidationError('Missing required fields');
    }

    // Plan limit enforcement: FREE plan capped at 50 orders/month
    if (user.tenantId) {
      const access = await getPlanAccess(user.tenantId);
      if (isFreePlan(access)) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const count = await prisma.order.count({
          where: { branch: { tenantId: user.tenantId }, createdAt: { gte: startOfMonth } },
        });
        if (count >= 50) {
          throw new ForbiddenError('Monthly order limit reached. Upgrade to PRO for unlimited orders.');
        }
      }
    }

    // Get customer to verify branch access and inherit branch
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Verify user has access to this customer's branch
    if (user.role === 'SUPER_ADMIN') {
      // unrestricted
    } else if (user.role === 'ADMIN') {
      if (customer.branch.tenantId !== user.tenantId) {
        throw new ForbiddenError('Customer not found in your branch');
      }
    } else if (customer.branchId !== user.branchId) {
      throw new ForbiddenError('Customer not found in your branch');
    }

    // Generate order number
    const businessProfile = await getBusinessProfile(user.tenantId);
    const invoicePrefix = businessProfile?.invoicePrefix || DEFAULT_INVOICE_PREFIX;
    const lastOrder = await prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: `${invoicePrefix}-${new Date().getFullYear()}-`,
        },
        ...(user.role !== 'ADMIN' && user.branchId ? { branchId: user.branchId } : {}), // branch-isolated
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = generateOrderNumber(lastOrder?.orderNumber || null, invoicePrefix);

    // Create order with optional initial payment
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        branchId: customer.branchId, // Inherit from customer
        description,
        garmentType: garmentType || null,
        fabricType: fabricType || null,
        images: images || [],
        totalAmount: parseFloat(totalAmount),
        status,
        orderDate: new Date(orderDate),
        dueDate: new Date(dueDate),
        createdBy: user.id,
        updatedBy: user.id,
        ...(initialPayment &&
          initialPayment.amount > 0 && {
            payments: {
              create: {
                amount: parseFloat(initialPayment.amount),
                paymentDate: new Date(initialPayment.paymentDate || orderDate),
                paymentMethod: initialPayment.paymentMethod || 'CASH',
                note: initialPayment.note || 'Initial deposit',
                createdBy: user.id,
              },
            },
          }),
      },
      include: {
        customer: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: true,
      },
    });

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: customer.branchId,
      action: 'CREATE',
      entity: 'ORDER',
      entityId: order.id,
      description: `Created order ${order.orderNumber} for ${customer.fullName}`,
      metadata: {
        orderNumber: order.orderNumber,
        customerName: customer.fullName,
        totalAmount: order.totalAmount,
        status: order.status,
        branchName: customer.branch?.name,
        initialPayment: initialPayment?.amount || 0,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating order:');
  }
}
