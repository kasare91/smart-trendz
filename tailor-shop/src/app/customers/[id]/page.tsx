'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatCurrency,
  formatDate,
  enrichOrder,
  getUrgencyColor,
} from '@/lib/utils';

export default function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomer();
  }, [params.id]);

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error('Customer not found');
      const data = await res.json();
      setCustomer(data);
    } catch (error) {
      console.error('Error fetching customer:', error);
      alert('Customer not found');
      router.push('/customers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!customer) return null;

  const enrichedOrders = customer.orders.map(enrichOrder);

  // Calculate totals
  const totals = enrichedOrders.reduce(
    (acc: any, order: any) => ({
      total: acc.total + order.totalAmount,
      paid: acc.paid + order.amountPaid,
      balance: acc.balance + order.balance,
    }),
    { total: 0, paid: 0, balance: 0 }
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {customer.fullName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Customer Details</p>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Contact Information
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {customer.phoneNumber}
            </dd>
          </div>
          {customer.email && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Total Orders
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {customer.orders.length}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Outstanding Balance
            </dt>
            <dd className="mt-1 text-lg font-bold text-orange-600">
              {formatCurrency(totals.balance)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
            <Link
              href="/orders/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              + New Order
            </Link>
          </div>
        </div>

        {customer.orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {enrichedOrders.map((order: any) => {
              const colors = getUrgencyColor(order.urgency);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={`block p-6 hover:bg-gray-50 ${colors.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">
                          {order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {order.description}
                      </p>
                      <div className="mt-2 text-sm text-gray-500">
                        Due: {formatDate(order.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Balance</div>
                      <div className="text-lg font-bold text-orange-600">
                        {formatCurrency(order.balance)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        of {formatCurrency(order.totalAmount)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    READY: 'bg-green-100 text-green-800',
    COLLECTED: 'bg-purple-100 text-purple-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
