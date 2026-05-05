interface CacheEntry<T> { data: T; expiresAt: number; }

const store = new Map<string, CacheEntry<unknown>>();

function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

function set<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// In-flight dedup: if the same key is being fetched, reuse the same promise
const inflight = new Map<string, Promise<unknown>>();

export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000
): Promise<T> {
  const cached = get<T>(key);
  if (cached !== null) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().then((data) => {
    set(key, data, ttlMs);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

export function invalidate(key: string): void {
  store.delete(key);
}
