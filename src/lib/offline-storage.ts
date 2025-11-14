/**
 * Offline Storage Utilities
 * Handles local storage of data when offline and syncing when back online
 */

const STORAGE_KEYS = {
  PENDING_ORDERS: 'smart-trendz-pending-orders',
  PENDING_PAYMENTS: 'smart-trendz-pending-payments',
  PENDING_CUSTOMERS: 'smart-trendz-pending-customers',
  CACHED_ORDERS: 'smart-trendz-cached-orders',
  CACHED_CUSTOMERS: 'smart-trendz-cached-customers',
  LAST_SYNC: 'smart-trendz-last-sync',
};

interface PendingItem {
  id: string;
  timestamp: number;
  data: any;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Save pending action to localStorage for sync later
 */
export function savePendingAction(
  storageKey: string,
  endpoint: string,
  data: any,
  type: 'create' | 'update' | 'delete' = 'create'
): void {
  try {
    const pending = getPendingActions(storageKey);
    const item: PendingItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data,
      type,
      endpoint,
    };
    pending.push(item);
    localStorage.setItem(storageKey, JSON.stringify(pending));
  } catch (error) {
    console.error('Error saving pending action:', error);
  }
}

/**
 * Get all pending actions from localStorage
 */
export function getPendingActions(storageKey: string): PendingItem[] {
  try {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

/**
 * Remove a pending action after successful sync
 */
export function removePendingAction(storageKey: string, id: string): void {
  try {
    const pending = getPendingActions(storageKey);
    const updated = pending.filter((item) => item.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (error) {
    console.error('Error removing pending action:', error);
  }
}

/**
 * Clear all pending actions for a storage key
 */
export function clearPendingActions(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error clearing pending actions:', error);
  }
}

/**
 * Cache data for offline access
 */
export function cacheData(storageKey: string, data: any): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

/**
 * Get cached data
 */
export function getCachedData<T>(storageKey: string): T | null {
  try {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): number | null {
  try {
    const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
}

/**
 * Sync all pending actions to server
 */
export async function syncPendingActions(): Promise<{
  success: boolean;
  syncedCount: number;
  errors: string[];
}> {
  if (!isOnline()) {
    return { success: false, syncedCount: 0, errors: ['Device is offline'] };
  }

  const errors: string[] = [];
  let syncedCount = 0;

  // Sync pending orders
  const pendingOrders = getPendingActions(STORAGE_KEYS.PENDING_ORDERS);
  for (const item of pendingOrders) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.type === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (response.ok) {
        removePendingAction(STORAGE_KEYS.PENDING_ORDERS, item.id);
        syncedCount++;
      } else {
        errors.push(`Failed to sync order: ${response.statusText}`);
      }
    } catch (error) {
      errors.push(`Error syncing order: ${error}`);
    }
  }

  // Sync pending payments
  const pendingPayments = getPendingActions(STORAGE_KEYS.PENDING_PAYMENTS);
  for (const item of pendingPayments) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.type === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (response.ok) {
        removePendingAction(STORAGE_KEYS.PENDING_PAYMENTS, item.id);
        syncedCount++;
      } else {
        errors.push(`Failed to sync payment: ${response.statusText}`);
      }
    } catch (error) {
      errors.push(`Error syncing payment: ${error}`);
    }
  }

  // Sync pending customers
  const pendingCustomers = getPendingActions(STORAGE_KEYS.PENDING_CUSTOMERS);
  for (const item of pendingCustomers) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.type === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (response.ok) {
        removePendingAction(STORAGE_KEYS.PENDING_CUSTOMERS, item.id);
        syncedCount++;
      } else {
        errors.push(`Failed to sync customer: ${response.statusText}`);
      }
    } catch (error) {
      errors.push(`Error syncing customer: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    syncedCount,
    errors,
  };
}

/**
 * Get count of pending items across all storage keys
 */
export function getPendingCount(): number {
  return (
    getPendingActions(STORAGE_KEYS.PENDING_ORDERS).length +
    getPendingActions(STORAGE_KEYS.PENDING_PAYMENTS).length +
    getPendingActions(STORAGE_KEYS.PENDING_CUSTOMERS).length
  );
}

export { STORAGE_KEYS };
