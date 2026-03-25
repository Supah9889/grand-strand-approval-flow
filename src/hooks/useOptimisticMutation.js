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
 *   - onSuccess: Callback after successful mutation
 *   - onError: Callback after failed mutation
 */
export function useOptimisticMutation({
  mutationFn,
  queryKey,
  optimisticUpdate,
  rollback,
  onSuccess,
  onError,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      // Save previous data for rollback
      const previousData = queryClient.getQueryData(queryKey);

      // Apply optimistic update immediately
      if (optimisticUpdate) {
        queryClient.setQueryData(queryKey, optimisticUpdate(previousData, variables));
      }

      try {
        const result = await mutationFn(variables);
        
        // Invalidate and refetch to sync with server
        queryClient.invalidateQueries({ queryKey });
        
        return result;
      } catch (error) {
        // Rollback on error
        if (rollback) {
          queryClient.setQueryData(queryKey, rollback(previousData));
        } else {
          queryClient.setQueryData(queryKey, previousData);
        }
        throw error;
      }
    },
    onSuccess,
    onError,
  });
}