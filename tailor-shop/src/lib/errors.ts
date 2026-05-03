import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
  }
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  if (error.code === 'P2002') {
    return new ConflictError('A record with these details already exists');
  }

  if (error.code === 'P2025') {
    return new NotFoundError('Record not found');
  }

  return new AppError(500, 'DATABASE_ERROR', 'A database error occurred');
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Invalid request data');
  }

  return new AppError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
}

export function handleApiError(error: unknown, context?: string) {
  const appError = toAppError(error);

  if (appError.statusCode >= 500) {
    console.error(context || 'API error:', error);
  } else if (context) {
    console.warn(context, appError.message);
  }

  return NextResponse.json(
    {
      error: appError.message,
      code: appError.code,
      ...(appError.details ? { details: appError.details } : {}),
    },
    { status: appError.statusCode }
  );
}
