import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSessionInput } from '@cineticket/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { sessionsKey } from '@/constants/query-keys';

// POST /sessions retorna o model Session cru do Prisma (sem `include: { movie: true }`
// — só GET /sessions e GET /sessions/:id incluem a relação, ver D44) — só o
// `id` importa aqui, para navegar direto pra tela de edição/publicação da
// sessão recém-criada.
interface CreatedSession {
  id: string;
}

export function useCreateSession() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionInput) =>
      apiClient.post<CreatedSession>('/sessions', data, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
  });
}
