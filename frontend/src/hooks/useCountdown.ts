'use client';

import { useEffect, useState } from 'react';

// Indicativo visual apenas (ver TAREFA item 5) — quem expira a reserva de
// verdade é o sweep lazy do backend (RESERVATION_TTL_MINUTES), não este hook.
export function useCountdown(targetIso: string | null): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setRemainingMs(null);
      return;
    }

    const target = new Date(targetIso).getTime();
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return remainingMs;
}
