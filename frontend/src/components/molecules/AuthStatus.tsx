'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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

  return (
    <div className='flex min-w-0 items-center gap-2 text-sm sm:gap-3'>
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
