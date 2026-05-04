'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';

interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  _count?: { orders: number };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const canCreate = session?.user?.role === 'ADMIN' || session?.user?.role === 'STAFF';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
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
      <PageHeader
        title="Customers"
        subtitle={`Your boutique's customer directory${pagination ? ` (${pagination.total})` : ''}`}
        action={canCreate ? (
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer
          </Link>
        ) : undefined}
      />

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone number..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        {loading ? (
          <SkeletonList rows={6} cols={4} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={
              <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
            title="No customers yet"
            body="Add your first customer to start creating orders."
            action={{ label: 'Add customer', href: '/customers/new' }}
          />
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors dark:hover:bg-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {customer.fullName}
                    </h3>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Phone: {customer.phoneNumber}
                      </p>
                      {customer.email && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Email: {customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Orders</div>
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
