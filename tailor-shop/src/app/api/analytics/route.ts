import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, format } from 'date-fns';

/**
 * GET /api/analytics
 * Get comprehensive analytics data
 */
export async function GET() {
  try {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);

    // 1. Monthly Revenue (last 6 months)
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
    const monthlyRevenue = await Promise.all(
      months.map(async (month) => {
        const payments = await prisma.payment.findMany({
          where: {
            paymentDate: {
              gte: startOfMonth(month),
              lte: endOfMonth(month),
            },
          },
        });

        return {
          month: format(month, 'MMM yyyy'),
          monthKey: format(month, 'yyyy-MM'),
          revenue: payments.reduce((sum, p) => sum + p.amount, 0),
          orderCount: payments.length,
          averagePayment: payments.length > 0
            ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length
            : 0,
        };
      })
    );

    // 2. Customer Lifetime Value (Top 10)
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          include: { payments: true },
        },
      },
    });

    const customerLTV = customers
      .map((customer) => {
        const totalSpent = customer.orders.reduce((sum, order) => {
          return sum + order.payments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        return {
          customerId: customer.id,
          customerName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          totalOrders: customer.orders.length,
          totalSpent,
          averageOrderValue: customer.orders.length > 0 ? totalSpent / customer.orders.length : 0,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10); // Top 10 customers

    // 3. Popular Items Analysis (based on order descriptions)
    const allOrders = await prisma.order.findMany({
      select: { description: true, totalAmount: true },
    });

    // Simple keyword extraction from descriptions
    const itemCounts: Record<string, { count: number; revenue: number }> = {};
    allOrders.forEach((order) => {
      const words = order.description.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 3) { // Ignore short words
          if (!itemCounts[word]) {
            itemCounts[word] = { count: 0, revenue: 0 };
          }
          itemCounts[word].count++;
          itemCounts[word].revenue += order.totalAmount;
        }
      });
    });

    const popularItems = Object.entries(itemCounts)
      .map(([item, data]) => ({
        item,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 items

    // 4. Overall Statistics
    const totalRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
    });

    const totalOrders = await prisma.order.count();
    const activeOrders = await prisma.order.count({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
    });

    const allOrdersWithPayments = await prisma.order.findMany({
      include: { payments: true },
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
    });

    const totalOutstanding = allOrdersWithPayments.reduce((sum, order) => {
      const paid = order.payments.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + (order.totalAmount - paid);
    }, 0);

    // 5. Payment Method Distribution
    const paymentMethods = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: true,
    });

    const paymentMethodStats = paymentMethods.map((method) => ({
      method: method.paymentMethod,
      total: method._sum.amount || 0,
      count: method._count,
    }));

    // 6. Order Status Distribution
    const orderStatuses = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    const orderStatusStats = orderStatuses.map((status) => ({
      status: status.status,
      count: status._count,
    }));

    return NextResponse.json({
      overview: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalOrders,
        activeOrders,
        totalOutstanding,
        totalCustomers: customers.length,
      },
      monthlyRevenue,
      customerLTV,
      popularItems,
      paymentMethodStats,
      orderStatusStats,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
