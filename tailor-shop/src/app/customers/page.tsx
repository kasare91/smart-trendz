'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            View all your customers
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone number..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No customers found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {customers.map((customer: any) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {customer.fullName}
                    </h3>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600">
                        Phone: {customer.phoneNumber}
                      </p>
                      {customer.email && (
                        <p className="text-sm text-gray-600">
                          Email: {customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Orders</div>
                    <div className="text-2xl font-bold text-primary-600">
                      {customer._count?.orders || 0}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
