import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FabricStockBody = {
  branchId?: string;
  name?: string;
  unit?: string;
  quantity?: string | number;
  reorderLevel?: string | number;
};

function parseOptionalNumber(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError('Quantity fields must be positive numbers');
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'fabric-stock:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();

    // ADMIN: optional ?branchId filter, falls back to undefined (= all branches)
    // non-ADMIN: always scoped to their branch
    const branchId: string | undefined =
      user.role === 'ADMIN'
        ? (request.nextUrl.searchParams.get('branchId') ?? undefined)
        : (user.branchId ?? undefined);

    if (user.role !== 'ADMIN' && !branchId) {
      throw new ValidationError('Branch is required');
    }

    const stock = await prisma.fabricStock.findMany({
      where: branchId ? { branchId } : {}, // branch-isolated; ADMIN with no filter sees all
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(stock);
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching fabric stock:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'fabric-stock:post', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const body = (await request.json()) as FabricStockBody;
    const name = body.name?.trim();
    const branchId = user.role === 'ADMIN' ? body.branchId || user.branchId : user.branchId;

    if (!branchId) {
      throw new ValidationError('Branch is required');
    }

    if (!name) {
      throw new ValidationError('Fabric name is required');
    }

    const stock = await prisma.fabricStock.create({
      data: {
        branchId,
        name,
        unit: body.unit?.trim() || 'metres',
        quantity: parseOptionalNumber(body.quantity, 0),
        reorderLevel: parseOptionalNumber(body.reorderLevel, 2),
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
      branchId,
      action: 'CREATE',
      entity: 'FABRIC_STOCK',
      entityId: stock.id,
      description: `Created fabric stock item ${stock.name}`,
      metadata: {
        quantity: stock.quantity,
        reorderLevel: stock.reorderLevel,
      },
    });

    return NextResponse.json(stock, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating fabric stock:');
  }
}
