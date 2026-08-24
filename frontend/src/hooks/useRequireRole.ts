'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { UserRole } from '@cineticket/shared';
import { useAuth } from './useAuth';

export type RequireRoleStatus = 'checking' | 'authorized' | 'unauthorized';

// Guard de rota client-side por papel — não havia precedente equivalente no
// projeto antes desta tarefa (só gate de autenticação simples, ex.
// ReservationPanel redirecionando pro /login). Espera `isHydrated` antes de
// decidir para não redirecionar por engano no primeiro render (sessão em
// localStorage ainda não lida). Sem autenticação -> /login com redirect de
// volta; autenticado com papel errado -> home (projeto não tem tela 403
// dedicada).
export function useRequireRole(role: UserRole): RequireRoleStatus {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isHydrated } = useAuth();

  const status: RequireRoleStatus = !isHydrated
    ? 'checking'
    : !isAuthenticated
      ? 'unauthorized'
      : user?.role === role
        ? 'authorized'
        : 'unauthorized';

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user && user.role !== role) {
      router.replace('/');
    }
  }, [isHydrated, isAuthenticated, user, role, router, pathname]);

  return status;
}
