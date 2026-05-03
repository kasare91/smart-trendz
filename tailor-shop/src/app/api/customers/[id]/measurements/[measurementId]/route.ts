import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
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
  const data: Partial<Record<MeasurementField, number | null>> = {};

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

  const unit = body.unit;
  if (unit !== undefined && unit !== 'cm' && unit !== 'inches') {
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
    ...(unit ? { unit } : {}),
    ...(body.notes !== undefined
      ? { notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null }
      : {}),
    ...(takenAt ? { takenAt } : {}),
  };
}

async function getMeasurementForCustomer(customerId: string, measurementId: string) {
  const measurement = await prisma.measurement.findFirst({
    where: {
      id: measurementId,
      customerId,
    },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          branchId: true,
        },
      },
    },
  });

  if (!measurement) {
    throw new NotFoundError('Measurement not found');
  }

  return measurement;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; measurementId: string } }
) {
  try {
    const user = await requireRole(['ADMIN', 'STAFF']);
    const existingMeasurement = await getMeasurementForCustomer(params.id, params.measurementId);

    if (user.role !== 'ADMIN' && existingMeasurement.customer.branchId !== user.branchId) {
      throw new ForbiddenError('Measurement not found');
    }

    const body = (await request.json()) as MeasurementBody;
    const measurement = await prisma.measurement.update({
      where: { id: params.measurementId },
      data: {
        ...parseMeasurementData(body),
        takenBy: user.name,
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingMeasurement.customer.branchId,
      action: 'UPDATE',
      entity: 'MEASUREMENT',
      entityId: measurement.id,
      description: `Updated measurements for ${existingMeasurement.customer.fullName}`,
      metadata: {
        customerId: existingMeasurement.customer.id,
        takenAt: measurement.takenAt.toISOString(),
      },
    });

    return NextResponse.json(measurement);
  } catch (error: unknown) {
    return handleApiError(error, 'Error updating measurement:');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; measurementId: string } }
) {
  try {
    const user = await requireRole(['ADMIN']);
    const existingMeasurement = await getMeasurementForCustomer(params.id, params.measurementId);

    await prisma.measurement.delete({
      where: { id: params.measurementId },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: existingMeasurement.customer.branchId,
      action: 'DELETE',
      entity: 'MEASUREMENT',
      entityId: existingMeasurement.id,
      description: `Deleted measurements for ${existingMeasurement.customer.fullName}`,
      metadata: {
        customerId: existingMeasurement.customer.id,
        takenAt: existingMeasurement.takenAt.toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, 'Error deleting measurement:');
  }
}
