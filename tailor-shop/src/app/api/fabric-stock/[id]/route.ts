import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { ForbiddenError, NotFoundError, ValidationError, handleApiError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FabricStockUpdateBody = {
  name?: string;
  unit?: string;
  quantity?: string | number;
  reorderLevel?: string | number;
};

function parseNumber(value: string | number | undefined, field: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`${field} must be a positive number`);
  }
  return parsed;
}

async function getAccessibleStock(id: string, userRole: string, userBranchId: string | null) {
  const stock = await prisma.fabricStock.findUnique({
    where: { id },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!stock) {
    throw new NotFoundError('Fabric stock item not found');
  }

  if (userRole !== 'ADMIN' && stock.branchId !== userBranchId) {
    throw new ForbiddenError('Fabric stock item not found');
  }

  return stock;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: `fabric-stock:patch:${params.id}`, ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const existingStock = await getAccessibleStock(params.id, user.role, user.branchId);
    const body = (await request.json()) as FabricStockUpdateBody;
    const quantity = parseNumber(body.quantity, 'Quantity');
    const reorderLevel = parseNumber(body.reorderLevel, 'Reorder level');

    const stock = await prisma.fabricStock.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.unit !== undefined && { unit: body.unit.trim() || 'metres' }),
        ...(quantity !== undefined && { quantity }),
        ...(reorderLevel !== undefined && { reorderLevel }),
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

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingStock.branchId,
      action: 'UPDATE',
      entity: 'FABRIC_STOCK',
      entityId: stock.id,
      description: `Updated fabric stock item ${stock.name}`,
      metadata: {
        quantity: stock.quantity,
        reorderLevel: stock.reorderLevel,
      },
    });

    return NextResponse.json(stock);
  } catch (error: unknown) {
    return handleApiError(error, 'Error updating fabric stock:');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: `fabric-stock:delete:${params.id}`, ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN']);
    const existingStock = await getAccessibleStock(params.id, user.role, user.branchId);

    await prisma.fabricStock.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingStock.branchId,
      action: 'DELETE',
      entity: 'FABRIC_STOCK',
      entityId: existingStock.id,
      description: `Deleted fabric stock item ${existingStock.name}`,
      metadata: {
        quantity: existingStock.quantity,
        reorderLevel: existingStock.reorderLevel,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, 'Error deleting fabric stock:');
  }
}
