import type { AuthenticatedUser } from '@/types/auth';

const STORAGE_KEY = 'cineticket.auth';

export interface StoredAuthSession {
  accessToken: string;
  user: AuthenticatedUser;
}

// D07: accessToken de vida curta (15min) sem endpoint de refresh implementado
// ainda no backend — persistido só em localStorage, nunca em cookie (o
// refreshToken httpOnly já cobre a única persistência sensível de longa vida).
export function loadAuthSession(): StoredAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthSession) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
