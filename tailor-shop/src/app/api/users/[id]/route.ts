import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import bcrypt from 'bcryptjs';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/users/[id]
 * Update a user (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from deactivating themselves
    if (params.id === admin.id && active === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Validation
    if (role && !['ADMIN', 'STAFF', 'VIEWER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN, STAFF, or VIEWER' },
        { status: 400 }
      );
    }

    const newRole = role || existingUser.role;
    const newBranchId = branchId !== undefined ? branchId : existingUser.branchId;

    // Staff and Viewer must have a branch
    if ((newRole === 'STAFF' || newRole === 'VIEWER') && !newBranchId) {
      return NextResponse.json(
        { error: 'Staff and Viewer users must be assigned to a branch' },
        { status: 400 }
      );
    }

    // Admin users should not have a branch
    if (newRole === 'ADMIN' && newBranchId) {
      return NextResponse.json(
        { error: 'Admin users cannot be assigned to a specific branch' },
        { status: 400 }
      );
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        );
      }
    }

    // Verify branch exists if provided
    if (newBranchId && newBranchId !== existingUser.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: newBranchId },
      });

      if (!branch) {
        return NextResponse.json(
          { error: 'Branch not found' },
          { status: 404 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
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
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden: Insufficient permissions' ? 403 : 500 }
    );
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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from deleting themselves
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
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
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden: Insufficient permissions' ? 403 : 500 }
    );
  }
}
