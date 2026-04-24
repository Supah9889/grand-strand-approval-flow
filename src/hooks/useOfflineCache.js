import { useEffect, useState, useCallback } from 'react';

/**
 * useOfflineCache: Caches entity data locally for offline access
 * Automatically syncs to IndexedDB when data arrives
 * Falls back to cached data when network is unavailable
 */
export function useOfflineCache(queryKey, data, enabled = true) {
  const cacheKey = `cache_${Array.isArray(queryKey) ? queryKey.join('_') : queryKey}`;
  const [cachedData, setCachedData] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save to localStorage when data arrives
  useEffect(() => {
    if (!enabled || !data) return;

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
      setLastUpdated(new Date());
    } catch (e) {
      console.warn(`Failed to cache ${cacheKey}:`, e);
    }
  }, [data, cacheKey, enabled]);

  // Load from cache on mount or when offline
  useEffect(() => {
    if (!enabled) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data: cachedData } = JSON.parse(cached);
        setCachedData(cachedData);
      }
    } catch (e) {
      console.warn(`Failed to load cache ${cacheKey}:`, e);
    }
  }, [cacheKey, enabled]);

  // Return live data if online and available, otherwise return cache
  const displayData = data || cachedData;

  return {
    data: displayData,
    isCached: !data && !!cachedData,
    isOnline,
    lastUpdated,
    clearCache: useCallback(() => {
      try {
        localStorage.removeItem(cacheKey);
        setCachedData(null);
        setLastUpdated(null);
      } catch (e) {
        console.warn(`Failed to clear cache ${cacheKey}:`, e);
      }
    }, [cacheKey]),
  };
}

export default useOfflineCache;