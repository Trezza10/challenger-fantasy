import { useCallback, useEffect, useState } from 'react';

interface ServiceDataState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface ServiceDataResult<T> extends ServiceDataState<T> {
  refetch: () => Promise<void>;
}

// Cache is scoped to the running app session; real services can later add persistence and expiry rules.
// A named key lets data survive a screen unmount/remount, where a callback gets a new identity.
const serviceCache = new Map<unknown, unknown>();

/** Clears account-scoped API data when the active Clerk user changes. */
export function clearServiceDataCache() {
  serviceCache.clear();
}

/**
 * Loads data from the active service provider and preserves it for the app session.
 * Refetching keeps already rendered data on screen while the current request is in flight.
 */
export function useServiceData<T>(loader: () => Promise<T>, cacheKey?: string): ServiceDataResult<T> {
  const key = cacheKey ?? loader;
  const cachedData = serviceCache.get(key) as T | undefined;
  const [state, setState] = useState<ServiceDataState<T>>({ data: cachedData ?? null, error: null, isLoading: cachedData === undefined });

  /** Retrieves fresh data, optionally bypassing the app-session cache. */
  const load = useCallback(async (forceRefresh = false) => {
    const cached = serviceCache.get(key) as T | undefined;
    if (!forceRefresh && cached !== undefined) {
      setState({ data: cached, error: null, isLoading: false });
      return;
    }

    setState((current) => ({ data: current.data, error: null, isLoading: true }));
    try {
      const data = await loader();
      serviceCache.set(key, data);
      setState({ data, error: null, isLoading: false });
    } catch (error) {
      setState((current) => ({ data: current.data, error: error as Error, isLoading: false }));
    }
  }, [key, loader]);

  useEffect(() => { void load(); }, [load]);

  /** Bypasses cached data for an explicit user-driven refresh. */
  const refetch = useCallback(() => load(true), [load]);

  return { ...state, refetch };
}
