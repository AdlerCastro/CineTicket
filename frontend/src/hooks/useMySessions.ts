import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessions } from '@/hooks/useSessions';

// D10: GET /sessions é leitura pública, sem filtro server-side por dono —
// o painel do organizador filtra client-side por organizerId === user.id.
export function useMySessions() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useSessions();

  const sessions = useMemo(
    () => data?.filter((session) => session.organizerId === user?.id) ?? [],
    [data, user?.id],
  );

  return { sessions, isLoading, isError, refetch };
}
