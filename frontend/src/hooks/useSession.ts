import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionKey } from '@/constants/query-keys';
import type { Session } from '@/types/session';

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () => apiClient.get<Session>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
}
