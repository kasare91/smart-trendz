'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/utils';

type ActivityLog = {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  branch: { name: string } | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
};

const ENTITIES = ['ORDER', 'CUSTOMER', 'PAYMENT', 'USER', 'MEASUREMENT', 'FABRIC_STOCK'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

export default function ActivityLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);

  const isAdmin = session?.user?.role === 'ADMIN';

  // Redirect non-admin users who can't view this page
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'VIEWER') {
      router.replace('/');
    }
  }, [status, session, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (filterEntity) params.set('entity', filterEntity);
      if (filterAction) params.set('action', filterAction);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const res = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      setLogs(data.data ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, filterEntity, filterAction, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (status === 'authenticated') fetchLogs();
  }, [fetchLogs, status]);

  const handleFilterChange = () => {
    setPage(1);
    fetchLogs();
  };

  const filteredLogs = filterSearch
    ? logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(filterSearch.toLowerCase()) ||
          l.description.toLowerCase().includes(filterSearch.toLowerCase()) ||
          l.entity.toLowerCase().includes(filterSearch.toLowerCase())
      )
    : logs;

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Audit trail of all mutations — who did what and when
          {!isAdmin && ' (your branch only)'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search user or description..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          <select
            value={filterEntity}
            onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          >
            <option value="">All entities</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{e.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              aria-label="Start date"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              aria-label="End date"
            />
          </div>
        </div>

        {(filterEntity || filterAction || filterStartDate || filterEndDate || filterSearch) && (
          <button
            onClick={() => {
              setFilterEntity('');
              setFilterAction('');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterSearch('');
              setPage(1);
            }}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium">No activity found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">When</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">User</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Branch</th>}
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap font-medium">
                      {log.userName}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {log.branch?.name ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {log.entity.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
