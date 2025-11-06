'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const analyticsData = await res.json();
      setData(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Failed to load analytics</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Business insights and performance metrics
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data.overview.totalRevenue)}
          icon="💰"
          color="emerald"
        />
        <StatCard
          title="Total Orders"
          value={data.overview.totalOrders}
          icon="📋"
          color="blue"
        />
        <StatCard
          title="Active Orders"
          value={data.overview.activeOrders}
          icon="⏳"
          color="amber"
        />
        <StatCard
          title="Total Customers"
          value={data.overview.totalCustomers}
          icon="👥"
          color="purple"
        />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Monthly Revenue (Last 6 Months)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value: any) => formatCurrency(value)}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} name="Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Methods
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.paymentMethodStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ method, count }) => `${method} (${count})`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {data.paymentMethodStats.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status */}
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.orderStatusStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="status" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Top Customers by Lifetime Value
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Your most valuable customers
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Order
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.customerLTV.map((customer: any, index: number) => (
                <tr key={customer.customerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.customerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.phoneNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {customer.totalOrders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-emerald-600">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {formatCurrency(customer.averageOrderValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popular Items */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Popular Items
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Most frequently ordered items
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.popularItems.map((item: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {item.item}
                  </span>
                  <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-full font-medium">
                    #{index + 1}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Orders: <span className="font-semibold">{item.count}</span></div>
                  <div>Revenue: <span className="font-semibold text-emerald-600">{formatCurrency(item.revenue)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  icon: string;
  color?: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
