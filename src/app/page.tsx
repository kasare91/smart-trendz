import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  formatCurrency,
  formatDate,
  enrichOrder,
  getUrgencyColor,
  getUrgencyLabel,
  getCurrentWeek,
  calculateDaysToDue,
} from '@/lib/utils';
import DashboardOrderCard from '@/components/DashboardOrderCard';

async function getDashboardData() {
  const { start: weekStart, end: weekEnd } = getCurrentWeek();

  // Active orders count (not COLLECTED or CANCELLED)
  const activeOrdersCount = await prisma.order.count({
    where: {
      status: {
        notIn: ['COLLECTED', 'CANCELLED'],
      },
    },
  });

  // All active orders with payments for balance calculation
  const activeOrders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ['COLLECTED', 'CANCELLED'],
      },
    },
    include: {
      payments: true,
    },
  });

  // Calculate total outstanding balance
  const totalOutstanding = activeOrders.reduce((sum: number, order: typeof activeOrders[number]) => {
    const paid = order.payments.reduce((pSum: number, p: typeof order.payments[number]) => pSum + p.amount, 0);
    return sum + (order.totalAmount - paid);
  }, 0);

  // Total received this week
  const weekPayments = await prisma.payment.findMany({
    where: {
      paymentDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  const totalReceivedThisWeek = weekPayments.reduce((sum: number, p: typeof weekPayments[number]) => sum + p.amount, 0);

  // Upcoming orders (due within 5 days, not overdue)
  const upcomingOrders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ['COLLECTED', 'CANCELLED'],
      },
    },
    include: {
      customer: true,
      payments: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  // Filter and categorize by urgency
  type OrderWithRelations = typeof upcomingOrders[number];
  const categorized = {
    overdue: [] as OrderWithRelations[],
    due1Day: [] as OrderWithRelations[],
    due3Days: [] as OrderWithRelations[],
    due5Days: [] as OrderWithRelations[],
  };

  upcomingOrders.forEach((order: OrderWithRelations) => {
    const days = calculateDaysToDue(order.dueDate);

    if (days <= 0) categorized.overdue.push(order);
    else if (days <= 1) categorized.due1Day.push(order);
    else if (days <= 3) categorized.due3Days.push(order);
    else if (days <= 5) categorized.due5Days.push(order);
  });

  return {
    activeOrdersCount,
    totalOutstanding,
    totalReceivedThisWeek,
    upcomingOrders: categorized,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Overview of Smart Trendz operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          title="Active Orders"
          value={data.activeOrdersCount}
          icon="📋"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(data.totalOutstanding)}
          icon="💰"
          valueColor="text-amber-600"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Received This Week"
          value={formatCurrency(data.totalReceivedThisWeek)}
          icon="✅"
          valueColor="text-emerald-600"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Upcoming Orders Section */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming & Overdue Orders
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Orders requiring attention
              </p>
            </div>
            <Link
              href="/orders"
              className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              View all
            </Link>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Overdue */}
          {data.upcomingOrders.overdue.length > 0 && (
            <UrgencySection
              title="🚨 Overdue"
              orders={data.upcomingOrders.overdue}
            />
          )}

          {/* Due in 1 day */}
          {data.upcomingOrders.due1Day.length > 0 && (
            <UrgencySection
              title="⚠️ Due Tomorrow or Today"
              orders={data.upcomingOrders.due1Day}
            />
          )}

          {/* Due in 3 days */}
          {data.upcomingOrders.due3Days.length > 0 && (
            <UrgencySection
              title="⏰ Due in 2-3 Days"
              orders={data.upcomingOrders.due3Days}
            />
          )}

          {/* Due in 5 days */}
          {data.upcomingOrders.due5Days.length > 0 && (
            <UrgencySection
              title="📅 Due in 4-5 Days"
              orders={data.upcomingOrders.due5Days}
            />
          )}

          {data.upcomingOrders.overdue.length === 0 &&
            data.upcomingOrders.due1Day.length === 0 &&
            data.upcomingOrders.due3Days.length === 0 &&
            data.upcomingOrders.due5Days.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-gray-500 font-medium">All clear!</p>
                <p className="text-sm text-gray-400 mt-1">
                  No orders due in the next 5 days
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  valueColor = 'text-gray-900',
  iconBg = 'bg-gray-50',
  iconColor = 'text-gray-600',
}: {
  title: string;
  value: string | number;
  icon: string;
  valueColor?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function UrgencySection({
  title,
  orders,
}: {
  title: string;
  orders: any[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const enriched = enrichOrder(order);
          return <DashboardOrderCard key={order.id} order={enriched} />;
        })}
      </div>
    </div>
  );
}
