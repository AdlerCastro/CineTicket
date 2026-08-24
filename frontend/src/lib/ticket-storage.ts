const STORAGE_KEY = 'cineticket.lastTicketId';

// TAREFA 2 (Sprint 4): não existe endpoint de listagem de ingressos
// (GET /tickets/mine ou equivalente) — navegação até um ticket específico é
// via rota (/my-tickets/[ticketId], redirecionamento direto pós-pagamento)
// OU, pra quem volta depois em /my-tickets sem esse redirect recente
// (fechou a aba, voltou no dia seguinte), guardando o último ticketId aqui.
// Mesmo padrão de src/lib/auth-storage.ts — sem SSR (guard typeof window).
export function saveLastTicketId(ticketId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, ticketId);
}

export function loadLastTicketId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}
