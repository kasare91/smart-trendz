import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import bcrypt from 'bcryptjs';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['ADMIN']);

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const active = searchParams.get('active');

    const users = await prisma.user.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(active !== null && { active: active === 'true' }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden: Insufficient permissions' ? 403 : 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(['ADMIN']);
    const body = await request.json();
    const { email, name, password, role, branchId, active = true } = body;

    // Validation
    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: 'Email, name, password, and role are required' },
        { status: 400 }
      );
    }

    if (!['ADMIN', 'STAFF', 'VIEWER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN, STAFF, or VIEWER' },
        { status: 400 }
      );
    }

    // Staff and Viewer must have a branch
    if ((role === 'STAFF' || role === 'VIEWER') && !branchId) {
      return NextResponse.json(
        { error: 'Staff and Viewer users must be assigned to a branch' },
        { status: 400 }
      );
    }

    // Admin users should not have a branch
    if (role === 'ADMIN' && branchId) {
      return NextResponse.json(
        { error: 'Admin users cannot be assigned to a specific branch' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Verify branch exists if provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        return NextResponse.json(
          { error: 'Branch not found' },
          { status: 404 }
        );
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
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden: Insufficient permissions' ? 403 : 500 }
    );
  }
}
