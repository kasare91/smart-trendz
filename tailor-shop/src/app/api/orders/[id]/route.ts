import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orders/[id]
 * Get a single order with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]
 * Update an order
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { description, totalAmount, dueDate, status } = body;

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(description && { description }),
        ...(totalAmount && { totalAmount: parseFloat(totalAmount) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(status && { status }),
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order (cascades to payments)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.order.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
