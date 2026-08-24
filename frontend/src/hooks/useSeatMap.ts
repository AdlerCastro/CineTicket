import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionSeatsKey } from '@/constants/query-keys';
import type { SeatMapItem } from '@/types/seat';

export function useSeatMap(sessionId: string) {
  return useQuery({
    queryKey: sessionSeatsKey(sessionId),
    queryFn: () => apiClient.get<SeatMapItem[]>(`/sessions/${sessionId}/seats`),
    enabled: Boolean(sessionId),
  });
}
