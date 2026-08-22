# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

**Última atualização:** 21/08 — QA Agent: testes e2e automatizados de concorrência de assento e expiração de reserva (banco de teste real, porta 5435), determinísticos em múltiplas execuções. Teste de ingresso duplicado documentado como bloqueado (Sprint 4). Consolida também Backend Sprint 2 (revisão de auth/movies + sessions/seats/reservations), Frontend Sprint 1, DevOps Sprint 1 e os dois Dockerfiles, que estavam registrados em `develop` separadamente da branch de Sprint 2.

## Fase atual

Descoberta e regras de desenvolvimento concluídas. Ecossistema de agentes definido. Todos os documentos-base gerados e atualizados (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`, `agent-instructions.md` de cada repo, `decisions-log.md`, até `D36`).

**Sprint 1 completo nas quatro frentes:** Backend (schema/migration/seed/config/9 módulos/schemas Zod compartilhados), Frontend (Next.js, tema customizado, dark mode, TanStack Query, esqueleto das 4 rotas de grupo), DevOps (`docker-compose.test.yml` + CI no GitHub Actions), mais tarefas avulsas pós-Sprint 1: `backend/Dockerfile` e `frontend/Dockerfile` (ambos validados localmente, build+run), integração ESLint+Prettier.

**Sprint 2 (Core Backend) concluído:** auth+guards revisado e corrigido, integração TMDb, sessões/assentos/reservas com concorrência de assento validada manualmente ponta a ponta (ver seção "Backend — Sprint 2" abaixo).

**Falta:** integração dos Dockerfiles no `docker-compose.yml`/deploy Railway (`context: .` já confirmado como requisito, ver seção Dockerfile), Frontend Sprint 2/3, payments/tickets/gate (Sprint 4) — incluindo o teste automatizado de ingresso duplicado, bloqueado até essa rota existir (ver seção "QA — Sprint 2" abaixo).

## Funcional

- **Workspace root do monorepo**: `pnpm-workspace.yaml` (registra `backend`, `frontend`, `packages/*`) e `package.json` raiz mínimo (`cineticket`, `private: true`, scripts delegando para `pnpm -r`) criados.
- **Esqueleto de workspace completo**: `packages/shared/package.json` (`@cineticket/shared`, `main`/`types` apontando para `dist/`) + `tsconfig.json`; `backend/package.json` (`@cineticket/backend`) e `frontend/package.json` (`@cineticket/frontend`) mínimos, só com scripts placeholder (`dev`/`build`/`lint`/`test`), sem dependências reais nem código-fonte.
  - `pnpm -r list` na raiz confirma os 4 workspace projects: `cineticket` (root), `@cineticket/backend`, `@cineticket/frontend`, `@cineticket/shared`.

- **Postgres de dev containerizado**: `docker-compose.yml` na raiz sobe `postgres:16-alpine` (`cineticket-postgres-dev`), porta host `5434` (5433 já ocupado por outro cluster na máquina), volume nomeado `cineticket_pgdata_dev`, healthcheck via `pg_isready`.
  - **DATABASE_URL de referência**: `postgresql://cineticket:cineticket@localhost:5434/cineticket_dev`, documentada em `backend/.env.example` junto de `JWT_ACCESS_SECRET`, `JWT_TICKET_SECRET`, `TMDB_API_KEY`.

**Backend — Sprint 1 concluído:**

- Projeto NestJS + TypeScript em `backend/` (pnpm), ligado ao workspace via `@cineticket/shared: workspace:*`.
- `src/prisma/schema.prisma` completo: `User` (role `ORGANIZER|CUSTOMER|GATE`), `Movie` (cache TMDb), `Session`, `Seat` (sem tipo/variação, D02), `Reservation` (status `PENDING|PAID|EXPIRED|CANCELLED`), `Ticket` (status `VALID|USED`).
- Migration inicial (`20260819033158_init`) aplicada. `seed.ts` idempotente: 1 organizador, 2 clientes, 1 portaria (senha `senha123`), 1 sessão com 10 assentos.
- `src/config/` com validação de env via Zod (`env.schema.ts` + `AppConfigService`).
- 9 módulos NestJS vazios gerados em `src/modules/`. `packages/shared/src/schemas/`: `userSchema`, `createSessionSchema`, `createReservationSchema`.
- `pnpm --filter backend lint|test|test:e2e|build` sem erro.

**Backend — porta fixa + README (pós-Sprint 1):**

- API em `http://localhost:3333` (3000 reservada ao frontend). Swagger em `/docs`. `backend/README.md` com credenciais reais dos 4 usuários semeados.

**Backend — `Dockerfile` (pós-Sprint 1):**

- `backend/Dockerfile` multistage, Node 20 Alpine, pnpm via corepack. **Contexto de build na raiz do monorepo** (`docker build -f backend/Dockerfile .`) — `@cineticket/shared` é `workspace:*`. Implicação para `docker-compose.yml`/Railway: `context: .` + `dockerfile: backend/Dockerfile`, nunca `context: ./backend`.
- Imagem final mantém `node_modules` real (Nest não faz bundling). `prisma generate` explícito no stage `builder`. `apk add openssl` nos stages `base`/`runner` (Prisma precisa de `libssl`).
- Validado: build sem erro; sem banco acessível, processo encerra com erro `P1001` antes de `app.listen()` (ver risco #5); com banco real, API sobe normalmente e `/docs` responde 200.

**Frontend — Sprint 1 concluído:**

- Next.js 14 (App Router) + TypeScript em `frontend/`, ligado ao workspace. Tailwind v3 + Shadcn com tema customizado ("Marquee") — nunca o default. Dark mode via classe + toggle, sem flash.
- Estrutura conforme D31: `components/{ui,molecules,organisms,templates}`, `app/{(public),(customer),(organizer),(gate)}`, `hooks/`, `constants/`, `enums/`, `types/`, `lib/`, `styles/`.
- TanStack Query configurado no layout raiz. RHF + Zod instalados, import de `@cineticket/shared` validado.
- `src/lib/api-client.ts` apontando para `NEXT_PUBLIC_API_URL` (default `localhost:3333`). 4 rotas de grupo respondendo 200: `/`, `/my-tickets`, `/dashboard`, `/check-in`.

**Frontend — `Dockerfile` (pós-Sprint 1):**

- Multistage, Node 20 Alpine. Mesmo requisito de contexto na raiz do monorepo. `next.config.mjs`: `output: 'standalone'` + `outputFileTracingRoot` na raiz (sem isso não enxerga `packages/shared`). `NEXT_PUBLIC_*` como `--build-arg` (embutidas em build-time, não runtime). Validado de ponta a ponta: build + container rodando, rotas e assets respondendo 200.
- Não validado ainda: valor real de `NEXT_PUBLIC_API_URL` no bundle (nenhuma página do Sprint 1 consome `apiClient` de verdade) — testar no Sprint 2/3.

**Integração ESLint + Prettier concluída:**

- `.prettierrc` da raiz criado (só existia documentado em `project-rules.md` §3). `eslint-config-prettier`/`eslint-plugin-prettier` integrados em `backend/`/`frontend/`. Violações pré-existentes corrigidas em commit `style` separado. Validado com teste negativo nos dois repos.

**DevOps — Sprint 1 concluído (`docker-compose.test.yml` + CI):**

- `docker-compose.test.yml`: Postgres isolado, porta `5435`, banco `cineticket_test`, sem persistência (`tmpfs`).
- `.github/workflows/ci.yml`: dispara em PR para `develop`/`main`. Jobs `backend` (lint → sobe compose de teste → migration → test/test:e2e → build) e `frontend` (lint → build), paralelos.
- Validado: `actionlint` 0 erros; todos os comandos do pipeline reproduzidos manualmente com sucesso. Disparo real dentro do GitHub Actions ainda não testado (`act` indisponível) — risco residual baixo.

**DevOps — correção pós-Sprint 2 (`prisma generate` faltando antes do lint):**

- Execução real do CI no GitHub Actions expôs falha não reproduzida na validação estática/manual anterior: `eslint-plugin @typescript-eslint` (type-aware) falhava no job `backend` com erros "Unsafe ... on a type that cannot be resolved", porque o client do Prisma nunca era gerado no runner antes do step de `Lint`. Corrigido adicionando step `Generate Prisma client` (`pnpm --filter backend exec prisma generate`) logo após `Install dependencies` e antes de `Lint`, dentro do mesmo job `backend` — client gerado persiste no filesystem do runner para os steps seguintes (migrations/testes/build), sem necessidade de repetir o step. Job `frontend` não alterado (não usa Prisma).

**DevOps — correção pós-Sprint 2 (`packages/shared` sem build antes do lint):**

- Mesma causa raiz do item acima, segunda camada: `backend/tsconfig.json` resolve `@cineticket/shared` via `dist/` (corrigido nesse sentido durante a revisão do Sprint 2 — ver "Decisões e riscos... Backend, Sprint 1", item de `tsconfig.json#paths`), então o lint type-aware também falha num runner limpo se `packages/shared` nunca foi buildado. Corrigido adicionando step `Build shared package` (`pnpm --filter @cineticket/shared build`) logo após `Install dependencies` e antes de `Generate Prisma client`/`Lint`, no job `backend`. Script `build` (`tsc -p tsconfig.json`) já existia em `packages/shared/package.json`, sem lacuna a preencher.
- **Job `frontend` avaliado e não alterado**: `frontend/tsconfig.json#paths` resolve `@cineticket/shared` direto do `src/` (`../packages/shared/src/index.ts`), não do `dist/` — resolução de tipos não depende de build prévio do pacote. Além disso nenhum arquivo em `frontend/src` importa `@cineticket/shared` hoje. Confirmado empiricamente: `pnpm --filter frontend lint` e `pnpm --filter frontend build` passam sem `packages/shared/dist` presente. Se o frontend passar a consumir `@cineticket/shared` via `dist/` no futuro (ou o alias mudar), reavaliar.
- Validado localmente simulando runner limpo: `packages/shared/dist` e `backend/node_modules/.prisma` removidos, sequência exata do job `backend` (install → build shared → prisma generate → lint) reproduzida com sucesso, artefatos restaurados depois.

**Backend — Sprint 2 (auth/movies revisados + sessions/seats/reservations novos):**

Revisão de `auth/`/`movies/` (escritos manualmente pelo usuário antes desta sessão, não presumidos corretos). Bugs reais corrigidos, validados rodando a aplicação de ponta a ponta:

- `JwtModule.registerAsync` sem `inject: [AppConfigService]` — app crashava no bootstrap (`config` chegava `undefined`).
- `sanitizeUser` só removia `password`, deixando `refreshTokenHash` vazar em `/auth/login` — violação de regra não-negociável.
- `MoviesModule` com `controllers: []`/`exports: []` — rota `/movies/search` não existia, `MoviesService` não disponível para `SessionsModule`.
- Interfaces do `tmdb.service.ts` não exportadas — build quebrava (`TS4053`).
- `findOrCacheMovie` sem tratamento de corrida — corrigido, recupera via `P2002`.
- Dependência quebrada `"jwt": "link:@nestjs/@nestjs/jwt"` removida.
- `tsconfig.json`: `paths` de `@cineticket/shared` apontava pro source, violando `rootDir` — corrigido para resolver via `dist`.
- Guard order (`JwtAuthGuard` antes de `RolesGuard`) já estava correto.

Módulos novos — `sessions/`, `seats/`, `reservations/`:

- **Sessions**: leitura pública sem guard (D32); escrita restrita ao dono (`organizerId`, D10). Criação chama `findOrCacheMovie` fora da transação, depois `Session`+`Seat[]` atomicamente. `SEATS_PER_ROW = 10`.
- **Seats**: mapa público, status calculado a partir de `Reservation` ativa.
- **Reservations**: criação só `@Roles('CUSTOMER')` (D32). `expiresAt = now + 5min` (D05). `P2002` da constraint parcial vira `ConflictException`.
- **Expiração — verificação LAZY** (não job/cron): `expireStalePendingForSession` chamado antes de ler o mapa e antes de criar reserva nova. Decisão de implementação, documentada aqui por não haver infraestrutura de job pronta para testar.
- `ZodValidationPipe` genérico novo, aplicado com os schemas de `packages/shared` (`updateSessionSchema` é schema novo).

Validado manualmente contra a API real: sessão gera assentos atomicamente; concorrência real testada (duas reservas simultâneas no mesmo assento → uma `201`, outra `409`); expiração libera assento corretamente; guards respondendo 401/403 como esperado.

**QA — Sprint 2 (testes e2e automatizados, mentalidade adversarial):**

Suíte nova em `backend/test/e2e/`, rodada contra o banco de teste real (`docker-compose.test.yml`, porta 5435 — nunca o banco de dev). `test/e2e/support/global-setup.js` roda `src/prisma/seed.ts` (sem modificação) uma vez no início da suíte, só para materializar os 4 usuários fixos; a sessão/assentos que o seed também cria não são reaproveitados por nenhum spec — cada teste cria sua própria `Session`+`Seat` descartável direto via Prisma (`support/fixtures.ts`).

- **`reservations-concurrency.e2e-spec.ts`** — 5 rodadas × 5 clientes concorrentes (mais que os 2 clientes fixos do seed, criados sob demanda via Prisma com token JWT assinado diretamente) disputando o mesmo assento via `POST /reservations` simultâneo. **PASSOU**, de forma determinística em 5 execuções completas seguidas (25 rodadas no total, 125 requisições concorrentes): exatamente 1 `201` e o restante `409` em toda rodada, nunca 500, e o banco sempre reflete exatamente 1 reserva ativa (`PENDING`/`PAID`) por assento. Confirma que a constraint UNIQUE parcial + transação (D06) resistem a concorrência real, não só ao teste manual do Backend Agent.
- **`reservation-expiration.e2e-spec.ts`** — força uma `Reservation` `PENDING` com `expiresAt` no passado direto via Prisma. **PASSOU**: `GET /sessions/:id/seats` mostra o assento `AVAILABLE` (sweep lazy), um novo cliente consegue reservar com `201`, e a reserva antiga permanece no banco como `EXPIRED` (não deletada, não colide com a nova linha `PENDING`).
- **`ticket-single-use.e2e-spec.ts`** — **BLOQUEADO, não implementado.** `payments/` e `tickets/` continuam módulos vazios (`@Module({})`), sem rota de validação de portaria para exercitar. Marcado `describe.skip` com o roteiro completo documentado em comentário para quando o Sprint 4 implementar a rota — decisão explícita de não inventar mock/endpoint fake que não reflita o comportamento real futuro.

Nenhum bug de concorrência/expiração foi encontrado — o código do Sprint 2 resistiu ao teste adversarial. Um problema pré-existente e não relacionado foi encontrado ao rodar `pnpm --filter backend lint` (comando de validação obrigatório): 173 erros de aspas duplas (violando `singleQuote: true` do Prettier) em 28 arquivos de `src/`. **Resolvido** — commit `1c8f9b1` (`:recycle: refactor: standardize import statements and string quotes across the codebase`) já normalizou aspas simples nesses 28 arquivos e nos 6 arquivos novos de `test/e2e/`. Revalidado após esse commit: `lint`/`lint:fix` limpo (0 erros, `--fix` sem alterações a fazer), `test` sem regressão, `build` sem erro, e a suíte `test:e2e` (concorrência + expiração) continua passando de forma determinística em 3 execuções completas após a reformatação.

### Ambiguidades resolvidas sem travar a tarefa (Backend, Sprint 2)

1. `GET /sessions` retorna todas as sessões sem filtrar `published` — não foi pedido, vale revisão futura.
2. Layout de assento a partir só de `capacity` — decisão de implementação, reversível.
3. `/auth/login` continua sem `ZodValidationPipe` (violação de §5) — pré-existente, fora do checklist desta revisão.
4. D35 (retry com backoff no Prisma) ainda não implementado — risco de crash-loop em deploy.

### Decisões e riscos que surgiram durante a implementação (Backend, Sprint 1)

1. **Constraint UNIQUE de `(sessionId, seatId)` implementada como índice único PARCIAL**, via SQL bruto na migration (Prisma DSL não suporta `WHERE` em índice único) — necessário para permitir reabertura de assento após expiração/cancelamento. Validado via `\d "Reservation"`. QA deve testar: concorrência simultânea e o ciclo reservar→expirar→reservar de novo.
2. `pnpm.onlyBuiltDependencies` adicionado (necessário para build scripts nativos sob pnpm 10 não-interativo).
3. `package.json#prisma` deprecado a partir do Prisma 7 — não migrado agora.
4. `.prettierrc` da raiz — resolvido na tarefa de integração ESLint+Prettier.
5. `test/unit/`/`test/e2e/` ainda vazios — QA Agent inicia no Sprint 2/seguinte.
6. `D29` não encontrado em `decisions-log.md` — resolvido, arquivo atualizado até D36.
7. **`PrismaService.onModuleInit()` conecta de forma síncrona antes de `app.listen()`** — sem banco, o processo crasha (`P1001`) em vez de travar "logando a porta". Risco real de crash-loop no deploy Railway se o Postgres não estiver pronto no instante do start. Correção definida em D35 (retry com backoff), ainda não implementada.
8. TypeScript/Prisma mantidos abaixo do major mais recente (D30) — `typescript-eslint`/`ts-jest` não suportam TS 7; Prisma 7 quebraria `package.json#prisma`.
9. `tsconfig.json`: `"incremental": true` removido (combinado com `deleteOutDir` do Nest CLI, mascarava build vazio). `"ignoreDeprecations": "6.0"` injetado por extensão de editor (Console Ninja) também removido.

### Decisões e riscos que surgiram durante a implementação (Frontend, Sprint 1)

1. **Conflito `frontend/CLAUDE.md` (pré-D18) vs. `project-rules.md`/D18** escalado antes de codar, conforme regra do próprio CLAUDE.md. Resolvido: `ui/` cumpre papel de "atoms", sem pasta separada — 4 níveis (D31).
2. Stack conservadora deliberada: Next.js 14 (não 15), React 18 (não 19), Tailwind v3 (não v4 — v4 troca `tailwind.config.ts` por `@theme`, e a tarefa pede tema customizado explicitamente no config).
3. Nomes de rota escolhidos pelo agente (`(customer)/my-tickets`, `(organizer)/dashboard`, `(gate)/check-in`) — necessário porque route groups não geram segmento de URL. Placeholder, aprovado pelo usuário.
4. `.prettierrc` da raiz — resolvido na integração ESLint+Prettier.
5. Build local com retry em Google Fonts (rede instável, não config) — monitorar em CI/deploy; considerar `next/font/local` se confirmar problema no Railway/Vercel.

## Pendente (ordem de sprint, ver `agent-ecosystem.md`)

- [x] Sprint 1 (infra) — Workspace root, esqueleto de `backend/`/`frontend/`/`packages/shared/`, Postgres de dev containerizado.
- [x] Sprint 1 — Backend completo (schema/migration/seed/config/módulos vazios/schemas compartilhados).
- [x] Sprint 1 — Frontend completo (Next.js, tema customizado, dark mode, TanStack Query, RHF+Zod, esqueleto de rotas).
- [x] Sprint 1 — `docker-compose.test.yml` + CI.
- [x] Pós-Sprint 1 — `backend/Dockerfile` e `frontend/Dockerfile`, validados localmente. Falta integração no `docker-compose.yml`/deploy Railway.
- [x] Pós-Sprint 1 — Integração ESLint + Prettier.
- [x] Sprint 2 — Core Backend: auth+guards revisado, TMDb, sessions/seats/reservations com concorrência validada manualmente.
- [x] Sprint 2 — QA: teste automatizado e2e de concorrência de assento e de expiração de reserva (determinísticos, banco de teste real). Teste de ingresso duplicado bloqueado por dependência do Sprint 4 (payments/tickets/gate).
- [ ] Sprint 2/3 — Frontend: não iniciado além do esqueleto do Sprint 1.
- [ ] Sprint 3 — Core Frontend + Realtime (WebSocket). **Marco dia 5: decisão WebSocket vs. polling.**
- [ ] Sprint 4 — Pagamento simulado, ingresso (JWT+QR), portaria.
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed, revisão final.

## Riscos abertos

1. **WebSocket** — sem fallback implementado; decisão de queda para polling no dia 5, se necessário, é do Arquiteto.
2. ~~Concorrência de assento sem teste automatizado~~ — **resolvido**: `backend/test/e2e/reservations-concurrency.e2e-spec.ts` cobre isso contra o banco de teste real, determinístico em múltiplas execuções locais (ver seção "QA — Sprint 2"). Falta só confirmar que passa dentro do GitHub Actions de verdade (ver risco #4, já existente).
3. **Deploy Railway com WebSocket** — não validado se o plano gratuito sustenta conexão persistente sem interrupção.
4. ~~CI nunca rodou dentro do GitHub Actions de verdade~~ — **parcialmente resolvido**: rodou de verdade e encontrou um problema real (abaixo), já corrigido. Segue aberto só quanto a confirmar reprodução completa e estável do pipeline em um próximo PR.
5. **Boot do backend crasha, não trava, sem Postgres acessível** — sem D35 implementada, risco de crash-loop no Railway. Prioridade antes do Sprint 5.

## Decisões pendentes de revisão futura

1. ~~Backfill de D27–D29~~ — resolvido, `decisions-log.md` até D36.
2. Upgrade TypeScript 7 / Prisma 7 — adiado deliberadamente.
3. `/auth/login` sem `ZodValidationPipe` — pendente, fora do checklist da revisão do Sprint 2.
4. **D35 (retry com backoff no Prisma) ainda não implementado** — prioridade antes do Sprint 5.