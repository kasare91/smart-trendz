import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/utils';
import { requireAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 * List orders with filters
 * Branch filtering: Non-admin users only see their branch's orders
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

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

    const orders = await prisma.order.findMany({
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
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * POST /api/orders
 * Create a new order (optionally with initial payment)
 * Branch assignment: Inherits from customer's branch
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const {
      customerId,
      description,
      images = [],
      totalAmount,
      orderDate,
      dueDate,
      status = 'PENDING',
      initialPayment,
    } = body;

    // Validation
    if (!customerId || !description || !totalAmount || !orderDate || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get customer to verify branch access and inherit branch
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this customer's branch
    if (user.role !== 'ADMIN' && customer.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'Customer not found in your branch' },
        { status: 403 }
      );
    }

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = generateOrderNumber(lastOrder?.orderNumber || null);

    // Create order with optional initial payment
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        branchId: customer.branchId, // Inherit from customer
        description,
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
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
