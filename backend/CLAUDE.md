# agent-instructions.md — Backend (CineTicket)

> Leia este arquivo por completo antes de iniciar qualquer tarefa neste repositório. Se uma instrução do prompt da tarefa conflitar com este arquivo, este arquivo prevalece — reporte o conflito em vez de decidir sozinho.

## Contexto do projeto

CineTicket: plataforma de venda de ingressos de cinema. Este repositório (`backend/`) é responsável por auth, integração TMDb, sessões, assentos, reservas, pagamento simulado, ingressos e validação de portaria. Consulte `/project-description.md` e `/.context/project-state.md` (raiz do monorepo) para o estado atual antes de começar.

## Stack deste repositório

NestJS + TypeScript + PostgreSQL + Prisma ORM + JWT + Zod. Gerenciador de pacote: **pnpm** (nunca npm/yarn).

## Estrutura obrigatória

```
backend/src/modules/{auth,users,movies,sessions,seats,reservations,payments,tickets,gateway}/
backend/src/common/{guards,decorators,filters,interceptors,pipes}/
backend/src/config/
backend/src/prisma/
backend/test/{unit,e2e}/
```

Nunca criar arquivo em `src/` fora de um módulo. Funcionalidade sem módulo correspondente = criar módulo novo, não jogar em pasta genérica.

## Convenções deste repositório

- Arquivos: `kebab-case.tipo.ts` (`reservations.service.ts`, `create-reservation.dto.ts`).
- DTOs de entrada devem ter par 1:1 com schema Zod em `packages/shared` — mesmo nome semântico.
- Sem `any` sem justificativa em comentário.
- Toda rota autenticada usa `@Roles(...)` guard — nunca checagem de papel manual no controller/service.

## Regras não-negociáveis deste repositório

1. **Concorrência de assento**: constraint `UNIQUE` no schema Prisma em `(sessionId, seatId)` para reservas ativas + toda criação de reserva dentro de `prisma.$transaction`. Isso é testado adversarialmente pelo QA Agent — não pode falhar.
2. **Ingresso não reutilizável**: validação de portaria marca `USED` dentro de transação; segunda validação do mesmo código é rejeitada de forma determinística.
3. **Reserva expira em 5 minutos** em estado `PENDING`.
4. **Nenhum campo sensível em response**: `password`, `refreshTokenHash` nunca saem de um endpoint — usar `@Exclude()` (class-transformer) ou `select` explícito no Prisma.
5. **JWT do ingresso** usa secret próprio (`JWT_TICKET_SECRET`), diferente do secret de auth de usuário (`JWT_ACCESS_SECRET`).
6. **CORS** restrito a origens conhecidas — nunca `*` fora de ambiente de dev local.
7. **Git**: nunca execute `git push`, abra PR ou faça merge — isso é feito manualmente pelo desenvolvedor. Você pode criar commits locais, mas nunca inclua trailer de co-autoria de IA (ex: `Co-Authored-By: Claude`) na mensagem de commit.

## O que você PODE tocar

- Tudo dentro de `backend/src/`, `backend/test/`, `backend/prisma/`.
- `packages/shared/src/schemas/` — mas só ao criar um DTO novo que precisa de schema Zod correspondente; não altere schema já consumido pelo frontend sem registrar em `.context/decisions-log.md`.

## O que você NÃO PODE tocar

- Nada em `frontend/`.
- `docker-compose.yml`, `.github/workflows/` — isso é do DevOps Agent. Se sua tarefa depende de mudança de infra, reporte, não implemente.

## Comandos de validação (rodar antes de considerar tarefa concluída)

```bash
pnpm --filter backend lint
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter backend build
```

## Ao finalizar uma tarefa

Atualize `.context/project-state.md` com o que passou a funcionar e qualquer risco/decisão pendente. Não deixe essa atualização para outro agente.
