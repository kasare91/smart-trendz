import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { ForbiddenError, NotFoundError, ValidationError, handleApiError } from '@/lib/errors';
import { MeasurementField, measurementFields } from '@/types/measurements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MeasurementBody = Partial<Record<MeasurementField, string | number | null>> & {
  takenAt?: string;
  unit?: string;
  notes?: string | null;
};

function parseMeasurementData(body: MeasurementBody) {
  const data: Record<MeasurementField, number | null | undefined> = {} as Record<
    MeasurementField,
    number | null | undefined
  >;

  for (const field of measurementFields) {
    const value = body[field];
    if (value === undefined) continue;
    if (value === null || value === '') {
      data[field] = null;
      continue;
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new ValidationError(`${field} must be a positive number`);
    }
    data[field] = numericValue;
  }

  const unit = body.unit || 'cm';
  if (unit !== 'cm' && unit !== 'inches') {
    throw new ValidationError('Measurement unit must be cm or inches');
  }

  let takenAt: Date | undefined;
  if (body.takenAt) {
    takenAt = new Date(body.takenAt);
    if (isNaN(takenAt.getTime())) {
      throw new ValidationError('takenAt must be a valid date');
    }
  }

  return {
    ...data,
    unit,
    notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    ...(takenAt ? { takenAt } : {}),
  };
}

async function getAccessibleCustomer(customerId: string, userRole: string, userBranchId: string | null) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      fullName: true,
      branchId: true,
    },
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  if (userRole !== 'ADMIN' && customer.branchId !== userBranchId) {
    throw new ForbiddenError('Customer not found');
  }

  return customer;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await getAccessibleCustomer(params.id, user.role, user.branchId);

    const measurements = await prisma.measurement.findMany({
      where: { customerId: params.id },
      orderBy: { takenAt: 'desc' },
    });

    return NextResponse.json(measurements);
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching measurements:');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['ADMIN', 'STAFF']);
    const customer = await getAccessibleCustomer(params.id, user.role, user.branchId);
    const body = (await request.json()) as MeasurementBody;

    const measurement = await prisma.measurement.create({
      data: {
        customerId: params.id,
        takenBy: user.name,
        ...parseMeasurementData(body),
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: customer.branchId,
      action: 'CREATE',
      entity: 'MEASUREMENT',
      entityId: measurement.id,
      description: `Recorded measurements for ${customer.fullName}`,
      metadata: {
        customerId: customer.id,
        takenAt: measurement.takenAt.toISOString(),
      },
    });

    return NextResponse.json(measurement, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating measurement:');
  }
}
