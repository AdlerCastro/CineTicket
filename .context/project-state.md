# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

**Última atualização:** 19/08 — Sprint 1 (Fundação), parte Backend concluída pelo Backend Agent.

## Fase atual

Descoberta e regras de desenvolvimento concluídas. Ecossistema de agentes definido. Todos os documentos-base gerados e atualizados (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`, `agent-instructions.md` de cada repo, `decisions-log.md`). Sprint 1: fundação do workspace pnpm completa, Postgres de dev containerizado, e agora a parte de backend do Sprint 1 (schema Prisma, migration, seed, config, módulos, schemas Zod) também concluída. Falta a parte de frontend do Sprint 1 (esqueleto de rotas) e o CI (`.github/workflows`, DevOps Agent).

## Funcional

- **Workspace root do monorepo**: `pnpm-workspace.yaml` (registra `backend`, `frontend`, `packages/*`) e `package.json` raiz mínimo (`cineticket`, `private: true`, scripts delegando para `pnpm -r`) criados.
- **Esqueleto de workspace completo**: `packages/shared/package.json` (`@cineticket/shared`, `main`/`types` apontando para `dist/`) + `tsconfig.json`; `backend/package.json` (`@cineticket/backend`) e `frontend/package.json` (`@cineticket/frontend`) mínimos, só com scripts placeholder (`dev`/`build`/`lint`/`test`), sem dependências reais nem código-fonte (`src/` de cada um vazio ou inexistente).
  - `pnpm -r list` na raiz confirma os 4 workspace projects: `cineticket` (root), `@cineticket/backend`, `@cineticket/frontend`, `@cineticket/shared`. Critério de pronto do esqueleto de infraestrutura fechado.
  - **Nenhum código de aplicação foi escrito** — Backend Agent e Frontend Agent podem começar a trabalhar (dependências reais, schema Prisma, schemas Zod, rotas Next.js) sem novo bloqueio de infraestrutura de workspace.

- **Postgres de dev containerizado**: `docker-compose.yml` na raiz sobe `postgres:16-alpine` (`cineticket-postgres-dev`), porta host `5434` (5433 já ocupado por outro cluster na máquina, evitado de propósito), volume nomeado `cineticket_pgdata_dev` para persistir dado entre restarts, healthcheck via `pg_isready`.
  - **DATABASE_URL de referência para os demais agentes**: `postgresql://cineticket:cineticket@localhost:5434/cineticket_dev` (credenciais de dev simples, não usar em produção). Documentada em `backend/.env.example`, junto de `JWT_ACCESS_SECRET`, `JWT_TICKET_SECRET`, `TMDB_API_KEY` como placeholders vazios.
  - Validado nesta sessão: `docker compose ps` mostra `Up ... (healthy)`; `docker exec ... pg_isready` confirma `accepting connections`; `psql -c "SELECT 1;"` executou com sucesso. Porta 5434 confirmada aberta no host.
  - `docker-compose.test.yml` (banco isolado para teste) **não foi criado** — fora do escopo desta tarefa, fica para tarefa separada do DevOps Agent.
  - Backend Agent está destravado para rodar `prisma migrate`/`prisma db push` contra este banco assim que o schema Prisma existir.

**Backend — Sprint 1 concluído:**

- Projeto NestJS + TypeScript inicializado em `backend/` (pnpm), com `nest-cli.json`, `tsconfig.json`/`tsconfig.build.json`, ESLint (flat config, `@typescript-eslint` + `eslint-config-prettier`), ligado ao workspace via `@cineticket/shared: workspace:*`.
- `src/prisma/schema.prisma` completo: `User` (role `ORGANIZER|CUSTOMER|GATE`), `Movie` (cache TMDb), `Session`, `Seat` (sem tipo/variação, D02), `Reservation` (status `PENDING|PAID|EXPIRED|CANCELLED`), `Ticket` (status `VALID|USED`).
- Migration inicial (`20260819033158_init`) aplicada com sucesso contra `cineticket_dev`.
- `src/prisma/seed.ts` idempotente, validado com duas execuções seguidas (`pnpm --filter backend exec ts-node src/prisma/seed.ts`) sem duplicar linhas: 1 organizador, 2 clientes, 1 portaria (todos com senha `senha123` em dev), 1 sessão publicada com 10 assentos (2 fileiras × 5).
- `src/config/` com validação de env via Zod (`env.schema.ts` + `AppConfigService` sobre `@nestjs/config`) — variáveis: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_TICKET_SECRET`, `TMDB_API_KEY`, `CORS_ORIGINS`, `PORT`, `NODE_ENV`. `.env.example` atualizado com todas as variáveis reais.
- 9 módulos NestJS vazios gerados (`nest g module`) em `src/modules/`: auth, users, movies, sessions, seats, reservations, payments, tickets, gateway — todos já importados em `app.module.ts`. Sem lógica ainda (Sprint 2).
- `packages/shared/src/schemas/`: `userSchema`, `createSessionSchema`, `createReservationSchema` (Zod), exportados via `src/index.ts`. `zod` adicionado como dependência do pacote (`packages/shared/package.json`, que já existia com scaffold vazio).
- `pnpm --filter backend lint|test|test:e2e|build` rodam sem erro (test/test:e2e ainda sem specs — `passWithNoTests: true`, esperado até o Sprint 2 trazer os testes adversariais de QA).

### Decisões e riscos que surgiram durante a implementação (Backend, Sprint 1)

1. **Constraint UNIQUE de `(sessionId, seatId)` implementada como índice único PARCIAL, não como `@@unique` simples no Prisma DSL.** Um `@@unique([sessionId, seatId])` comum bloquearia permanentemente a reabertura do assento após `EXPIRED`/`CANCELLED` (quebra o teste obrigatório de expiração, project-rules.md §6.3). Um `@@unique([sessionId, seatId, status])` também é incorreto: duas reservas diferentes que ambas terminam `EXPIRED` para o mesmo assento colidiriam no valor repetido do status. Prisma não suporta índice único com cláusula `WHERE` na DSL do `schema.prisma`, então a constraint real (`WHERE status IN ('PENDING','PAID')`) foi adicionada via SQL bruto na migration `20260819033158_init` (edição manual do `migration.sql`), documentada com comentário extenso no `schema.prisma` acima do model `Reservation`. Validado manualmente via `\d "Reservation"` no psql — índice `reservation_active_seat_unique` presente e com a cláusula `WHERE` correta. **Recomendo ao QA Agent testar explicitamente**: (a) duas reservas concorrentes para o mesmo assento (deve falhar exatamente uma), (b) reservar → deixar expirar → reservar de novo com outro cliente → deixar expirar de novo (não deve colidir).
2. **`pnpm.onlyBuiltDependencies`** (`@prisma/client`, `@prisma/engines`, `bcrypt`, `prisma`) foi adicionado ao `package.json` raiz — necessário para os build scripts nativos rodarem sob pnpm 10 (que os bloqueia por padrão via prompt interativo); sem isso, `prisma generate`/`bcrypt` não funcionam em instalação não-interativa.
3. **Aviso de depreciação do Prisma:** `package.json#prisma` (usado para apontar `schema.prisma` para `src/prisma/`) está deprecado a partir do Prisma 7 em favor de `prisma.config.ts`. Não migrado agora (fora de escopo do Sprint 1); considerar na próxima atualização de versão do Prisma.
4. **`.prettierrc` da raiz (project-rules.md §3) ainda não existe** — fora do escopo desta tarefa (compartilhado entre backend/frontend). Código formatado manualmente seguindo a convenção documentada (aspas simples, ponto e vírgula, 2 espaços) até existir.
5. **`test/unit/` e `test/e2e/` ainda vazios** (só `.gitkeep`) — nenhum teste é esperado neste sprint; QA Agent inicia os testes adversariais (concorrência, ingresso duplicado, expiração) no Sprint 2, conforme `agent-ecosystem.md`.

## Pendente (ordem de sprint, ver `agent-ecosystem.md`)

- [x] Sprint 1 (infra) — Workspace root do monorepo (`pnpm-workspace.yaml` + `package.json` raiz).
- [x] Sprint 1 (infra) — Esqueleto de `backend/`, `frontend/` e `packages/shared/` reconhecido pelo pnpm (sem código de aplicação).
- [x] Sprint 1 (infra) — Postgres de dev containerizado (`docker-compose.yml`) e `backend/.env.example` com `DATABASE_URL` de referência.
- [x] Sprint 1 — Backend: schema Prisma completo, migration inicial, seed idempotente, config Zod, 9 módulos vazios, `packages/shared` com `userSchema`/`createSessionSchema`/`createReservationSchema`.
- [ ] Sprint 1 — `docker-compose.test.yml`, esqueleto CI (DevOps), esqueleto de rotas frontend (Frontend Agent).
- [ ] Sprint 2 — Core Backend: auth+guards, integração TMDb, sessões, assentos com constraint de concorrência (schema/índice já prontos — falta a lógica de aplicação dentro de `prisma.$transaction`). QA inicia teste de concorrência em paralelo.
- [ ] Sprint 3 — Core Frontend + Realtime: consumo de sessões/assentos, WebSocket Gateway, mapa em tempo real. **Marco dia 5: decisão WebSocket vs. polling.**
- [ ] Sprint 4 — Fluxo completo: pagamento simulado, ingresso (JWT+QR), portaria com todos os retornos.
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed de dados, revisão contra critérios de avaliação.

## Riscos abertos

1. **WebSocket** — maior risco técnico assumido conscientemente. Sem fallback implementado ainda; se Sprint 3 não estabilizar até dia 5, decisão de queda para polling precisa ser tomada explicitamente pelo Arquiteto, registrada em `decisions-log.md`.
2. **Concorrência de assento** — regra central do projeto. Constraint UNIQUE parcial em `(sessionId, seatId)` já implementada no banco (ver decisão #1 da seção Backend/Sprint 1 acima) e validada manualmente via `\d`. Falta ainda: (a) a lógica de aplicação da criação de reserva dentro de `prisma.$transaction` (Sprint 2), e (b) o teste adversarial automatizado de concorrência real do QA Agent — até lá, a constraint de banco não foi provada sob carga concorrente de verdade, só inspecionada estaticamente.
3. **Deploy Railway com WebSocket** — não validado ainda que o plano gratuito do Railway sustenta conexão persistente sem interrupção; verificar cedo (Sprint 1 ou início do Sprint 3), não deixar para o Sprint 5.

## Decisões pendentes de revisão futura

Nenhuma no momento. Todas as decisões da entrevista estão fechadas — ver `decisions-log.md`.
