'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '@/lib/utils';

export default function CustomersPage() {
  const { data: session } = useSession();
  const canCreate = session?.user?.role === 'ADMIN' || session?.user?.role === 'STAFF';
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState<any>(null);
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
      setCustomers(Array.isArray(data) ? data : data.data || []);
      setPagination(Array.isArray(data) ? null : data.pagination);
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
            View all your customers{pagination ? ` (${pagination.total})` : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer
          </Link>
        )}
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
