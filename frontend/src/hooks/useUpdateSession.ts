import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateSessionInput } from '@cineticket/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { sessionsKey, sessionKey } from '@/constants/query-keys';

interface UpdatedSession {
  id: string;
}

// PATCH /sessions/:id (D10: guard de ownership no backend — 403 se não for o
// organizador dono, tratado explicitamente por quem consome esta mutation).
export function useUpdateSession(sessionId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSessionInput) =>
      apiClient.patch<UpdatedSession>(`/sessions/${sessionId}`, data, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey });
      queryClient.invalidateQueries({ queryKey: sessionKey(sessionId) });
    },
  });
}
