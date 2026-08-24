'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@cineticket/shared';

// D52: 1-2 ações do papel logado no header persistente — GATE não ganha
// ação extra (já tem tudo que precisa na própria tela de portaria).
const ROLE_ACTION: Partial<Record<UserRole, { href: string; label: string }>> =
  {
    CUSTOMER: { href: '/my-tickets', label: 'Meus Ingressos' },
    ORGANIZER: { href: '/dashboard', label: 'Painel' },
  };

export function AuthStatus() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Link
        href='/login'
        className='text-sm font-medium text-primary underline-offset-4 hover:underline'
      >
        Entrar
      </Link>
    );
  }

  const roleAction = ROLE_ACTION[user.role];

  return (
    <div className='flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm sm:gap-x-3'>
      {roleAction && (
        <Link
          href={roleAction.href}
          className='shrink-0 font-medium text-primary underline-offset-4 hover:underline'
        >
          {roleAction.label}
        </Link>
      )}
      <span className='max-w-[6rem] truncate text-muted-foreground sm:max-w-none'>
        {user.name}
      </span>
      <Button
        variant='ghost'
        size='sm'
        onClick={logout}
        className='shrink-0 px-2 sm:px-3'
      >
        Sair
      </Button>
    </div>
  );
}
