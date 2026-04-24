import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useSyncQueue: Manages offline write queue with automatic retry
 * Stores mutations locally when offline, syncs when connectivity returns
 */
export function useSyncQueue() {
  const [queue, setQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const queueRef = useRef([]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToQueue = useCallback((item) => {
    const queueItem = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ...item,
    };

    queueRef.current = [...queueRef.current, queueItem];
    setQueue([...queueRef.current]);

    // Save to localStorage for persistence
    try {
      localStorage.setItem('syncQueue', JSON.stringify(queueRef.current));
    } catch (e) {
      console.warn('Failed to persist sync queue:', e);
    }

    return queueItem.id;
  }, []);

  const updateQueueItem = useCallback((id, updates) => {
    queueRef.current = queueRef.current.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    setQueue([...queueRef.current]);

    try {
      localStorage.setItem('syncQueue', JSON.stringify(queueRef.current));
    } catch (e) {
      console.warn('Failed to persist sync queue:', e);
    }
  }, []);

  const removeFromQueue = useCallback((id) => {
    queueRef.current = queueRef.current.filter(item => item.id !== id);
    setQueue([...queueRef.current]);

    try {
      localStorage.setItem('syncQueue', JSON.stringify(queueRef.current));
    } catch (e) {
      console.warn('Failed to persist sync queue:', e);
    }
  }, []);

  const processSyncQueue = useCallback(async () => {
    if (!isOnline || syncing || queueRef.current.length === 0) return;

    setSyncing(true);
    const pendingItems = queueRef.current.filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        updateQueueItem(item.id, { status: 'syncing' });

        // Call the sync function provided in the item
        if (item.syncFn) {
          await item.syncFn();
          removeFromQueue(item.id);
        }
      } catch (error) {
        const retries = item.retries || 0;
        if (retries < 3) {
          updateQueueItem(item.id, { 
            retries: retries + 1,
            status: 'pending',
            error: error.message 
          });
        } else {
          updateQueueItem(item.id, { 
            status: 'failed',
            error: error.message 
          });
        }
      }
    }

    setSyncing(false);
  }, [isOnline, syncing, updateQueueItem, removeFromQueue]);

  // Try to process queue periodically when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(processSyncQueue, 5000);
    return () => clearInterval(interval);
  }, [isOnline, processSyncQueue]);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('syncQueue');
      if (stored) {
        queueRef.current = JSON.parse(stored);
        setQueue([...queueRef.current]);
      }
    } catch (e) {
      console.warn('Failed to load sync queue:', e);
    }
  }, []);

  return {
    queue,
    isOnline,
    syncing,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    processSyncQueue,
  };
}

export default useSyncQueue;