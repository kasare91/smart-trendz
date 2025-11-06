'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatCurrency,
  formatDate,
  enrichOrder,
  getUrgencyColor,
  getUrgencyLabel,
} from '@/lib/utils';
import PaymentModal from '@/components/PaymentModal';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    order: any | null;
  }>({ isOpen: false, order: null });

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceivePayment = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setPaymentModal({ isOpen: true, order });
  };

  const handlePaymentSuccess = () => {
    fetchOrders();
  };

  const enrichedOrders = orders.map(enrichOrder);

  // Calculate totals
  const totals = enrichedOrders.reduce(
    (acc, order) => ({
      total: acc.total + order.totalAmount,
      paid: acc.paid + order.amountPaid,
      balance: acc.balance + order.balance,
    }),
    { total: 0, paid: 0, balance: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all customer orders
          </p>
        </div>
        <Link
          href="/orders/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order number, customer name, description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY">Ready</option>
              <option value="COLLECTED">Collected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : enrichedOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders found. Create your first order!
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {enrichedOrders.map((order) => {
                    const colors = getUrgencyColor(order.urgency);
                    const hasBalance = order.balance > 0;
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50 ${colors.bg}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.description.substring(0, 40)}
                            {order.description.length > 40 && '...'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {order.customer.fullName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.customer.phoneNumber}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(order.dueDate)}
                          </div>
                          <div className={`text-sm font-medium ${colors.text}`}>
                            {getUrgencyLabel(order.urgency, order.daysToDue)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                          {formatCurrency(order.amountPaid)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-orange-600">
                          {formatCurrency(order.balance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {hasBalance && order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && (
                              <button
                                onClick={(e) => handleReceivePayment(e, order)}
                                className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 transition-colors font-medium shadow-sm"
                              >
                                💰 Pay
                              </button>
                            )}
                            <Link
                              href={`/orders/${order.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors font-medium"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {enrichedOrders.map((order) => {
                const colors = getUrgencyColor(order.urgency);
                const hasBalance = order.balance > 0;
                return (
                  <div
                    key={order.id}
                    className={`block p-4 ${colors.bg}`}
                  >
                    <Link href={`/orders/${order.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            {order.customer.fullName}
                          </div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {order.description}
                      </div>
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div>
                          <div className="text-gray-500">
                            Due: {formatDate(order.dueDate)}
                          </div>
                          <div className={`font-medium ${colors.text}`}>
                            {getUrgencyLabel(order.urgency, order.daysToDue)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-orange-600 font-bold">
                            {formatCurrency(order.balance)}
                          </div>
                          <div className="text-gray-500">balance</div>
                        </div>
                      </div>
                    </Link>
                    {hasBalance && order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={(e) => handleReceivePayment(e, order)}
                        className="w-full px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors font-medium shadow-sm"
                      >
                        💰 Receive Payment
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-gray-700">
                  Totals ({enrichedOrders.length} orders)
                </span>
                <div className="flex space-x-6">
                  <div>
                    <span className="text-gray-500">Total: </span>
                    <span className="text-gray-900">
                      {formatCurrency(totals.total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Paid: </span>
                    <span className="text-green-600">
                      {formatCurrency(totals.paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Balance: </span>
                    <span className="text-orange-600 font-bold">
                      {formatCurrency(totals.balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal.order && (
        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false, order: null })}
          orderId={paymentModal.order.id}
          orderNumber={paymentModal.order.orderNumber}
          customerName={paymentModal.order.customer.fullName}
          totalAmount={paymentModal.order.totalAmount}
          amountPaid={paymentModal.order.amountPaid}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
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
