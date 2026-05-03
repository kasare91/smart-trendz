import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import bcrypt from 'bcryptjs';
import { handleApiError, ValidationError, ConflictError, NotFoundError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePasswordStrength } from '@/lib/password';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/users/[id]
 * Update a user (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: 'users:patch', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const admin = await requireRole(['ADMIN']);
    const body = await request.json();
    const { email, name, password, role, branchId, active } = body;

    // Get existing user
    const existingUser = await prisma.user.findUnique({
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

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Prevent cross-tenant modification
    if (admin.tenantId && existingUser.tenantId !== admin.tenantId) {
      throw new NotFoundError('User not found');
    }

    // Prevent admin from deactivating themselves
    if (params.id === admin.id && active === false) {
      throw new ValidationError('You cannot deactivate your own account');
    }

    // Validation
    if (role && !['ADMIN', 'STAFF', 'VIEWER'].includes(role)) {
      throw new ValidationError('Invalid role. Must be ADMIN, STAFF, or VIEWER');
    }

    const newRole = role || existingUser.role;
    const newBranchId = branchId !== undefined ? branchId : existingUser.branchId;

    // Staff and Viewer must have a branch
    if ((newRole === 'STAFF' || newRole === 'VIEWER') && !newBranchId) {
      throw new ValidationError('Staff and Viewer users must be assigned to a branch');
    }

    // Admin users should not have a branch
    if (newRole === 'ADMIN' && newBranchId) {
      throw new ValidationError('Admin users cannot be assigned to a specific branch');
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    // Verify branch exists if provided
    if (newBranchId && newBranchId !== existingUser.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: newBranchId },
      });

      if (!branch) {
        throw new NotFoundError('Branch not found');
      }

      // Prevent cross-tenant branch assignment
      if (admin.tenantId && branch.tenantId !== admin.tenantId) {
        throw new NotFoundError('Branch not found');
      }
    }

    if (password) {
      validatePasswordStrength(password);
    }

    // Prepare update data
    const updateData: {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      branchId?: string | null;
      active?: boolean;
    } = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;
    if (branchId !== undefined) updateData.branchId = branchId || null;
    if (active !== undefined) updateData.active = active;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
    const changes = [];
    if (email && email !== existingUser.email) changes.push(`email: ${existingUser.email} → ${email}`);
    if (name && name !== existingUser.name) changes.push(`name: ${existingUser.name} → ${name}`);
    if (password) changes.push('password changed');
    if (role && role !== existingUser.role) changes.push(`role: ${existingUser.role} → ${role}`);
    if (branchId !== undefined && branchId !== existingUser.branchId) {
      const oldBranch = existingUser.branch?.name || 'None';
      const newBranch = updatedUser.branch?.name || 'None';
      changes.push(`branch: ${oldBranch} → ${newBranch}`);
    }
    if (active !== undefined && active !== existingUser.active) changes.push(`active: ${existingUser.active} → ${active}`);

    await logActivity({
      userId: admin.id,
      userName: admin.name,
      branchId: updatedUser.branchId || 'system',
      action: 'UPDATE',
      entity: 'USER',
      entityId: updatedUser.id,
      description: `Updated user ${updatedUser.name}: ${changes.join(', ')}`,
      metadata: {
        changes,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: unknown) {
    return handleApiError(error, 'Error updating user:');
  }
}

/**
 * DELETE /api/users/[id]
 * Deactivate a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: 'users:delete', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const admin = await requireRole(['ADMIN']);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent cross-tenant deactivation
    if (admin.tenantId && user.tenantId !== admin.tenantId) {
      throw new NotFoundError('User not found');
    }

    // Prevent admin from deleting themselves
    if (params.id === admin.id) {
      throw new ValidationError('You cannot delete your own account');
    }

    // Deactivate instead of delete
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { active: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        active: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      userName: admin.name,
      branchId: user.branchId || 'system',
      action: 'DELETE',
      entity: 'USER',
      entityId: user.id,
      description: `Deactivated user ${user.name} (${user.email})`,
      metadata: {
        email: user.email,
        role: user.role,
        branchName: user.branch?.name,
      },
    });

    return NextResponse.json({ message: 'User deactivated successfully', user: updatedUser });
  } catch (error: unknown) {
    return handleApiError(error, 'Error deleting user:');
  }
}
