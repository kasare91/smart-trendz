import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DEFAULT_BUSINESS_NAME, getBusinessProfile } from '@/lib/business-profile';
import { sendWhatsAppReceipt } from '@/lib/notifications';
import { ForbiddenError, NotFoundError, ValidationError, handleApiError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['ADMIN', 'STAFF']);
    const limited = rateLimit(request, { key: `whatsapp-receipt:${params.id}`, ...RATE_LIMITS.general });
    if (limited) return limited;
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (user.role !== 'ADMIN' && order.branchId !== user.branchId) {
      throw new ForbiddenError('Order not found');
    }

    if (!order.customer.phoneNumber) {
      throw new ValidationError('Customer has no phone number');
    }

    const amountPaid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = order.totalAmount - amountPaid;
    const businessProfile = await getBusinessProfile(user.tenantId);

    const messageId = await sendWhatsAppReceipt({
      to: order.customer.phoneNumber,
      customerName: order.customer.fullName,
      orderNumber: order.orderNumber,
      description: order.description,
      totalAmount: order.totalAmount,
      amountPaid,
      balance,
      dueDate: order.dueDate,
      businessName: businessProfile?.businessName || DEFAULT_BUSINESS_NAME,
      receiptFooter: businessProfile?.receiptFooterNote || undefined,
    });

    return NextResponse.json({ success: true, messageId });
  } catch (error: unknown) {
    return handleApiError(error, 'Error sending WhatsApp receipt:');
  }
}
