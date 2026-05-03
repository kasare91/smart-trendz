import { NextRequest } from 'next/server';
import React from 'react';
import { DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { OrderReceiptPDF } from '@/lib/receipt-pdf';
import { ForbiddenError, NotFoundError, handleApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (user.role !== 'ADMIN' && order.branchId !== user.branchId) {
      throw new ForbiddenError('Order not found');
    }

    const businessProfile = await prisma.businessProfile.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });

    // @react-pdf/renderer requires DocumentProps; the cast is safe because
    // OrderReceiptPDF renders a <Document> as its root element.
    const document = React.createElement(OrderReceiptPDF, {
      order,
      businessProfile,
    }) as unknown as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(document);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${order.orderNumber}.pdf"`,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Error generating receipt PDF:');
  }
}
