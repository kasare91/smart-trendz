'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';

interface BranchCount { users: number; customers: number; orders: number; }

interface Branch {
  id: string;
  name: string;
  location: string;
  active: boolean;
  createdAt: string;
  _count: BranchCount;
}

interface FormData { name: string; location: string; }

const emptyForm: FormData = { name: '', location: '' };

export default function BranchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/');
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') fetchBranches();
  }, [status, session]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
      else setError('Failed to fetch branches');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching branches');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingBranch(null);
    setFormData(emptyForm);
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({ name: branch.name, location: branch.location });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBranch(null);
    setFormData(emptyForm);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = editingBranch
        ? await fetch(`/api/branches/${editingBranch.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          })
        : await fetch('/api/branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

      const data = await res.json();

      if (res.ok) {
        setSuccess(editingBranch ? 'Branch updated successfully' : 'Branch created successfully');
        setShowModal(false);
        setEditingBranch(null);
        setFormData(emptyForm);
        fetchBranches();
      } else {
        setError(data.error || 'Failed to save branch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (branch: Branch) => {
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !branch.active }),
      });
      if (res.ok) {
        setSuccess(`Branch ${!branch.active ? 'activated' : 'deactivated'} successfully`);
        fetchBranches();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update branch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating branch');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Branches"
          subtitle="Manage your business locations"
          action={
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              + New Branch
            </button>
          }
        />
        <SkeletonList rows={3} cols={4} />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        subtitle="Manage your business locations"
        action={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            + New Branch
          </button>
        }
      />

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700">
        {branches.length === 0 ? (
          <EmptyState
            icon={
              <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            title="No branches yet"
            body="Add your first branch to get started."
            action={{ label: 'Add Branch', onClick: openAdd }}
          />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {branches.map(branch => (
                <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{branch.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(branch.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{branch.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{branch._count.users}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{branch._count.customers}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{branch._count.orders}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      branch.active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {branch.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEdit(branch)}
                      className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(branch)}
                      className={branch.active
                        ? 'text-red-600 hover:text-red-900 dark:hover:text-red-400'
                        : 'text-green-600 hover:text-green-900 dark:hover:text-green-400'}
                    >
                      {branch.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900/70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h3>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kumasi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={e => setFormData(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Kumasi, Ashanti Region"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
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
