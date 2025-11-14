import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

/**
 * GET /api/orders/[id]
 * Get a single order with all details
 * Branch access control: Non-admin users can only access orders in their branch
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
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

    // Verify user has access to this order's branch
    if (user.role !== 'ADMIN' && order.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 403 }
      );
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]
 * Update an order
 * Branch access control: Non-admin users can only update orders in their branch
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { description, totalAmount, dueDate, status, images } = body;

    // Get existing order to verify branch access
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this order's branch
    if (user.role !== 'ADMIN' && existingOrder.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 403 }
      );
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(description && { description }),
        ...(totalAmount && { totalAmount: parseFloat(totalAmount) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(status && { status }),
        ...(images !== undefined && { images }),
        updatedBy: user.id,
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
    const changes = [];
    if (description && description !== existingOrder.description) changes.push('description updated');
    if (totalAmount && parseFloat(totalAmount) !== existingOrder.totalAmount) {
      changes.push(`amount: GHS ${existingOrder.totalAmount} → GHS ${totalAmount}`);
    }
    if (dueDate && new Date(dueDate).getTime() !== existingOrder.dueDate.getTime()) {
      changes.push(`due date: ${existingOrder.dueDate.toLocaleDateString()} → ${new Date(dueDate).toLocaleDateString()}`);
    }
    if (status && status !== existingOrder.status) changes.push(`status: ${existingOrder.status} → ${status}`);
    if (images !== undefined) changes.push('images updated');

    if (changes.length > 0) {
      await logActivity({
        userId: user.id,
        userName: user.name,
        branchId: order.branchId,
        action: 'UPDATE',
        entity: 'ORDER',
        entityId: order.id,
        description: `Updated order ${order.orderNumber}: ${changes.join(', ')}`,
        metadata: {
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          changes,
          branchName: order.branch?.name,
        },
      });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order (cascades to payments)
 * Admin only: Only admin users can delete orders
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['ADMIN']);

    // Get existing order to log deletion info
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: true,
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    await prisma.order.delete({
      where: { id: params.id },
    });

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingOrder.branchId,
      action: 'DELETE',
      entity: 'ORDER',
      entityId: existingOrder.id,
      description: `Deleted order ${existingOrder.orderNumber} for ${existingOrder.customer.fullName} (${existingOrder._count.payments} payments)`,
      metadata: {
        orderNumber: existingOrder.orderNumber,
        customerName: existingOrder.customer.fullName,
        totalAmount: existingOrder.totalAmount,
        status: existingOrder.status,
        paymentsCount: existingOrder._count.payments,
        branchName: existingOrder.branch?.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete order' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
