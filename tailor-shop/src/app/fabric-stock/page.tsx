'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';

type FabricStockItem = {
  id: string;
  branchId: string;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
};

type FabricFormState = {
  name: string;
  unit: string;
  quantity: string;
  reorderLevel: string;
};

export default function FabricStockPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<FabricStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FabricFormState>({
    name: '',
    unit: 'metres',
    quantity: '0',
    reorderLevel: '2',
  });

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/fabric-stock');
      if (!response.ok) throw new Error('Failed to load fabric stock');
      const data = (await response.json()) as FabricStockItem[];
      setItems(data);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load fabric stock');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/fabric-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to create fabric stock');
      }

      setForm({ name: '', unit: 'metres', quantity: '0', reorderLevel: '2' });
      setShowForm(false);
      fetchStock();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Failed to create fabric stock');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (item: FabricStockItem, updates: Partial<FabricStockItem>) => {
    const response = await fetch(`/api/fabric-stock/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'Failed to update fabric stock');
    }

    const updated = (await response.json()) as FabricStockItem;
    setItems((current) => current.map((stock) => (stock.id === updated.id ? updated : stock)));
  };

  const adjustQuantity = async (item: FabricStockItem, delta: number) => {
    try {
      await updateItem(item, { quantity: Math.max(0, item.quantity + delta) });
    } catch (adjustError: unknown) {
      setError(adjustError instanceof Error ? adjustError.message : 'Failed to update quantity');
    }
  };

  const handleDelete = async (item: FabricStockItem) => {
    if (!confirm(`Delete ${item.name}?`)) return;

    try {
      const response = await fetch(`/api/fabric-stock/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to delete fabric stock');
      }
      setItems((current) => current.filter((stock) => stock.id !== item.id));
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete fabric stock');
    }
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Fabric Stock"
        subtitle="Track lightweight fabric inventory by branch"
        action={
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 text-sm"
          >
            Add fabric
          </button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
              <input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reorder level</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.reorderLevel}
                onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save fabric'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        {loading ? (
          <SkeletonList rows={4} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={
              <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            }
            title="No fabric stock yet"
            body="Add your first fabric to start tracking inventory by branch."
            action={{ label: 'Add fabric', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Reorder level</th>
                  {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {items.map((item) => {
                  const lowStock = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item.id} className={lowStock ? 'bg-amber-50 dark:bg-amber-900/20' : undefined}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.unit}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item, -1)}
                            className="h-8 w-8 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            -
                          </button>
                          <span className="w-16 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item, 1)}
                            className="h-8 w-8 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.reorderLevel}</td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
