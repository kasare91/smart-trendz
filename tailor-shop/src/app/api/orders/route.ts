import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/utils';

/**
 * GET /api/orders
 * List orders with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const orders = await prisma.order.findMany({
      where: {
        ...(search && {
          OR: [
            { orderNumber: { contains: search } },
            { description: { contains: search } },
            { customer: { fullName: { contains: search } } },
          ],
        }),
        ...(status && { status: status as any }),
        ...(customerId && { customerId }),
      },
      include: {
        customer: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Create a new order (optionally with initial payment)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      description,
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
        description,
        totalAmount: parseFloat(totalAmount),
        status,
        orderDate: new Date(orderDate),
        dueDate: new Date(dueDate),
        ...(initialPayment &&
          initialPayment.amount > 0 && {
            payments: {
              create: {
                amount: parseFloat(initialPayment.amount),
                paymentDate: new Date(initialPayment.paymentDate || orderDate),
                paymentMethod: initialPayment.paymentMethod || 'CASH',
                note: initialPayment.note || 'Initial deposit',
              },
            },
          }),
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
