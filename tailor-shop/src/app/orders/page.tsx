'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  formatCurrency,
  formatDate,
  enrichOrder,
  getUrgencyColor,
  getUrgencyLabel,
  DueDateUrgency,
} from '@/lib/utils';
import PaymentModal from '@/components/PaymentModal';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';

interface OrderCustomer {
  id: string;
  fullName: string;
  phoneNumber: string;
}

interface OrderPayment {
  id: string;
  amount: number;
}

interface Order {
  id: string;
  orderNumber: string;
  description: string;
  status: string;
  totalAmount: number;
  dueDate: string;
  customer: OrderCustomer;
  payments: OrderPayment[];
}

interface EnrichedOrder {
  id: string;
  orderNumber: string;
  description: string;
  status: string;
  totalAmount: number;
  dueDate: string;
  customer: OrderCustomer;
  payments: OrderPayment[];
  amountPaid: number;
  balance: number;
  urgency: DueDateUrgency;
  daysToDue: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
}

interface CustomerOption { id: string; fullName: string; phoneNumber?: string; }

const emptyOrderForm = {
  description: '',
  totalAmount: '',
  orderDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  status: 'PENDING',
};

const emptyPaymentForm = { amount: '', paymentMethod: 'CASH' };
const emptyNewCustomer = { fullName: '', phoneNumber: '', email: '' };

export default function OrdersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'ADMIN';
  const canCreate = isAdmin || session?.user?.role === 'STAFF';

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    order: EnrichedOrder | null;
  }>({ isOpen: false, order: null });

  // New order modal state
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

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
      setOrders(Array.isArray(data) ? data : data.data || []);
      setPagination(Array.isArray(data) ? null : data.pagination);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?pageSize=100');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const openNewOrder = () => {
    setShowNewCustomer(false);
    setCustomerId('');
    setNewCustomer(emptyNewCustomer);
    setOrderForm({ ...emptyOrderForm, orderDate: new Date().toISOString().split('T')[0] });
    setPaymentForm(emptyPaymentForm);
    setOrderError('');
    setShowNewOrder(true);
    fetchCustomers();
  };

  const closeNewOrder = () => {
    setShowNewOrder(false);
    setOrderError('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    setOrderLoading(true);
    try {
      let finalCustomerId = customerId;

      if (showNewCustomer) {
        const customerRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCustomer),
        });
        const customerData = await customerRes.json();
        if (!customerRes.ok) throw new Error(customerData.error || 'Failed to create customer');
        finalCustomerId = customerData.id;
      }

      const orderData = {
        customerId: finalCustomerId,
        description: orderForm.description,
        totalAmount: parseFloat(orderForm.totalAmount),
        orderDate: orderForm.orderDate,
        dueDate: orderForm.dueDate,
        status: orderForm.status,
        ...(paymentForm.amount && parseFloat(paymentForm.amount) > 0 && {
          initialPayment: {
            amount: parseFloat(paymentForm.amount),
            paymentMethod: paymentForm.paymentMethod,
            paymentDate: orderForm.orderDate,
            note: 'Initial deposit',
          },
        }),
      };

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      const createdOrder = await orderRes.json();
      if (!orderRes.ok) throw new Error(createdOrder.error || 'Failed to create order');
      router.push(`/orders/${createdOrder.id}`);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleReceivePayment = (e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    e.stopPropagation();
    const enriched = enrichedOrders.find((eo) => eo.id === order.id) ?? null;
    setPaymentModal({ isOpen: true, order: enriched });
  };

  const handlePaymentSuccess = () => {
    fetchOrders();
  };

  const handleMarkAsCollected = async (e: React.MouseEvent, orderId: string, orderNumber: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Mark order ${orderNumber} as collected?`)) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      if (!res.ok) throw new Error('Failed to update order');
      fetchOrders();
    } catch (error) {
      alert('Failed to mark order as collected');
      console.error(error);
    }
  };

  const enrichedOrders = orders.map(enrichOrder) as unknown as EnrichedOrder[];

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
      <PageHeader
        title="Orders"
        subtitle="Manage all customer orders"
        action={canCreate ? (
          <button
            onClick={openNewOrder}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
          >
            + New Order
          </button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order number, customer name, description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        {loading ? (
          <SkeletonList rows={6} cols={5} />
        ) : enrichedOrders.length === 0 ? (
          <EmptyState
            icon={
              <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            }
            title="No orders yet"
            body="Create your first order to start tracking work for customers."
            action={{ label: 'New order', onClick: openNewOrder }}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Due Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Paid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {enrichedOrders.map((order) => {
                    const colors = getUrgencyColor(order.urgency);
                    const hasBalance = order.balance > 0;
                    return (
                      <tr key={order.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${colors.bg}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.orderNumber}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {order.description.substring(0, 40)}{order.description.length > 40 && '...'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{order.customer.fullName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{order.customer.phoneNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{formatDate(order.dueDate)}</div>
                          <div className={`text-sm font-medium ${colors.text}`}>{getUrgencyLabel(order.urgency, order.daysToDue)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">{formatCurrency(order.amountPaid)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-orange-600">{formatCurrency(order.balance)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {order.status === 'READY' && (
                              <button
                                onClick={(e) => handleMarkAsCollected(e, order.id, order.orderNumber)}
                                className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-colors font-medium shadow-sm"
                              >
                                ✓ Collected
                              </button>
                            )}
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
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {enrichedOrders.map((order) => {
                const colors = getUrgencyColor(order.urgency);
                const hasBalance = order.balance > 0;
                return (
                  <div key={order.id} className={`block p-4 ${colors.bg}`}>
                    <Link href={`/orders/${order.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{order.orderNumber}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{order.customer.fullName}</div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{order.description}</div>
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Due: {formatDate(order.dueDate)}</div>
                          <div className={`font-medium ${colors.text}`}>{getUrgencyLabel(order.urgency, order.daysToDue)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-orange-600 font-bold">{formatCurrency(order.balance)}</div>
                          <div className="text-gray-500 dark:text-gray-400">balance</div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex gap-2 mt-2">
                      {order.status === 'READY' && (
                        <button
                          onClick={(e) => handleMarkAsCollected(e, order.id, order.orderNumber)}
                          className="flex-1 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors font-medium shadow-sm"
                        >
                          ✓ Mark Collected
                        </button>
                      )}
                      {hasBalance && order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && (
                        <button
                          onClick={(e) => handleReceivePayment(e, order)}
                          className="flex-1 px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors font-medium shadow-sm"
                        >
                          💰 Receive Payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 dark:bg-gray-700/50 dark:border-gray-600">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-gray-700 dark:text-gray-300">
                  Totals ({pagination?.total || enrichedOrders.length} orders)
                </span>
                <div className="flex space-x-6">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total: </span>
                    <span className="text-gray-900 dark:text-gray-100">{formatCurrency(totals.total)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Paid: </span>
                    <span className="text-green-600">{formatCurrency(totals.paid)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Balance: </span>
                    <span className="text-orange-600 font-bold">{formatCurrency(totals.balance)}</span>
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
          amountPaid={paymentModal.order?.amountPaid ?? 0}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900/70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-gray-800 mb-10">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">New Order</h3>
            </div>

            {orderError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {orderError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${!showNewCustomer ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${showNewCustomer ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    New Customer
                  </button>
                </div>

                {!showNewCustomer ? (
                  <select
                    required
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">Choose a customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName} — {c.phoneNumber}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newCustomer.fullName}
                      onChange={e => setNewCustomer(f => ({ ...f, fullName: e.target.value }))}
                      placeholder="Full name *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <input
                      type="tel"
                      required
                      value={newCustomer.phoneNumber}
                      onChange={e => setNewCustomer(f => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="Phone number *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  value={orderForm.description}
                  onChange={e => setOrderForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Kente dress + blazer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              {/* Amount + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total (GHS) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={orderForm.totalAmount}
                    onChange={e => setOrderForm(f => ({ ...f, totalAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={orderForm.status}
                    onChange={e => setOrderForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="READY">Ready</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order Date *</label>
                  <input
                    type="date"
                    required
                    value={orderForm.orderDate}
                    onChange={e => setOrderForm(f => ({ ...f, orderDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={orderForm.dueDate}
                    onChange={e => setOrderForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Initial Payment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Initial Payment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Amount (GHS)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOMO">Mobile Money</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={orderLoading}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {orderLoading ? 'Creating...' : 'Create Order'}
                </button>
                <button
                  type="button"
                  onClick={closeNewOrder}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
