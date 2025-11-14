import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/customers/[id]
 * Get a single customer with their orders
 * Branch access control: Non-admin users can only access customers in their branch
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          include: {
            payments: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
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
        { error: 'Customer not found' },
        { status: 403 }
      );
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]
 * Update a customer
 * Branch access control: Non-admin users can only update customers in their branch
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { fullName, phoneNumber, email } = body;

    // Get existing customer to verify branch access
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this customer's branch
    if (user.role !== 'ADMIN' && existingCustomer.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 403 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...(fullName && { fullName }),
        ...(phoneNumber && { phoneNumber }),
        ...(email !== undefined && { email: email || null }),
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
    const changes = [];
    if (fullName && fullName !== existingCustomer.fullName) changes.push(`name: ${existingCustomer.fullName} → ${fullName}`);
    if (phoneNumber && phoneNumber !== existingCustomer.phoneNumber) changes.push(`phone: ${existingCustomer.phoneNumber} → ${phoneNumber}`);
    if (email !== undefined && email !== existingCustomer.email) changes.push(`email: ${existingCustomer.email || 'none'} → ${email || 'none'}`);

    if (changes.length > 0) {
      await logActivity({
        userId: user.id,
        userName: user.name,
        branchId: customer.branchId,
        action: 'UPDATE',
        entity: 'CUSTOMER',
        entityId: customer.id,
        description: `Updated customer ${customer.fullName}: ${changes.join(', ')}`,
        metadata: {
          changes,
          branchName: customer.branch?.name,
        },
      });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update customer' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * DELETE /api/customers/[id]
 * Delete a customer (cascades to orders and payments)
 * Admin only: Only admin users can delete customers
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['ADMIN']);

    // Get existing customer to log deletion info
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    await prisma.customer.delete({
      where: { id: params.id },
    });

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingCustomer.branchId,
      action: 'DELETE',
      entity: 'CUSTOMER',
      entityId: existingCustomer.id,
      description: `Deleted customer ${existingCustomer.fullName} (${existingCustomer._count.orders} orders)`,
      metadata: {
        customerName: existingCustomer.fullName,
        phoneNumber: existingCustomer.phoneNumber,
        ordersCount: existingCustomer._count.orders,
        branchName: existingCustomer.branch?.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
