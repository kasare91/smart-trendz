'use client';

import { useState, useEffect } from 'react';
import { isOnline, syncPendingActions, getPendingCount } from '@/lib/offline-storage';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    // Set initial online status
    setOnline(isOnline());
    updatePendingCount();

    // Listen for online/offline events
    const handleOnline = async () => {
      setOnline(true);
      // Auto-sync when coming back online
      await handleSync();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending count periodically
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = () => {
    setPendingCount(getPendingCount());
  };

  const handleSync = async () => {
    if (!online || syncing) return;

    setSyncing(true);
    try {
      const result = await syncPendingActions();

      if (result.success) {
        setSyncMessage(`Successfully synced ${result.syncedCount} items`);
      } else if (result.syncedCount > 0) {
        setSyncMessage(`Synced ${result.syncedCount} items with ${result.errors.length} errors`);
      } else {
        setSyncMessage('Failed to sync items');
      }

      setShowSyncResult(true);
      updatePendingCount();

      // Hide sync message after 5 seconds
      setTimeout(() => {
        setShowSyncResult(false);
      }, 5000);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncMessage('Sync failed');
      setShowSyncResult(true);
    } finally {
      setSyncing(false);
    }
  };

  // Don't show anything if online and no pending items
  if (online && pendingCount === 0 && !showSyncResult) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Offline indicator */}
      {!online && (
        <div className="bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm font-medium">Offline Mode</span>
        </div>
      )}

      {/* Pending items indicator with sync button */}
      {pendingCount > 0 && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">
              {pendingCount} pending {pendingCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          {online && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-white text-blue-500 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </span>
              ) : (
                'Sync Now'
              )}
            </button>
          )}
        </div>
      )}

      {/* Sync result message */}
      {showSyncResult && (
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">{syncMessage}</span>
        </div>
      )}
    </div>
  );
}
