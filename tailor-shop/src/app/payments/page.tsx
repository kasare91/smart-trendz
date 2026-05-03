'use client';

import { useEffect, useState } from 'react';
import { getCurrentWeek, getLastWeek, formatCurrency, formatDateTime } from '@/lib/utils';
import { format } from 'date-fns';

type DateRange = 'this-week' | 'last-week' | 'custom';

export default function PaymentsPage() {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('this-week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [dateRange, customStart, customEnd]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const range = getActiveRange();
      if (!range) return;

      const params = new URLSearchParams({
        startDate: format(range.startDate, 'yyyy-MM-dd'),
        endDate: format(range.endDate, 'yyyy-MM-dd'),
      });

      const res = await fetch(`/api/reports/weekly-payments?${params.toString()}`);
      const data = await res.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActiveRange = () => {
    if (dateRange === 'this-week') {
      const week = getCurrentWeek();
      return { startDate: week.start, endDate: week.end };
    }

    if (dateRange === 'last-week') {
      const week = getLastWeek();
      return { startDate: week.start, endDate: week.end };
    }

    if (!customStart || !customEnd) return null;
    return { startDate: new Date(customStart), endDate: new Date(customEnd) };
  };

  const handleExportCsv = async () => {
    const range = getActiveRange();
    if (!range) return;

    setExporting(true);
    try {
      const from = format(range.startDate, 'yyyy-MM-dd');
      const to = format(range.endDate, 'yyyy-MM-dd');
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/reports/weekly-payments/export?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to export CSV');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-${from}-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payments & Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          View payment history and weekly reports
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select Date Range
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setDateRange('this-week')}
            className={`px-4 py-2 rounded-lg font-medium ${
              dateRange === 'this-week'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setDateRange('last-week')}
            className={`px-4 py-2 rounded-lg font-medium ${
              dateRange === 'last-week'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last Week
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg font-medium ${
              dateRange === 'custom'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || (dateRange === 'custom' && (!customStart || !customEnd))}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading report...
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">
                Total Received
              </div>
              <div className="mt-2 text-3xl font-bold text-green-600">
                {formatCurrency(reportData.totalAmount)}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {reportData.totalCount} payments
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">
                Date Range
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {reportData.startDate}
              </div>
              <div className="text-sm text-gray-500">to {reportData.endDate}</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">
                Daily Average
              </div>
              <div className="mt-2 text-3xl font-bold text-primary-600">
                {formatCurrency(reportData.totalAmount / 7)}
              </div>
            </div>
          </div>

          {/* By Payment Method */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              By Payment Method
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(reportData.byMethod).map(([method, data]: [string, any]) => (
                <div key={method} className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-600">
                    {method}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(data.total)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {data.count} payment{data.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Breakdown
            </h2>
            <div className="space-y-3">
              {reportData.byDay.map((day: any) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {day.dayName}
                    </div>
                    <div className="text-sm text-gray-500">{day.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(day.total)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {day.count} payment{day.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All Payments List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                All Payments ({reportData.allPayments.length})
              </h2>
            </div>

            {reportData.allPayments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No payments in this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.allPayments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(payment.paymentDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.order.customer.fullName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.order.orderNumber}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {payment.paymentMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
