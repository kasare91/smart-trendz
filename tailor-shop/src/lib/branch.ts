/**
 * Branch utilities for multi-branch operations
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string; // Can be 'ADMIN' | 'STAFF' | 'VIEWER'
  branchId?: string | null;
  branchName?: string | null;
}

/**
 * Resolve the effective branch ID for an operation
 *
 * Rules:
 * - ADMIN: Can specify branchId in request body, or use their own if assigned
 * - STAFF/VIEWER: Must use their assigned branchId only
 *
 * @param sessionUser - The authenticated user from session
 * @param bodyBranchId - Optional branchId from request body (admin only)
 * @returns The resolved branchId or null if not available
 */
export function resolveBranchId(
  sessionUser: SessionUser,
  bodyBranchId?: string
): string | null {
  const isAdmin = sessionUser?.role === 'ADMIN';

  if (isAdmin) {
    // Admin can use body branchId or their own assigned branch
    return bodyBranchId ?? sessionUser?.branchId ?? null;
  }

  // Non-admin must use their assigned branch
  return sessionUser?.branchId ?? null;
}

/**
 * Validate that a user has access to a specific branch
 *
 * @param sessionUser - The authenticated user from session
 * @param targetBranchId - The branch ID to check access for
 * @returns true if user has access, false otherwise
 */
export function hasAccessToBranch(
  sessionUser: SessionUser,
  targetBranchId: string
): boolean {
  const isAdmin = sessionUser?.role === 'ADMIN';

  if (isAdmin) {
    // Admin has access to all branches
    return true;
  }

  // Non-admin can only access their assigned branch
  return sessionUser?.branchId === targetBranchId;
}

/**
 * Build a branch filter for Prisma queries
 *
 * @param sessionUser - The authenticated user from session
 * @returns Prisma where clause for branch filtering
 */
export function buildBranchFilter(sessionUser: SessionUser): { branchId?: string } {
  const isAdmin = sessionUser?.role === 'ADMIN';

  if (isAdmin) {
    // Admin sees all branches
    return {};
  }

  // Non-admin sees only their branch
  if (!sessionUser?.branchId) {
    throw new Error('User not assigned to a branch');
  }

  return { branchId: sessionUser.branchId };
}
