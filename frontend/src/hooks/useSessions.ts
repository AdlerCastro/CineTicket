import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionsKey } from '@/constants/query-keys';
import type { Session } from '@/types/session';

// D40: GET /sessions não filtra published/dono — rascunhos aparecem aqui
// também, tratado na UI (badge "Rascunho" em SessionCard).
export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () => apiClient.get<Session[]>('/sessions'),
  });
}
