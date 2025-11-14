'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatCurrency,
  formatDate,
  getUrgencyColor,
  getUrgencyLabel,
} from '@/lib/utils';
import PaymentModal from './PaymentModal';

interface DashboardOrderCardProps {
  order: any;
}

export default function DashboardOrderCard({ order }: DashboardOrderCardProps) {
  const router = useRouter();
  const [paymentModal, setPaymentModal] = useState(false);
  const colors = getUrgencyColor(order.urgency);
  const hasBalance = order.balance > 0;

  const handleReceivePayment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPaymentModal(true);
  };

  const handleMarkAsCollected = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Mark order ${order.orderNumber} as collected?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });

      if (!res.ok) throw new Error('Failed to update order');

      router.refresh();
    } catch (error) {
      alert('Failed to mark order as collected');
      console.error(error);
    }
  };

  const handlePaymentSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <Link
        href={`/orders/${order.id}`}
        className={`block p-4 rounded-lg border ${colors.border} ${colors.bg} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{order.orderNumber}</div>
            <div className="text-sm text-gray-600">{order.customer.fullName}</div>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium border ${colors.border}`}>
            {getUrgencyLabel(order.urgency, order.daysToDue)}
          </div>
        </div>

        <div className="text-sm text-gray-700 mb-3 line-clamp-2">
          {order.description}
        </div>

        <div className="flex items-center justify-between text-sm mb-3">
          <div>
            <div className="text-gray-500">Due Date</div>
            <div className="font-medium text-gray-900">{formatDate(order.dueDate)}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500">Balance</div>
            <div className="font-bold text-orange-600">{formatCurrency(order.balance)}</div>
          </div>
        </div>

        <div className="flex gap-2">
          {order.status === 'READY' && (
            <button
              onClick={handleMarkAsCollected}
              className="flex-1 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors font-medium shadow-sm"
            >
              ✓ Collected
            </button>
          )}
          {hasBalance && order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && (
            <button
              onClick={handleReceivePayment}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors font-medium shadow-sm"
            >
              💰 Receive Payment
            </button>
          )}
        </div>
      </Link>

      {paymentModal && (
        <PaymentModal
          isOpen={paymentModal}
          onClose={() => setPaymentModal(false)}
          orderId={order.id}
          orderNumber={order.orderNumber}
          customerName={order.customer.fullName}
          totalAmount={order.totalAmount}
          amountPaid={order.amountPaid}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
