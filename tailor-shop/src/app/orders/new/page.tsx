'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
  });

  const [order, setOrder] = useState({
    description: '',
    totalAmount: '',
    orderDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'PENDING',
  });

  const [initialPayment, setInitialPayment] = useState({
    amount: '',
    paymentMethod: 'CASH',
    note: 'Initial deposit',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalCustomerId = customerId;

      // Create new customer if needed
      if (showNewCustomer) {
        const customerRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCustomer),
        });

        if (!customerRes.ok) {
          throw new Error('Failed to create customer');
        }

        const customer = await customerRes.json();
        finalCustomerId = customer.id;
      }

      // Create order
      const orderData = {
        customerId: finalCustomerId,
        description: order.description,
        totalAmount: parseFloat(order.totalAmount),
        orderDate: order.orderDate,
        dueDate: order.dueDate,
        status: order.status,
        ...(initialPayment.amount &&
          parseFloat(initialPayment.amount) > 0 && {
            initialPayment: {
              amount: parseFloat(initialPayment.amount),
              paymentMethod: initialPayment.paymentMethod,
              paymentDate: order.orderDate,
              note: initialPayment.note,
            },
          }),
      };

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!orderRes.ok) {
        throw new Error('Failed to create order');
      }

      const createdOrder = await orderRes.json();
      router.push(`/orders/${createdOrder.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">New Order</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new order for a customer
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Customer</h2>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setShowNewCustomer(false)}
              className={`px-4 py-2 rounded-lg font-medium ${
                !showNewCustomer
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Existing Customer
            </button>
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              className={`px-4 py-2 rounded-lg font-medium ${
                showNewCustomer
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              New Customer
            </button>
          </div>

          {!showNewCustomer ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Customer *
              </label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Choose a customer...</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName} - {customer.phoneNumber}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomer.fullName}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={newCustomer.phoneNumber}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phoneNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              required
              value={order.description}
              onChange={(e) => setOrder({ ...order, description: e.target.value })}
              rows={3}
              placeholder="e.g., Kente dress + blazer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount (GHS) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={order.totalAmount}
                onChange={(e) =>
                  setOrder({ ...order, totalAmount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={order.status}
                onChange={(e) => setOrder({ ...order, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="READY">Ready</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Date *
              </label>
              <input
                type="date"
                required
                value={order.orderDate}
                onChange={(e) => setOrder({ ...order, orderDate: e.target.value })}
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
                value={order.dueDate}
                onChange={(e) => setOrder({ ...order, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Initial Payment */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Initial Payment (Optional)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (GHS)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialPayment.amount}
                onChange={(e) =>
                  setInitialPayment({ ...initialPayment, amount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={initialPayment.paymentMethod}
                onChange={(e) =>
                  setInitialPayment({
                    ...initialPayment,
                    paymentMethod: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="CASH">Cash</option>
                <option value="MOMO">Mobile Money</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
