import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Hook for mutations with optimistic UI updates
 * Immediately updates the UI before the API responds
 * 
 * @param {Function} mutationFn - Async function to call API
 * @param {Object} options - Configuration
 *   - queryKey: Array identifying the query to update
 *   - optimisticUpdate: Function that updates cache before API call
 *   - rollback: Function to restore cache if API fails
 *   - linkedQueryKeys: Optional array of queryKeys to also update (for parent/rollup records)
 *   - linkedOptimisticUpdate: Function to update linked records
 *   - linkedRollback: Function to rollback linked records
 *   - onSuccess: Callback after successful mutation
 *   - onError: Callback after failed mutation
 */
export function useOptimisticMutation({
  mutationFn,
  queryKey,
  optimisticUpdate,
  rollback,
  linkedQueryKeys = [],
  linkedOptimisticUpdate,
  linkedRollback,
  onSuccess,
  onError,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      // Save previous data for rollback
      const previousData = queryClient.getQueryData(queryKey);
      const previousLinkedData = {};

      linkedQueryKeys.forEach(key => {
        previousLinkedData[JSON.stringify(key)] = queryClient.getQueryData(key);
      });

      // Apply optimistic update immediately
      if (optimisticUpdate) {
        queryClient.setQueryData(queryKey, optimisticUpdate(previousData, variables));
      }

      // Apply optimistic updates to linked records
      if (linkedOptimisticUpdate && linkedQueryKeys.length > 0) {
        linkedQueryKeys.forEach(key => {
          const linkedData = queryClient.getQueryData(key);
          queryClient.setQueryData(key, linkedOptimisticUpdate(linkedData, variables));
        });
      }

      try {
        const result = await mutationFn(variables);
        
        // Invalidate and refetch to sync with server
        queryClient.invalidateQueries({ queryKey });
        linkedQueryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
        
        return result;
      } catch (error) {
        // Rollback on error
        if (rollback) {
          queryClient.setQueryData(queryKey, rollback(previousData));
        } else {
          queryClient.setQueryData(queryKey, previousData);
        }

        // Rollback linked records
        linkedQueryKeys.forEach(key => {
          const keyStr = JSON.stringify(key);
          if (linkedRollback) {
            queryClient.setQueryData(key, linkedRollback(previousLinkedData[keyStr]));
          } else {
            queryClient.setQueryData(key, previousLinkedData[keyStr]);
          }
        });

        throw error;
      }
    },
    onSuccess,
    onError,
  });
}