import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import bcrypt from 'bcryptjs';
import { handleApiError, ValidationError, ConflictError, NotFoundError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePasswordStrength } from '@/lib/password';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'users:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const session = await requireRole(['ADMIN']);

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const active = searchParams.get('active');
    const search = searchParams.get('search');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    const where = {
      ...(session.role !== 'SUPER_ADMIN' && session.tenantId != null && { tenantId: session.tenantId }),
      ...(branchId && { branchId }),
      ...(active !== null && { active: active === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          branchId: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(paginationResponse(users, page, pageSize, total));
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching users:');
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'users:post', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const admin = await requireRole(['ADMIN']);
    const body = await request.json();
    const { email, name, password, role, branchId, active = true } = body;

    // Validation
    if (!email || !name || !password || !role) {
      throw new ValidationError('Email, name, password, and role are required');
    }

    validatePasswordStrength(password);

    if (!['ADMIN', 'STAFF', 'VIEWER'].includes(role)) {
      throw new ValidationError('Invalid role. Must be ADMIN, STAFF, or VIEWER');
    }

    // Staff and Viewer must have a branch
    if ((role === 'STAFF' || role === 'VIEWER') && !branchId) {
      throw new ValidationError('Staff and Viewer users must be assigned to a branch');
    }

    // Admin users should not have a branch
    if (role === 'ADMIN' && branchId) {
      throw new ValidationError('Admin users cannot be assigned to a specific branch');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // Verify branch exists if provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        throw new NotFoundError('Branch not found');
      }

      // Prevent assigning a user to a branch from another tenant
      if (admin.tenantId && branch.tenantId !== admin.tenantId) {
        throw new NotFoundError('Branch not found');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        branchId: branchId || null,
        active,
        tenantId: admin.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      userName: admin.name,
      branchId: branchId || 'system',
      action: 'CREATE',
      entity: 'USER',
      entityId: newUser.id,
      description: `Created user ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
      metadata: {
        email: newUser.email,
        role: newUser.role,
        branchId: newUser.branchId,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating user:');
  }
}
