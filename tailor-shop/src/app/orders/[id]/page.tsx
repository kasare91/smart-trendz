'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  enrichOrder,
  getUrgencyColor,
  getUrgencyLabel,
} from '@/lib/utils';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error('Order not found');
      const data = await res.json();
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      alert('Order not found');
      router.push('/orders');
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

  if (!order) return null;

  const enriched = enrichOrder(order);
  const colors = getUrgencyColor(enriched.urgency);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Order Details</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            + Add Payment
          </button>
        </div>
      </div>

      {/* Due Date Alert */}
      <div
        className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Due Date</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatDate(order.dueDate)}
            </div>
          </div>
          <div className={`text-lg font-bold ${colors.text}`}>
            {getUrgencyLabel(enriched.urgency, enriched.daysToDue)}
          </div>
        </div>
      </div>

      {/* Customer & Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Customer Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.customer.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.customer.phoneNumber}
              </dd>
            </div>
            {order.customer.email && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {order.customer.email}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Order Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(order.orderDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.description}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Payment Summary
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount Paid</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(enriched.amountPaid)}
            </span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="font-semibold text-gray-900">
              Outstanding Balance
            </span>
            <span className="text-2xl font-bold text-orange-600">
              {formatCurrency(enriched.balance)}
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payment Progress</span>
              <span className="text-gray-700 font-medium">
                {((enriched.amountPaid / order.totalAmount) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(enriched.amountPaid / order.totalAmount) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Payment History
        </h2>
        {order.payments.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            No payments recorded yet
          </p>
        ) : (
          <div className="space-y-3">
            {order.payments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDateTime(payment.paymentDate)} •{' '}
                    {payment.paymentMethod}
                  </div>
                  {payment.note && (
                    <div className="text-sm text-gray-600 mt-1">
                      {payment.note}
                    </div>
                  )}
                </div>
                <div className="text-green-600">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPaymentModal && (
        <PaymentModal
          order={order}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            fetchOrder();
          }}
        />
      )}

      {showEditModal && (
        <EditOrderModal
          order={order}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchOrder();
          }}
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

function PaymentModal({
  order,
  onClose,
  onSuccess,
}: {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const enriched = enrichOrder(order);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState({
    amount: enriched.balance.toString(),
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          ...payment,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add payment');
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Add Payment
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (GHS) *
            </label>
            <input
              type="number"
              required
              min="0.01"
              max={enriched.balance}
              step="0.01"
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Outstanding balance: {formatCurrency(enriched.balance)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              value={payment.paymentMethod}
              onChange={(e) =>
                setPayment({ ...payment, paymentMethod: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="CASH">Cash</option>
              <option value="MOMO">Mobile Money</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              required
              value={payment.paymentDate}
              onChange={(e) =>
                setPayment({ ...payment, paymentDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (Optional)
            </label>
            <textarea
              value={payment.note}
              onChange={(e) => setPayment({ ...payment, note: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: order.description,
    totalAmount: order.totalAmount.toString(),
    dueDate: new Date(order.dueDate).toISOString().split('T')[0],
    status: order.status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to update order');

      onSuccess();
    } catch (error) {
      alert('Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Order</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Amount (GHS) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) =>
                setFormData({ ...formData, totalAmount: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) =>
                setFormData({ ...formData, dueDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY">Ready</option>
              <option value="COLLECTED">Collected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
