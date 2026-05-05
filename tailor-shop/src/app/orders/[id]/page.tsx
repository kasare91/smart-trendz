'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  enrichOrder,
  getUrgencyColor,
  getUrgencyLabel,
  OrderWithRelations,
} from '@/lib/utils';
import BusinessLogo from '@/components/BusinessLogo';
import { DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';
import { fetchCached } from '@/lib/client-cache';

type BusinessProfile = {
  businessName: string;
  currency?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  receiptFooterNote?: string | null;
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionNote, setCollectionNote] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchOrder();
    fetchBusinessProfile();
  }, [params.id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error('Order not found');
      const data = (await res.json()) as OrderWithRelations;
      setOrder(data);
    } catch (error: unknown) {
      console.error('Error fetching order:', error);
      router.push('/orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessProfile = async () => {
    try {
      const data = await fetchCached(
        'business-profile',
        async () => {
          const res = await fetch('/api/business-profile');
          return (await res.json()) as { data: BusinessProfile | null };
        }
      );
      setBusinessProfile(data.data);
    } catch (error: unknown) {
      console.error('Error fetching business profile:', error);
    }
  };

  const handleMarkAsCollected = async () => {
    setCollectionNote('');
    setShowCollectionModal(true);
  };

  const handleConfirmCollected = async () => {
    try {
      const res = await fetch(`/api/orders/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COLLECTED', collectedNote: collectionNote }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update order');
      }

      setShowCollectionModal(false);
      showToast('success', 'Order marked as collected');
      fetchOrder(); // Refresh the order data
    } catch (error: unknown) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to mark order as collected'
      );
    }
  };

  const handleApplyCredit = async () => {
    if (!order) return;
    const enriched = enrichOrder(order);
    const availableCredit = order.customer.creditBalance ?? 0;
    const toApply = Math.min(availableCredit, enriched.balance);
    if (toApply <= 0) return;
    if (!confirm(`Apply GHS ${toApply.toFixed(2)} credit to this order?`)) return;
    setApplyingCredit(true);
    try {
      const res = await fetch(`/api/customers/${order.customerId}/apply-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, amount: toApply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply credit');
      showToast('success', `GHS ${toApply.toFixed(2)} credit applied`);
      fetchOrder();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to apply credit');
    } finally {
      setApplyingCredit(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendWhatsAppReceipt = async () => {
    setWhatsAppLoading(true);

    try {
      const res = await fetch(`/api/orders/${params.id}/whatsapp-receipt`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send WhatsApp receipt');

      showToast('success', 'Sent!');
    } catch (error: unknown) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to send WhatsApp receipt'
      );
    } finally {
      setWhatsAppLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    setReceiptLoading(true);
    window.open(`/api/orders/${params.id}/receipt`, '_blank', 'noopener,noreferrer');
    setTimeout(() => setReceiptLoading(false), 1200);
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
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Edit
          </button>
          {order.status === 'READY' && (
            <button
              onClick={handleMarkAsCollected}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm"
            >
              ✓ Mark as Collected
            </button>
          )}
          {order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              + Add Payment
            </button>
          )}
          {order.status !== 'COLLECTED' && order.status !== 'CANCELLED' &&
            (order.customer.creditBalance ?? 0) > 0 &&
            enriched.balance > 0 && (
            <button
              onClick={handleApplyCredit}
              disabled={applyingCredit}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50"
            >
              {applyingCredit ? 'Applying…' : `Use Credit (GHS ${(order.customer.creditBalance ?? 0).toFixed(2)})`}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Print
          </button>
          <button
            onClick={handleDownloadReceipt}
            disabled={receiptLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            {receiptLoading ? 'Generating...' : 'Download Receipt PDF'}
          </button>
          {order.customer.phoneNumber && (
            <button
              onClick={handleSendWhatsAppReceipt}
              disabled={whatsAppLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {whatsAppLoading ? 'Sending...' : 'Send WhatsApp Receipt'}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-700'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      <PrintableOrderSummary order={order} enriched={enriched} businessProfile={businessProfile} />

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

      {/* Order Photos */}
      {order.images && order.images.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Photos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {order.images.map((image: string, index: number) => (
              <div key={index} className="relative aspect-square group">
                <Image
                  src={image}
                  alt={`Order photo ${index + 1}`}
                  fill
                  className="object-cover rounded-lg border border-gray-200"
                />
                <a
                  href={image}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg"
                >
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {order.payments.map((payment) => (
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

      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Collection</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collection note
            </label>
            <textarea
              value={collectionNote}
              onChange={(event) => setCollectionNote(event.target.value)}
              rows={4}
              placeholder="Collected by customer in person, 2 May 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCollected}
                disabled={collectionNote.trim().length < 10}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
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

function PrintableOrderSummary({
  order,
  enriched,
  businessProfile,
}: {
  order: OrderWithRelations;
  enriched: ReturnType<typeof enrichOrder>;
  businessProfile: BusinessProfile | null;
}) {
  const businessName = businessProfile?.businessName || DEFAULT_BUSINESS_NAME;
  const address = [businessProfile?.address, businessProfile?.city, businessProfile?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="hidden print:block bg-white text-gray-900 p-8">
      <div className="flex items-start justify-between border-b border-gray-300 pb-4">
        <div className="flex items-center gap-4">
          <BusinessLogo
            businessName={businessName}
            logoUrl={businessProfile?.logoUrl}
            brandColor={businessProfile?.brandColor}
            size="lg"
          />
          <div>
            <h2 className="text-2xl font-bold">{businessName}</h2>
            {businessProfile?.phoneNumber && <p className="text-sm">{businessProfile.phoneNumber}</p>}
            {businessProfile?.email && <p className="text-sm">{businessProfile.email}</p>}
            {address && <p className="text-sm">{address}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Order</div>
          <div className="text-xl font-bold">{order.orderNumber}</div>
          <div className="text-sm">Due: {formatDate(order.dueDate)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-6">
        <div>
          <h3 className="font-semibold mb-2">Customer</h3>
          <p>{order.customer.fullName}</p>
          <p>{order.customer.phoneNumber}</p>
          {order.customer.email && <p>{order.customer.email}</p>}
        </div>
        <div>
          <h3 className="font-semibold mb-2">Order Details</h3>
          <p>Status: {order.status.replace('_', ' ')}</p>
          <p>Order date: {formatDate(order.orderDate)}</p>
          <p>{order.description}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="font-semibold mb-3">Payment Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total amount</span>
            <span>{formatCurrency(order.totalAmount, businessProfile?.currency || 'GHS')}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount paid</span>
            <span>{formatCurrency(enriched.amountPaid, businessProfile?.currency || 'GHS')}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Outstanding balance</span>
            <span>{formatCurrency(enriched.balance, businessProfile?.currency || 'GHS')}</span>
          </div>
        </div>
      </div>

      {order.payments.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Payment History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Method</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="py-2">{formatDateTime(payment.paymentDate)}</td>
                  <td className="py-2">{payment.paymentMethod}</td>
                  <td className="py-2 text-right">{formatCurrency(payment.amount, businessProfile?.currency || 'GHS')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {businessProfile?.receiptFooterNote && (
        <p className="mt-8 text-center text-sm text-gray-600">{businessProfile.receiptFooterNote}</p>
      )}
    </div>
  );
}

function PaymentModal({
  order,
  onClose,
  onSuccess,
}: {
  order: OrderWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const enriched = enrichOrder(order);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState({
    amount: enriched.balance.toString(),
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  const enteredAmount = parseFloat(payment.amount) || 0;
  const overpayment = Math.max(0, enteredAmount - enriched.balance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
        const data = await res.json();
        throw new Error(data.error || 'Failed to add payment');
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add payment');
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
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (GHS) *
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Outstanding balance: {formatCurrency(enriched.balance)}
            </p>
            {overpayment > 0 && (
              <p className="mt-1 text-sm text-teal-600 font-medium">
                GHS {overpayment.toFixed(2)} will be added to this customer&apos;s credit balance
              </p>
            )}
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
  order: OrderWithRelations;
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

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to update order');
      }

      onSuccess();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update order');
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
