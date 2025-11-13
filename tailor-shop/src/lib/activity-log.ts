import { prisma } from './prisma';

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type ActivityEntity = 'ORDER' | 'CUSTOMER' | 'PAYMENT' | 'USER';

interface LogActivityParams {
  userId: string;
  userName: string;
  branchId: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log user activity to the database
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        branchId: params.branchId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        description: params.description,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    // Log error but don't fail the operation
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get activity logs with optional filters
 */
export async function getActivityLogs(filters?: {
  branchId?: string;
  userId?: string;
  entity?: ActivityEntity;
  action?: ActivityAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const where: any = {};

  if (filters?.branchId) {
    where.branchId = filters.branchId;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.entity) {
    where.entity = filters.entity;
  }

  if (filters?.action) {
    where.action = filters.action;
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const activities = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 100,
    include: {
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  return activities;
}

/**
 * Get activity summary for a user
 */
export async function getUserActivitySummary(userId: string) {
  const [totalActivities, recentActivities, activityByType] = await Promise.all([
    // Total activities
    prisma.activityLog.count({
      where: { userId },
    }),

    // Recent activities (last 7 days)
    prisma.activityLog.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    // Activity by entity type
    prisma.activityLog.groupBy({
      by: ['entity'],
      where: { userId },
      _count: true,
    }),
  ]);

  return {
    totalActivities,
    recentActivities,
    activityByType: activityByType.map((item) => ({
      entity: item.entity,
      count: item._count,
    })),
  };
}

/**
 * Get branch activity summary
 */
export async function getBranchActivitySummary(branchId: string) {
  const [totalActivities, recentActivities, topUsers] = await Promise.all([
    // Total activities
    prisma.activityLog.count({
      where: { branchId },
    }),

    // Recent activities (last 24 hours)
    prisma.activityLog.count({
      where: {
        branchId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),

    // Most active users
    prisma.activityLog.groupBy({
      by: ['userId', 'userName'],
      where: { branchId },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 5,
    }),
  ]);

  return {
    totalActivities,
    recentActivities,
    topUsers: topUsers.map((user) => ({
      userId: user.userId,
      userName: user.userName,
      activityCount: user._count,
    })),
  };
}
