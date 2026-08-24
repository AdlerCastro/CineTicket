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
    <div className='flex items-center gap-3 text-sm'>
      <span className='text-muted-foreground'>{user.name}</span>
      <Button variant='ghost' size='sm' onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
