/**
 * BLOQUEADO por dependência de Sprint 4 — não implementado por este agente
 * (fora de escopo da tarefa de QA do Sprint 2).
 *
 * `src/modules/payments/payments.module.ts` e
 * `src/modules/tickets/tickets.module.ts` são módulos vazios
 * (`@Module({})`, sem controller/service/rota). Não existe endpoint real de
 * validação de portaria para exercitar (ex.: `POST /tickets/:code/validate`
 * com `@Roles('GATE')`).
 *
 * Por instrução explícita da tarefa, este teste não deve inventar um mock ou
 * endpoint fake que simule esse comportamento — um mock aqui daria falsa
 * confiança sem validar transação/concorrência reais que ainda nem existem.
 * Fica marcado como pendente (`.skip`) até o Sprint 4 implementar a rota.
 *
 * Quando a rota existir, este teste deve:
 *   1. Chegar a um Ticket com status VALID — via fluxo real de reserva
 *      PENDING -> pagamento simulado aprovado -> ticket gerado, ou, se
 *      payments ainda não estiver pronto, criar a Reservation (PAID) e o
 *      Ticket (VALID) direto via Prisma para isolar este teste da
 *      funcionalidade de pagamento (documentar a dependência na hora).
 *   2. POST na rota real de validação de portaria, autenticado como GATE
 *      (`@Roles('GATE')`, usuário semeado `portaria@cineticket.dev`) —
 *      esperar sucesso e o Ticket marcado USED no banco dentro de transação.
 *   3. Repetir a mesma validação com o mesmo código — esperar rejeição
 *      determinística (ex.: 409/422), nunca sucesso na segunda tentativa.
 */
describe.skip("Ingresso não reutilizável (validação de portaria) — BLOQUEADO (Sprint 4: payments/tickets/gate ainda não implementados)", () => {
  it("segunda validação do mesmo ticket é rejeitada de forma determinística", () => {
    // Pendente: endpoint de validação de portaria ainda não existe.
  });
});
