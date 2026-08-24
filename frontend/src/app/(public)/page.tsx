'use client';

import { useMemo, useState } from 'react';
import { useSessions } from '@/hooks/useSessions';
import { SessionCard } from '@/components/organisms/SessionCard';
import { SearchBar } from '@/components/molecules/SearchBar';

export default function HomePage() {
  const { data: sessions, isLoading, isError } = useSessions();
  const [query, setQuery] = useState('');

  // D57 (continuação): useSessions agora envia Authorization quando o
  // usuário está logado, então a resposta pode incluir o próprio rascunho do
  // organizador (mesma regra que faz o painel funcionar, D50). A home
  // pública não deve misturar rascunho nenhum, nem do dono logado — filtro
  // explícito aqui, não depende do que o backend decidiu incluir.
  const publishedSessions = useMemo(
    () => sessions?.filter((session) => session.published) ?? [],
    [sessions],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return publishedSessions;
    return publishedSessions.filter((session) =>
      session.room.toLowerCase().includes(normalized),
    );
  }, [publishedSessions, query]);

  return (
    <div>
      <h1 className='font-display text-3xl font-bold'>Em cartaz</h1>
      <p className='mt-2 text-muted-foreground'>
        Escolha uma sessão para ver o mapa de assentos em tempo real.
      </p>

      <div className='mt-6 max-w-sm'>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder='Buscar por sala...'
        />
      </div>

      {isLoading && (
        <p className='mt-8 text-muted-foreground'>Carregando sessões...</p>
      )}
      {isError && (
        <p className='mt-8 text-destructive'>
          Não foi possível carregar as sessões.
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <p className='mt-8 text-muted-foreground'>Nenhuma sessão encontrada.</p>
      )}

      <div className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filtered.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
