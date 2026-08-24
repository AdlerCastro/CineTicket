'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { SeatMapItem } from '@/types/seat';

interface SeatMapProps {
  seats: SeatMapItem[];
  selectedSeatId: string | null;
  highlightSeatId?: string | null;
  disabled?: boolean;
  onSelectSeat: (seat: SeatMapItem) => void;
}

function groupByRow(seats: SeatMapItem[]): [string, SeatMapItem[]][] {
  const rows = new Map<string, SeatMapItem[]>();
  for (const seat of seats) {
    const existing = rows.get(seat.row) ?? [];
    existing.push(seat);
    rows.set(seat.row, existing);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, rowSeats]) => [
      row,
      rowSeats.sort((a, b) => a.number - b.number),
    ]);
}

export function SeatMap({
  seats,
  selectedSeatId,
  highlightSeatId,
  disabled,
  onSelectSeat,
}: SeatMapProps) {
  const rows = useMemo(() => groupByRow(seats), [seats]);

  return (
    <div className='space-y-2'>
      {rows.map(([row, rowSeats]) => (
        <div key={row} className='flex items-center gap-2'>
          <span className='w-6 shrink-0 text-sm font-medium text-muted-foreground'>
            {row}
          </span>
          <div className='flex flex-wrap gap-2'>
            {rowSeats.map((seat) => {
              const isSelected = seat.id === selectedSeatId;
              const isMine = seat.id === highlightSeatId;
              const isAvailable = seat.status === 'AVAILABLE';

              return (
                <button
                  key={seat.id}
                  type='button'
                  disabled={disabled || (!isAvailable && !isMine)}
                  onClick={() => onSelectSeat(seat)}
                  title={`${row}${seat.number} — ${seat.status}`}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors',
                    isAvailable &&
                      !isSelected &&
                      'border-input bg-background hover:border-primary',
                    isSelected &&
                      'border-primary bg-primary text-primary-foreground',
                    seat.status === 'PENDING' &&
                      !isMine &&
                      'cursor-not-allowed border-transparent bg-secondary text-secondary-foreground opacity-70',
                    seat.status === 'PAID' &&
                      !isMine &&
                      'cursor-not-allowed border-transparent bg-muted text-muted-foreground opacity-60',
                    isMine &&
                      'cursor-not-allowed border-primary bg-primary/20 text-primary ring-2 ring-primary',
                  )}
                >
                  {seat.number}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className='mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
        <LegendItem
          swatchClassName='border border-input bg-background'
          label='Disponível'
        />
        <LegendItem swatchClassName='bg-primary' label='Selecionado' />
        <LegendItem
          swatchClassName='bg-secondary opacity-70'
          label='Pendente'
        />
        <LegendItem swatchClassName='bg-muted opacity-60' label='Vendido' />
      </div>
    </div>
  );
}

function LegendItem({
  swatchClassName,
  label,
}: {
  swatchClassName: string;
  label: string;
}) {
  return (
    <span className='flex items-center gap-1.5'>
      <span className={cn('h-3 w-3 rounded-sm', swatchClassName)} />
      {label}
    </span>
  );
}
