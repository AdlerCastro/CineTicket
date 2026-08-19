# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

**Última atualização:** 19/08 — Sprint 1: Postgres de dev containerizado e destravado para o Backend Agent.

## Fase atual

Descoberta e regras de desenvolvimento concluídas. Ecossistema de agentes definido. Todos os documentos-base gerados e atualizados (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`, `agent-instructions.md` de cada repo, `decisions-log.md`). Sprint 1 em andamento: fundação do workspace pnpm completa.

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

## Pendente (ordem de sprint, ver `agent-ecosystem.md`)

- [x] Sprint 1 (infra) — Workspace root do monorepo (`pnpm-workspace.yaml` + `package.json` raiz).
- [x] Sprint 1 (infra) — Esqueleto de `backend/`, `frontend/` e `packages/shared/` reconhecido pelo pnpm (sem código de aplicação).
- [x] Sprint 1 (infra) — Postgres de dev containerizado (`docker-compose.yml`) e `backend/.env.example` com `DATABASE_URL` de referência.
- [ ] Sprint 1 — Fundação: `docker-compose.test.yml`, esqueleto CI, schema Prisma completo, `packages/shared` com schemas Zod, esqueleto de rotas frontend.
- [ ] Sprint 2 — Core Backend: auth+guards, integração TMDb, sessões, assentos com constraint de concorrência. QA inicia teste de concorrência em paralelo.
- [ ] Sprint 3 — Core Frontend + Realtime: consumo de sessões/assentos, WebSocket Gateway, mapa em tempo real. **Marco dia 5: decisão WebSocket vs. polling.**
- [ ] Sprint 4 — Fluxo completo: pagamento simulado, ingresso (JWT+QR), portaria com todos os retornos.
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed de dados, revisão contra critérios de avaliação.

## Riscos abertos

1. **WebSocket** — maior risco técnico assumido conscientemente. Sem fallback implementado ainda; se Sprint 3 não estabilizar até dia 5, decisão de queda para polling precisa ser tomada explicitamente pelo Arquiteto, registrada em `decisions-log.md`.
2. **Concorrência de assento** — regra central do projeto. Constraint UNIQUE + transação ainda não implementadas; até lá, este é o maior risco de nota (funcionalidade central, com testes automatizados atrelados a ela).
3. **Deploy Railway com WebSocket** — não validado ainda que o plano gratuito do Railway sustenta conexão persistente sem interrupção; verificar cedo (Sprint 1 ou início do Sprint 3), não deixar para o Sprint 5.

## Decisões pendentes de revisão futura

Nenhuma no momento. Todas as decisões da entrevista estão fechadas — ver `decisions-log.md`.
