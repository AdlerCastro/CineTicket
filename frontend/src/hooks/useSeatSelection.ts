'use client';

import { useCallback, useState } from 'react';

// D12/D32: seleção de assento é estado local puro, sem Zustand — nenhuma
// Reservation existe no banco até a confirmação (ver ReservationPanel).
export function useSeatSelection() {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  const toggleSeat = useCallback((seatId: string) => {
    setSelectedSeatId((current) => (current === seatId ? null : seatId));
  }, []);

  const clearSelection = useCallback(() => setSelectedSeatId(null), []);

  return { selectedSeatId, toggleSeat, clearSelection };
}
