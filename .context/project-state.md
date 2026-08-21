# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

**Última atualização:** 21/08 — Backend Sprint 2: revisão de auth/movies (bugs corrigidos) + sessions/seats/reservations implementados.

## Fase atual

Descoberta e regras de desenvolvimento concluídas. Ecossistema de agentes definido. Todos os documentos-base gerados e atualizados (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`, `agent-instructions.md` de cada repo, `decisions-log.md`, agora até `D35`). Sprint 1 completo (workspace, Postgres de dev, schema/migration/seed/config/módulos vazios do backend). Sprint 2 (Core Backend) concluído: auth+guards revisado e corrigido, integração TMDb, sessões/assentos/reservas com concorrência de assento validada manualmente ponta a ponta (ver seção Backend/Sprint 2). Falta: parte de frontend do Sprint 1 (esqueleto de rotas), CI (DevOps Agent), teste adversarial automatizado de concorrência (QA Agent), payments/tickets/gate (Sprint 4).

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

**Backend — porta fixa + README (tarefa avulsa pós-Sprint 1):**

- API sobe em `http://localhost:3333` (3000 reservada para o frontend); `PORT` default em `env.schema.ts` e `CORS_ORIGINS` default agora `http://localhost:3000`. `.env`/`.env.example` atualizados. Confirmado no log do Nest (`[Bootstrap] CineTicket API rodando em http://[::1]:3333`) e via `curl` em `pnpm dev` real.
- Swagger configurado em `src/main.ts` (`@nestjs/swagger`, novo), disponível em `http://localhost:3333/docs` — validado com `curl` (HTTP 200).
- `backend/README.md` criado: stack, como rodar isolado, porta/Swagger, tabela de scripts, credenciais reais dos 4 usuários semeados (`senha123`), referência ao `CLAUDE.md` para estrutura de módulos.

**Backend — Sprint 2 (auth/movies revisados + sessions/seats/reservations novos):**

Revisão de `auth/` e `movies/` (código escrito manualmente antes desta sessão, não presumido correto — revisado e corrigido antes de continuar). Bugs reais encontrados e corrigidos, validados rodando a aplicação de ponta a ponta (não só lint/tsc):

- `JwtModule.registerAsync` sem `inject: [AppConfigService]` — `useFactory` rodava sem argumento, `config` chegava `undefined`, app **crashava no bootstrap**. Confirmado subindo o Nest antes/depois da correção.
- `sanitizeUser` em `auth.service.ts` só removia `password`, deixando `refreshTokenHash` vazar em `/auth/login` — violação direta da regra não-negociável de campo sensível.
- `MoviesModule` com `controllers: []`/`exports: []` — a rota `/movies/search` não existia de fato e `MoviesService` não estava disponível para outros módulos (bloqueava o `SessionsModule` novo).
- Interfaces `TmdbMovieSummary`/`TmdbMovieDetails` não exportadas de `tmdb.service.ts` — build quebrava (`TS4053`) ao inferir tipo de retorno entre arquivos.
- `findOrCacheMovie` sem tratamento de corrida no `create()` — duas chamadas concorrentes para o mesmo `tmdbId` colidiam sem captura de erro; agora recupera via `P2002`.
- Dependência quebrada `"jwt": "link:@nestjs/@nestjs/jwt"` removida de `package.json` (link inválido, não usada, não estava nem no lockfile).
- `tsconfig.json`: `paths` de `@cineticket/shared` apontava pro **source** do pacote (`packages/shared/src`), violando `rootDir` assim que algo em `backend/src` importasse de lá pra valer (primeira vez que aconteceu, com o `SessionsModule` novo). Corrigido para resolver via `node_modules`/`dist` (build normal do workspace).

Commit único (`feat`, sem separar em dois porque os arquivos nunca tinham sido commitados antes — não dava pra isolar "original" de "correção" via `git add -p` com segurança sem reescrever conteúdo no disco).

Módulos novos — `sessions/`, `seats/`, `reservations/` (Sprint 2 core, concorrência de assento):

- **Sessions**: `GET /sessions` e `GET /sessions/:id` públicos, sem guard (D32). `POST /sessions` e `PATCH /sessions/:id` atrás de `@Roles('ORGANIZER')`; edição verifica `organizerId === usuário autenticado` no service (`ForbiddenException` senão, D10). Criação chama `MoviesService.findOrCacheMovie` **antes** de abrir `prisma.$transaction`, depois cria `Session` + `Seat[]` atomicamente dentro da transação. Layout de assento derivado só de `capacity` (não há input de linha/coluna no DTO): `SEATS_PER_ROW = 10` (`src/constants/seat.constants.ts`), linhas A, B, C... preenchidas em sequência.
- **Seats**: `GET /sessions/:sessionId/seats` público, sem guard (D32). Status por assento calculado a partir de `Reservation` ativa (`PENDING`/`PAID`) via `include` — `AVAILABLE` se não houver nenhuma.
- **Reservations**: `POST /reservations` atrás de `@Roles('CUSTOMER')` (D32 — só a confirmação exige login, não a navegação/seleção). `sessionId`/`seatId` validados por existência antes da tentativa (404 claro em vez de erro de FK cru). `expiresAt = now + 5min` (`RESERVATION_TTL_MINUTES`, `src/constants/reservation.constants.ts`, D05). Criação dentro de `prisma.$transaction`; `P2002` da constraint UNIQUE parcial (`sessionId`, `seatId` WHERE status ativo, já criada no Sprint 1) vira `ConflictException("Assento já reservado")`.
- **Expiração de reserva PENDING — decisão de implementação (verificação LAZY, não job/cron)**: a constraint UNIQUE parcial só cobre `status IN ('PENDING','PAID')`, então uma linha `PENDING` vencida continua bloqueando o assento até algo virar seu `status` para `EXPIRED` — não basta filtrar na leitura. `ReservationsService.expireStalePendingForSession(sessionId)` faz esse `updateMany` e é chamado em dois pontos: (1) antes de montar o mapa de assentos (`SeatsService.getSeatMap`) e (2) antes de tentar criar uma reserva nova (`ReservationsService.create`), sempre escopado à sessão/assento em questão. Razão da escolha: sem `@nestjs/schedule`/worker separado, sem infraestrutura de job para testar, e o sweep dispara exatamente nos dois momentos em que a informação importa de verdade (ler disponibilidade, tentar reservar) — não deixa uma janela de N segundos como um cron fixo deixaria. Trade-off aceito: um assento só "aparece" livre de novo quando alguém de fato lê o mapa ou tenta reservar depois do vencimento; não há um processo em background liberando proativamente.
- Validação de entrada: `ZodValidationPipe` genérico novo (`src/common/pipes/zod-validation.pipe.ts`), aplicado com `createSessionSchema`/`updateSessionSchema`/`createReservationSchema` de `@cineticket/shared`. `updateSessionSchema` é schema novo em `packages/shared` (não altera `createSessionSchema`, que já é consumido) — `tmdbId`/`capacity` de propósito fora do update, mudar depois quebraria a correspondência `Session`↔`Seat[]` já gerada.

Validado manualmente rodando a API real contra o Postgres de dev (não só lint/build):

- Sessão criada via `POST /sessions` com `tmdbId` já cacheado no seed → 13 assentos gerados (10 na linha A, 3 na B), atômico com a sessão.
- `GET /sessions/:id/seats` sem token → 200 com todos `AVAILABLE`.
- **Concorrência real**: duas requisições `POST /reservations` disparadas em paralelo pro mesmo assento (dois clientes diferentes) → exatamente uma `201`, a outra `409 Conflict` com `"Assento já reservado"`. Critério de pronto da tarefa confirmado batendo na API de verdade, não só lido no código.
- Expiração: forçado `expiresAt` no passado direto no banco → `GET .../seats` seguinte já mostra `AVAILABLE` (sweep lazy rodou), nova reserva no mesmo assento por outro cliente → `201`; linha antiga fica `EXPIRED` no banco (não colide com a nova, confirma o índice parcial funcionando com múltiplas linhas `EXPIRED`/ativa coexistindo).
- `@Roles` funcionando: organizador tentando `POST /reservations` → `403`; sem token → `401`.
- `PATCH /sessions/:id` pelo dono → `200`; campo fora do schema (`capacity`) enviado no body → silenciosamente descartado pelo Zod (`updateSessionSchema` não tem esse campo), sessão não muda.

### Ambiguidades resolvidas sem travar a tarefa (Backend, Sprint 2)

1. `GET /sessions` retorna todas as sessões, sem filtrar por `published` — a tarefa só pediu "leitura sem filtro de organizerId" (D10), não mencionou rascunho vs. publicada, e não quis inventar regra de produto não pedida. Pode valer revisar com o Arquiteto: sessão não publicada aparecendo pra visitante talvez não seja o desejado.
2. Layout de assento (linhas/colunas) a partir só de `capacity`: decisão de implementação minha (`SEATS_PER_ROW = 10`), já que `createSessionSchema` não tem input de linha/coluna. Reversível/ajustável sem migration.
3. `/auth/login` continua sem `ZodValidationPipe` (violação de project-rules.md §5, "Validação Zod obrigatória em toda entrada") — pré-existente, fora do checklist explícito da revisão de auth desta sessão, não corrigido para não expandir escopo sem pedido. Sinalizado aqui para follow-up.
4. D35 (retry com backoff na conexão inicial do Prisma) ainda **não implementado** — `PrismaService.onModuleInit()` continua com `$connect()` direto, sem retry. Fora do escopo desta tarefa (não é módulo de domínio), mas é risco real de crash-loop em deploy (Railway) já registrado em D35/decisions-log.

### Decisões e riscos que surgiram durante a implementação (Backend, Sprint 1)

1. **Constraint UNIQUE de `(sessionId, seatId)` implementada como índice único PARCIAL, não como `@@unique` simples no Prisma DSL.** Um `@@unique([sessionId, seatId])` comum bloquearia permanentemente a reabertura do assento após `EXPIRED`/`CANCELLED` (quebra o teste obrigatório de expiração, project-rules.md §6.3). Um `@@unique([sessionId, seatId, status])` também é incorreto: duas reservas diferentes que ambas terminam `EXPIRED` para o mesmo assento colidiriam no valor repetido do status. Prisma não suporta índice único com cláusula `WHERE` na DSL do `schema.prisma`, então a constraint real (`WHERE status IN ('PENDING','PAID')`) foi adicionada via SQL bruto na migration `20260819033158_init` (edição manual do `migration.sql`), documentada com comentário extenso no `schema.prisma` acima do model `Reservation`. Validado manualmente via `\d "Reservation"` no psql — índice `reservation_active_seat_unique` presente e com a cláusula `WHERE` correta. **Recomendo ao QA Agent testar explicitamente**: (a) duas reservas concorrentes para o mesmo assento (deve falhar exatamente uma), (b) reservar → deixar expirar → reservar de novo com outro cliente → deixar expirar de novo (não deve colidir).
2. **`pnpm.onlyBuiltDependencies`** (`@prisma/client`, `@prisma/engines`, `bcrypt`, `prisma`) foi adicionado ao `package.json` raiz — necessário para os build scripts nativos rodarem sob pnpm 10 (que os bloqueia por padrão via prompt interativo); sem isso, `prisma generate`/`bcrypt` não funcionam em instalação não-interativa.
3. **Aviso de depreciação do Prisma:** `package.json#prisma` (usado para apontar `schema.prisma` para `src/prisma/`) está deprecado a partir do Prisma 7 em favor de `prisma.config.ts`. Não migrado agora (fora de escopo do Sprint 1); considerar na próxima atualização de versão do Prisma.
4. **`.prettierrc` da raiz (project-rules.md §3) ainda não existe** — fora do escopo desta tarefa (compartilhado entre backend/frontend). Código formatado manualmente seguindo a convenção documentada (aspas simples, ponto e vírgula, 2 espaços) até existir.
5. **`test/unit/` e `test/e2e/` ainda vazios** (só `.gitkeep`) — nenhum teste é esperado neste sprint; QA Agent inicia os testes adversariais (concorrência, ingresso duplicado, expiração) no Sprint 2, conforme `agent-ecosystem.md`.
6. **`D29` não encontrado em `decisions-log.md`** — a tarefa de ajuste de porta (3333) pediu para procurar essa decisão como referência, mas o log só vai até `D26`. Prosseguiu-se mesmo assim porque a própria tarefa já trazia a justificativa inline (3000 reservada para o frontend) e o trabalho é de baixo risco/reversível — mas o processo formal (`project-rules.md`: toda decisão nova deve ser registrada *antes* de virar instrução) não foi seguido desta vez. Sinalizado ao usuário; `D27`–`D29` continuam pendentes de registro por quem tiver escopo sobre `decisions-log.md`.
7. **TypeScript e Prisma mantidos abaixo do major mais recente, de propósito.** Usuário perguntou por que não estamos em TS 7 / Prisma 7 (os mais recentes publicados no momento: TS `7.0.2`, Prisma `7.9.1`). Confirmado e verificado (não é suposição): `typescript-eslint` declara `peerDependencies.typescript: '>=4.8.4 <6.1.0'` e `ts-jest` declara `typescript: '>=4.3 <7'` — ou seja, subir para TS 7 quebraria `lint`/`test` agora. Prisma 7 remove o suporte a `package.json#prisma` (só `prisma.config.ts`), exigindo migração de config logo depois de validarmos a migration + índice único parcial contra o banco real. Decisão do usuário: manter TS `^5.7.2`/Prisma `^6.0.0` por ora; upgrade fica para tarefa deliberada e isolada, não para o meio de um sprint de prazo apertado.
8. **`tsconfig.json` teve `"incremental": true` removido.** Um editor conectado à sessão (extensão "Console Ninja") modificou `tsconfig.json` nos bastidores e injetou `"ignoreDeprecations": "6.0"` (valor inválido para o TypeScript 5.9.3 instalado, quebrava a compilação com `TS5103`) — removido. Ao corrigir isso, ficou evidente um segundo problema, pré-existente desde o Sprint 1: `"incremental": true` no `tsconfig.json` combinado com `"deleteOutDir": true` no `nest-cli.json` fazia o cache incremental do TS (`tsconfig.build.tsbuildinfo`) achar que `dist/` ainda tinha os arquivos depois de o Nest CLI apagar a pasta, pulando a reemissão — `nest build` retornava sucesso (exit 0) sem gerar nenhum arquivo, e `pnpm dev` falhava com `Cannot find module '.../dist/main'`. Removido `incremental` do `tsconfig.json`; `pnpm dev`/`pnpm build` voltaram a funcionar de forma confiável. Vale conferir se esse padrão (`incremental` + `deleteOutDir`) não é reintroduzido no futuro.

## Pendente (ordem de sprint, ver `agent-ecosystem.md`)

- [x] Sprint 1 (infra) — Workspace root do monorepo (`pnpm-workspace.yaml` + `package.json` raiz).
- [x] Sprint 1 (infra) — Esqueleto de `backend/`, `frontend/` e `packages/shared/` reconhecido pelo pnpm (sem código de aplicação).
- [x] Sprint 1 (infra) — Postgres de dev containerizado (`docker-compose.yml`) e `backend/.env.example` com `DATABASE_URL` de referência.
- [x] Sprint 1 — Backend: schema Prisma completo, migration inicial, seed idempotente, config Zod, 9 módulos vazios, `packages/shared` com `userSchema`/`createSessionSchema`/`createReservationSchema`.
- [ ] Sprint 1 — `docker-compose.test.yml`, esqueleto CI (DevOps), esqueleto de rotas frontend (Frontend Agent).
- [x] Sprint 2 — Core Backend: auth+guards (revisado e com bugs corrigidos), integração TMDb, sessões (com geração atômica de assentos), assentos (mapa com status), reservas com constraint de concorrência aplicada dentro de `prisma.$transaction` — validado manualmente com requisições concorrentes reais (ver seção Backend/Sprint 2 acima). Falta: QA Agent formalizar isso como teste automatizado (`test/e2e`), payments/tickets/gate (fora do escopo desta tarefa).
- [ ] Sprint 3 — Core Frontend + Realtime: consumo de sessões/assentos, WebSocket Gateway, mapa em tempo real. **Marco dia 5: decisão WebSocket vs. polling.**
- [ ] Sprint 4 — Fluxo completo: pagamento simulado, ingresso (JWT+QR), portaria com todos os retornos.
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed de dados, revisão contra critérios de avaliação.

## Riscos abertos

1. **WebSocket** — maior risco técnico assumido conscientemente. Sem fallback implementado ainda; se Sprint 3 não estabilizar até dia 5, decisão de queda para polling precisa ser tomada explicitamente pelo Arquiteto, registrada em `decisions-log.md`.
2. **Concorrência de assento** — regra central do projeto. Constraint UNIQUE parcial em `(sessionId, seatId)` implementada no banco (Sprint 1) e criação de reserva dentro de `prisma.$transaction` implementada (Sprint 2, ver seção Backend/Sprint 2 acima) — validado manualmente com duas requisições HTTP concorrentes reais (uma `201`, outra `409`). Falta ainda: teste adversarial **automatizado** em `test/e2e` (QA Agent) — a validação de hoje foi manual, não fica travada em CI.
3. **Deploy Railway com WebSocket** — não validado ainda que o plano gratuito do Railway sustenta conexão persistente sem interrupção; verificar cedo (Sprint 1 ou início do Sprint 3), não deixar para o Sprint 5.

## Decisões pendentes de revisão futura

1. ~~Backfill de `D27`–`D29`~~ — resolvido: Arquiteto atualizou `decisions-log.md` até `D35` durante o Sprint 2.
2. Upgrade para TypeScript 7 / Prisma 7 — adiado deliberadamente (ver item 7 da seção Backend/Sprint 1 acima). Revisitar perto do fim do projeto ou se algum bug específico exigir.
3. `/auth/login` sem `ZodValidationPipe` (ver "Ambiguidades resolvidas", Backend/Sprint 2, item 3) — violação de project-rules.md §5, não corrigida por estar fora do checklist explícito da revisão desta sessão.
4. D35 (retry com backoff na conexão inicial do Prisma) ainda não implementado (ver item 4 da mesma seção) — risco de crash-loop em deploy.
