# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

<<<<<<< HEAD
**Última atualização:** 24/08 — Frontend Agent: Sprint 3 Frontend concluído nesta branch (`feature/sprint-3-frontend-realtime`) — consumo real de `GET /sessions`, `GET /sessions/:id`, `GET /sessions/:id/seats` via TanStack Query, client WebSocket (`socket.io-client`) com join/leave de room por sessão e atualização de cache em tempo real (sem poll/refetch), seleção de assento local, e fluxo de confirmação de reserva com login obrigatório só na confirmação (D32). Validado de ponta a ponta com backend real rodando localmente (Postgres dev + seed) e duas abas de navegador reais (não simulado): assento muda de `AVAILABLE` para `PENDING` na aba B sem refresh assim que a aba A confirma. Achado de processo relevante: `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` não incluem a relação `movie` (nem existe endpoint público de detalhe de filme) — cards/telas de sessão hoje mostram sala/data/preço/capacidade, sem título/pôster do filme, por ausência real de dado na API, não omissão do frontend. `POST /auth/register` inexistente no backend já registrado pelo Arquiteto em D43 (backlog, não bloqueia).

**Última atualização (anterior):** 22/08 — Arquiteto: marco D08 fechado (D41) — smoke-test real no Railway confirmou WebSocket estável em produção (pior latência 554–642ms, idle 2.5min sem queda, reconexão automática ~600ms). WebSocket mantido, sem fallback para polling. Achado bloqueador descoberto durante o smoke-test: `backend/Dockerfile` não inclui `prisma/schema+migrations` no estágio final — deploy real do Sprint 5 falha sem correção (contornado só manualmente via SSH para este teste). Ação pendente do usuário: revogar chave SSH registrada e reverter branch de deploy do Railway.
=======

**Última atualização:** 24/08 — Backend Agent: os dois achados de D44 corrigidos. (1) `POST /reservations` agora recusa com `403 ForbiddenException` quando a `Session` do `Seat` tem `published: false` — checagem equivalente ao que o Gateway já fazia (D40), aplicada no REST antes da criação da reserva (nenhuma linha chega a ser criada). (2) `GET /sessions` e `GET /sessions/:id` agora incluem a relação `movie` via `include` do Prisma; `GET /sessions/:id/seats` deliberadamente não inclui (ver detalhe na seção Backend abaixo). 2 novos specs e2e; `reservations-concurrency`/`reservation-expiration` revalidados sem regressão.

**Última atualização anterior:** 22/08 — Arquiteto: marco D08 fechado (D41) — smoke-test real no Railway confirmou WebSocket estável em produção (pior latência 554–642ms, idle 2.5min sem queda, reconexão automática ~600ms). WebSocket mantido, sem fallback para polling. Achado bloqueador descoberto durante o smoke-test: `backend/Dockerfile` não inclui `prisma/schema+migrations` no estágio final — deploy real do Sprint 5 falha sem correção (contornado só manualmente via SSH para este teste). Ação pendente do usuário: revogar chave SSH registrada e reverter branch de deploy do Railway.

> > > > > > > develop

## Fase atual

Sprint 2 (Core Backend) **encerrado**. Sprint 3 (Core Frontend + Realtime) **concluído** — WebSocket Gateway (backend, D39-D41) e consumo real + realtime no frontend, ambos nesta fase.

**Sprint 1 completo nas quatro frentes:** Backend (schema/migration/seed/config/9 módulos/schemas Zod compartilhados), Frontend (Next.js, tema customizado, dark mode, TanStack Query, esqueleto das 4 rotas de grupo), DevOps (`docker-compose.test.yml` + CI no GitHub Actions), mais tarefas avulsas pós-Sprint 1: `backend/Dockerfile` e `frontend/Dockerfile` (ambos validados localmente, build+run), integração ESLint+Prettier.

**Sprint 2 (Core Backend) concluído e fechado:** auth+guards revisado e corrigido, integração TMDb, sessões/assentos/reservas com concorrência de assento validada manualmente e por teste e2e automatizado, PR mergeado em `develop` com CI verde confirmado.

**Falta:** WebSocket Gateway (Sprint 3, em andamento agora), Frontend Sprint 2/3 (consumo real da API + realtime), payments/tickets/gate (Sprint 4) — incluindo o teste automatizado de ingresso duplicado, bloqueado até essa rota existir —, integração dos Dockerfiles no `docker-compose.yml`/deploy Railway.

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
- Validado: `actionlint` 0 erros; todos os comandos do pipeline reproduzidos manualmente com sucesso.

**DevOps — correção pós-Sprint 2 (`prisma generate` faltando antes do lint):**

- Execução real do CI no GitHub Actions expôs falha não reproduzida na validação estática/manual anterior: `eslint-plugin @typescript-eslint` (type-aware) falhava no job `backend` com erros "Unsafe ... on a type that cannot be resolved", porque o client do Prisma nunca era gerado no runner antes do step de `Lint`. Corrigido adicionando step `Generate Prisma client` (`pnpm --filter backend exec prisma generate`) logo após `Install dependencies` e antes de `Lint`, dentro do mesmo job `backend` — client gerado persiste no filesystem do runner para os steps seguintes (migrations/testes/build), sem necessidade de repetir o step. Job `frontend` não alterado (não usa Prisma).

**DevOps — correção pós-Sprint 2 (`packages/shared` sem build antes do lint):**

- Mesma causa raiz do item acima, segunda camada: `backend/tsconfig.json` resolve `@cineticket/shared` via `dist/` (corrigido nesse sentido durante a revisão do Sprint 2 — ver "Decisões e riscos... Backend, Sprint 1", item de `tsconfig.json#paths`), então o lint type-aware também falha num runner limpo se `packages/shared` nunca foi buildado. Corrigido adicionando step `Build shared package` (`pnpm --filter @cineticket/shared build`) logo após `Install dependencies` e antes de `Generate Prisma client`/`Lint`, no job `backend`. Script `build` (`tsc -p tsconfig.json`) já existia em `packages/shared/package.json`, sem lacuna a preencher.
- **Job `frontend` avaliado e não alterado**: `frontend/tsconfig.json#paths` resolve `@cineticket/shared` direto do `src/` (`../packages/shared/src/index.ts`), não do `dist/` — resolução de tipos não depende de build prévio do pacote. Além disso nenhum arquivo em `frontend/src` importa `@cineticket/shared` hoje. Confirmado empiricamente: `pnpm --filter frontend lint` e `pnpm --filter frontend build` passam sem `packages/shared/dist` presente. Se o frontend passar a consumir `@cineticket/shared` via `dist/` no futuro (ou o alias mudar), reavaliar.
- Validado localmente simulando runner limpo: `packages/shared/dist` e `backend/node_modules/.prisma` removidos, sequência exata do job `backend` (install → build shared → prisma generate → lint) reproduzida com sucesso, artefatos restaurados depois.

**DevOps — CI real confirmado rodando dentro do GitHub Actions (fechamento Sprint 2, D38):**

- PR `feature/sprint-2 → develop` rodou o pipeline completo no Actions de verdade (não só reprodução manual/`actionlint`) — jobs `backend` e `frontend` verdes, confirmado pelo usuário. Fecha em definitivo o risco aberto #4 (antes "parcialmente resolvido").

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

Nenhum bug de concorrência/expiração foi encontrado — o código do Sprint 2 resistiu ao teste adversarial.

**Backend — correção dos dois achados de D44 (24/08):**

- **Reserva em sessão não-publicada (`ReservationsService.create`)**: `session` já era buscada antes da criação da reserva (para validar existência) — a checagem `if (!session.published) throw new ForbiddenException(...)` foi inserida logo em seguida, antes da busca do `Seat` e da transação. Escolhido `ForbiddenException` (403), não `BadRequestException` (400): a requisição em si é bem formada, o que falha é uma regra de autorização sobre o estado do recurso (mesmo raciocínio já usado em `SessionsService.update` para violação de `organizerId`). Mensagem explícita ("Sessão ainda não publicada — não é possível reservar assentos") — diferente do Gateway (D40), que usa mensagem genérica por não exigir autenticação prévia; `POST /reservations` já exige login (D32), então quem chega até essa checagem não é um estranho sondando às cegas.
- **`movie` ausente em `GET /sessions`/`GET /sessions/:id`**: `SessionsService.findAll`/`findOne` agora usam `include: { movie: true }` do Prisma. Novo tipo exportado `SessionWithMovie` (`Prisma.SessionGetPayload<{ include: { movie: true } }>`) substitui o `Session` cru nas assinaturas do service e do controller. Nenhum `select` explícito foi necessário: `Movie` não tem campo interno/de cache (diferente de `User.password`/`refreshTokenHash`, que são segredos reais) — incluir o model inteiro segue o mesmo padrão já usado por `Session`/`Seat` em outros pontos do módulo.
- **`GET /sessions/:id/seats` deliberadamente não inclui `movie`**: o endpoint retorna `SeatMapItem[]` (`id`/`row`/`number`/`status`), um DTO de mapa de assentos, não uma representação de sessão — o frontend já tem `movie` disponível via `GET /sessions/:id` antes de chegar na tela de seleção de assento. Adicionar `movie` ali misturaria escopos e infla um payload consultado com frequência (inclusive via sweep lazy de expiração a cada leitura).
- **Testes novos**: `test/e2e/reservation-unpublished-session.e2e-spec.ts` (403 + zero linhas de `Reservation` criadas, confirmado via Prisma; regressão positiva com sessão publicada) e `test/e2e/sessions-movie-relation.e2e-spec.ts` (`movie` presente em `GET /sessions` e `GET /sessions/:id`; ausente em `GET /sessions/:id/seats`). `reservations-concurrency.e2e-spec.ts` e `reservation-expiration.e2e-spec.ts` revalidados sem alteração de comportamento (sessões de teste continuam `published: true` por padrão em `createDisposableSession`).
- **Fora do escopo desta tarefa, continua em aberto**: risco #6 abaixo (filtro de `published` em `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` para _leitura_) não foi tocado — D44 elevou só a criação de reserva (escrita real) e a ausência de `movie`, não o filtro de leitura já adiado por D40. Continua backlog pré-Sprint 5.

**QA — correção pós-teste (lint bloqueador de PR, fechado em D38):**

Um problema pré-existente e não relacionado foi encontrado ao rodar `pnpm --filter backend lint` (comando de validação obrigatório): 173 erros de aspas duplas (violando `singleQuote: true` do Prettier) em 28 arquivos de `src/`. **Resolvido e confirmado** — `eslint --fix` aplicado em commit `style` isolado, revalidado limpo (`lint`/`lint:fix` 0 erros), sem regressão em `test`/`test:e2e`/`build`. Confirmado pelo usuário como parte do fechamento do Sprint 2 (D38).

### Ambiguidades resolvidas sem travar a tarefa (Backend, Sprint 2)

1. `GET /sessions` retorna todas as sessões sem filtrar `published` — não foi pedido, vale revisão futura.
2. Layout de assento a partir só de `capacity` — decisão de implementação, reversível.
3. `/auth/login` continua sem `ZodValidationPipe` (violação de §5) — pré-existente, fora do checklist desta revisão. **Ainda pendente** (backlog, não bloqueia Sprint 3, ver D39).
4. D35 (retry com backoff no Prisma) ainda não implementado — risco de crash-loop em deploy. **Ainda pendente** (backlog, não bloqueia Sprint 3, ver D39).

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

**Frontend — Sprint 3 (consumo real de sessions/seats + realtime WebSocket):**

- **Listagem (`/`)**: `GET /sessions` via TanStack Query (`useSessions`), busca client-side por sala (único campo textual disponível — ver achado abaixo sobre ausência de dado de filme), `SessionCard` (organism) com badge "Rascunho" para `published: false` (D40, ver riscos).
- **Detalhe (`/sessions/[id]`)**: `GET /sessions/:id` + `GET /sessions/:id/seats` via TanStack Query. `SeatMap` (organism) renderiza por linha, com legenda de status.
- **WebSocket (`src/lib/ws-client.ts` + `useSessionSocket`)**: `socket.io-client` lê `NEXT_PUBLIC_WS_URL` (sem fallback hardcoded usado em produção — validado manualmente apontando a env var para uma porta inexistente e confirmando falha visível, depois revertendo e confirmando reconexão). Conecta, emite `join:session`, escuta `seat:update` e atualiza o cache do TanStack Query direto via `setQueryData` — nunca refetch/poll, conforme pedido.
- **Seleção de assento**: `useSeatSelection` (useState local, sem Zustand — D12). Nenhuma `Reservation` é criada até a confirmação.
- **Confirmação de reserva (`ReservationPanel`)**: se não autenticado, redireciona para `/login?redirect=...`; se autenticado, `POST /reservations` com `Authorization: Bearer` do access token. Countdown visual de 5min a partir de `expiresAt` (`useCountdown`) — só indicativo, expiração real continua sendo o sweep lazy do backend (D05).
- **Auth (`useAuth` + `AuthProvider`)**: Context + useState (D12), sessão (`accessToken`+`user`) persistida em `localStorage`, sem Zustand. `apiClient` passou a enviar `credentials: 'include'` por padrão (necessário para o cookie httpOnly de `refreshToken` do backend ir/voltar corretamente).
- **Telas novas `/login` e `/register`**: não existiam de fato como esqueleto do Sprint 1 (a tarefa presumia que existiam — checado e reportado como ambiguidade resolvida sem travar a tarefa, ver abaixo). `/login` é funcional de ponta a ponta contra `POST /auth/login` real. `/register` usa `userSchema` de `packages/shared` (RHF + Zod), mas `POST /auth/register` **não existe no backend** — submit recebe 404 real, tratado com mensagem de erro visível ("Cadastro indisponível no momento."), sem sucesso fingido. Achado já registrado pelo Arquiteto em D43 (backlog, não bloqueia).

Validado manualmente de ponta a ponta com backend real local (Postgres dev container + seed) e navegador real (duas abas, não simulação):

1. Assento selecionado sem login → clique em "Confirmar reserva" redireciona para `/login` sem nenhuma chamada a `POST /reservations` — confirmado também consultando `GET /sessions/:id/seats` direto (assento seguiu `AVAILABLE`).
2. Login com `cliente1@cineticket.dev` (seed) → redireciona de volta para a sessão → seleção de assento A1 → confirmação → `POST /reservations` `201`, painel mostra countdown a partir de `expiresAt`.
3. Segunda aba (sem login) na mesma sessão: assento A1 mudou de `AVAILABLE` para `PENDING` em tempo real, sem F5 — confirmado visualmente (zoom no seat map) e via ausência de nova requisição HTTP para `/sessions` na aba passiva durante a janela do evento (ou seja, chegou por WebSocket, não por refetch).
4. `pnpm --filter frontend lint` e `pnpm --filter frontend build` limpos após as mudanças.

### Ambiguidades resolvidas sem travar a tarefa (Frontend, Sprint 3)

1. Rotas `/login` e `/register` não existiam como esqueleto do Sprint 1 (a instrução da tarefa presumia que existiam) — criadas do zero, dentro de `(public)/`, já que fazem parte do fluxo de confirmação de reserva sem gate de acesso próprio (D32).
2. `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` não trazem a relação `movie` (nem existe endpoint público de detalhe de filme — `GET /movies/search` é `@Roles('ORGANIZER')`) — cards e tela de detalhe mostram sala/data/preço/capacidade, sem título/pôster do filme. Não é omissão do frontend: não há dado disponível na API pública hoje. Fica registrado para o Arquiteto avaliar se `movie` deveria entrar no retorno de `GET /sessions`/`GET /sessions/:id`.
3. Registration (`role`) fixado em `CUSTOMER` no formulário de `/register`, sem seletor de papel exposto ao visitante — `userSchema` exige o campo, mas autocadastro público de `ORGANIZER`/`GATE` não é um caso de uso pedido em lugar nenhum do projeto.

## Pendente (ordem de sprint, ver `agent-ecosystem.md`)

- [x] Sprint 1 (infra) — Workspace root, esqueleto de `backend/`/`frontend/`/`packages/shared/`, Postgres de dev containerizado.
- [x] Sprint 1 — Backend completo (schema/migration/seed/config/módulos vazios/schemas compartilhados).
- [x] Sprint 1 — Frontend completo (Next.js, tema customizado, dark mode, TanStack Query, RHF+Zod, esqueleto de rotas).
- [x] Sprint 1 — `docker-compose.test.yml` + CI.
- [x] Pós-Sprint 1 — `backend/Dockerfile` e `frontend/Dockerfile`, validados localmente. Falta integração no `docker-compose.yml`/deploy Railway.
- [x] Pós-Sprint 1 — Integração ESLint + Prettier.
- [x] Sprint 2 — Core Backend: auth+guards revisado, TMDb, sessions/seats/reservations com concorrência validada manualmente.
- [x] Sprint 2 — QA: teste automatizado e2e de concorrência de assento e de expiração de reserva (determinísticos, banco de teste real). Teste de ingresso duplicado bloqueado por dependência do Sprint 4 (payments/tickets/gate).
- [x] Sprint 2 — Fechamento formal: lint corrigido, conflito de `decisions-log.md` resolvido, CI real confirmado verde no GitHub Actions, PR mergeado em `develop` (D38).
- [x] **Sprint 3 — WebSocket Gateway (backend): implementado, testado localmente sob carga e validado em produção real (Railway). Marco D08 fechado (D41).**
- [x] **Sprint 3 — Frontend: consumo real de sessions/seats via TanStack Query, mapa de assentos em tempo real via WebSocket (client `socket.io-client`), seleção local + confirmação de reserva com login obrigatório na confirmação (D32). Validado com backend real + duas abas de navegador reais.**
- [ ] Sprint 4 — Pagamento simulado, ingresso (JWT+QR), portaria.
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed, revisão final.
- [ ] **Bloqueadores confirmados do deploy real (Sprint 5), prioridade alta**: risco #9 (`ts-node` não executa `seed.ts` na imagem `node:20-alpine` do Dockerfile) — risco #8 (Dockerfile sem schema/migrations no runtime) já resolvido.
- [ ] Backlog (não bloqueia Sprint 3, mas não é o mesmo bloqueador acima): D35 (retry com backoff no Prisma), `/auth/login` sem `ZodValidationPipe`, D40 (filtro de `published`/dono nos 3 endpoints REST de sessions — impacto de UX confirmado nesta tarefa, ver risco #10), D43 (`POST /auth/register` ausente no backend, prioridade média).

## Riscos abertos

1. ~~WebSocket em produção não validado~~ — **resolvido (D41)**: smoke-test real no Railway, 3 clientes fora da rede local. Pior latência 554–642ms (5 execuções), estável por 2.5min ocioso, reconexão automática ~600ms após queda abrupta, sem perda de evento. WebSocket confirmado como solução definitiva, sem fallback para polling. Ressalva: validado com 3 clientes, não 12 como no teste local — suficiente para estabilidade de rede, vale repetir com mais carga depois do item 8 abaixo estar corrigido.
2. ~~Concorrência de assento sem teste automatizado~~ — **resolvido**: `backend/test/e2e/reservations-concurrency.e2e-spec.ts` cobre isso contra o banco de teste real, determinístico em múltiplas execuções, e confirmado passando dentro do GitHub Actions real (D38).
3. ~~Deploy Railway com WebSocket não validado~~ — **resolvido (D41)**: ver item 1.
4. ~~CI nunca rodou dentro do GitHub Actions de verdade~~ — **resolvido**: PR `feature/sprint-2 → develop` rodou o pipeline completo no Actions, jobs verdes, confirmado (D38).
5. **Boot do backend crasha, não trava, sem Postgres acessível** — sem D35 implementada, risco de crash-loop no Railway. Não se manifestou no smoke-test do D41 (boot limpo desta vez), mas ainda não implementada — backlog, prioridade antes do Sprint 5 (não bloqueia Sprint 3).
6. **Sessão rascunho (`published: false`) legível via REST por quem souber o `sessionId`** — D40: o WebSocket Gateway recusa subscribe em sessão não-publicada, mas `GET /sessions`, `GET /sessions/:id` e `GET /sessions/:id/seats` não filtram por `published` nem por dono. Risco prático baixo agora (sem usuário real, ID não exposto em listagem pública), mas é lacuna de autorização real. Backlog, prioridade antes do Sprint 5, mesma categoria de D35. **Nota (D44, 24/08): o risco de escrita associado (venda real de assento em sessão rascunho via `POST /reservations`) foi corrigido — ver item 10. Este item 6 cobre só o filtro de leitura, que segue aberto.**
7. **Achado de processo — `eslint --fix` pode quebrar silenciosamente casts de campo privado em arquivos de teste.** Durante a extensão do spec do Gateway, `eslint --fix` removeu um `as unknown as GatewayInternals` necessário (regra `no-unnecessary-type-assertion` compara tipo estrutural, não modela o check nominal de `private` do TypeScript do TS) — o arquivo parou de compilar, só detectado porque o agente recompilou via `ts-jest` em vez de confiar no lint limpo. Relevante para Sprint 4/5 (QA testando `payments`/`tickets`, possivelmente reflection semelhante em estado interno): **sempre recompilar depois de `eslint --fix` em teste que usa cast de campo privado, nunca assumir que lint limpo implica build correto.**
8. ~~`backend/Dockerfile` não copiava `src/prisma/` para o runtime~~ — **resolvido**: `COPY --from=builder .../backend/src/prisma ./backend/src/prisma` adicionado ao stage `runner`. Reproduzido o bug original antes da correção (erro real de schema não encontrado), corrigido e revalidado: build limpo, `prisma migrate deploy` dentro do container encontra schema/migrations reais contra Postgres de dev (5434), boot normal sem regressão (`/docs` 200).
9. **`ts-node` não consegue executar `seed.ts` dentro da imagem `node:20-alpine` do Dockerfile** — `Unknown file extension ".ts"`, reproduzido inclusive com um `.ts` trivial não relacionado, confirmando incompatibilidade `ts-node`/versão do Node na imagem, não problema de path. **Mesma categoria de severidade do risco #8 (agora resolvido), não risco secundário**: `seed.ts` é obrigatório por `project-rules.md` §4 e é critério de avaliação próprio ("Dados semeados"). Sem correção, o deploy real do Sprint 5 falha no seed do mesmo jeito que falhava na migration antes do fix acima. Não bloqueia Sprint 3 (frontend não depende disso), mas deve ser tratado como bloqueador de deploy antes do Sprint 5, junto do risco #8 — não como item genérico de backlog.
10. ~~`POST /auth/register` ausente no backend~~ — já registrado e avaliado pelo Arquiteto em D43 (backlog de prioridade média, não bloqueia Sprint 3). Frontend (`/register`) trata o 404 real com mensagem de erro visível, sem sucesso fingido.
11. **Access token (15min, D07) sem endpoint de refresh implementado no backend** — não existe `POST /auth/refresh`, só `/auth/login`. O frontend não tenta simular um refresh (seria lógica de negócio inventada no cliente): guarda o `accessToken` em `localStorage` via `useAuth`, e se expirar no meio de uma ação protegida (`POST /reservations`), o erro 401/403 é tratado como sessão inválida e redireciona para `/login` de novo. Sem correção, qualquer sessão de cliente autenticado expira de verdade em 15min sem renovação silenciosa — acentua a chance de o usuário cair de volta no login no meio do fluxo de reserva. Reportado como achado, não implementado (endpoint de refresh é decisão de backend).
12. **`GET /sessions`/`GET /sessions/:id` não incluem a relação `movie`** — schema Prisma tem `Movie` com `title`/`posterUrl`, mas nenhum dos dois endpoints públicos de sessão faz `include`, e não existe endpoint público de detalhe de filme (`GET /movies/search` é `@Roles('ORGANIZER')`). O frontend do Sprint 3 mostra sala/data/preço/capacidade — sem título ou pôster do filme em cartaz, o que é uma limitação de conteúdo visível numa tela pública central do produto. Reportado para o Arquiteto avaliar se `GET /sessions` deveria trazer `movie` (mudança pequena e local em `sessions.service.ts`, fora do escopo desta sessão de frontend).

13. ~~`POST /reservations` aceitava reserva real em sessão `published: false`~~ — **resolvido (D44, 24/08)**: `ReservationsService.create` recusa com `403 ForbiddenException` antes de qualquer escrita, confirmado por teste e2e (zero linhas de `Reservation` criadas no banco). Mais grave que o item 6 (que é só leitura) porque era venda real de assento — corrigido antes do Sprint 4 iniciar, conforme priorização de D44.
14. ~~`GET /sessions`/`GET /sessions/:id` sem dado de filme~~ — **resolvido (D44, 24/08)**: relação `movie` incluída via Prisma `include`. `GET /sessions/:id/seats` deliberadamente fora do escopo (é DTO de mapa de assentos, não de sessão).

**Nota de processo — exceção pontual ao D25:** durante a correção do risco #8, o agente de backend identificou conflito entre `CLAUDE.md` raiz (D25 — `.context/` é escopo de sessão de raiz) e a própria tarefa pedindo pra fechar o risco #8 em `project-state.md`. Escalado corretamente antes de agir; usuário autorizou a edição direta nesta tarefa específica, em commit separado. **Isso não reabre D25** — é uma autorização pontual, não precedente. Se editar `.context/` fora da sessão de raiz voltar a acontecer, deve ser escalado de novo, não presumido como já aprovado.

## Decisões pendentes de revisão futura

1. ~~Backfill de D27–D29~~ — resolvido, `decisions-log.md` até D39.
2. Upgrade TypeScript 7 / Prisma 7 — adiado deliberadamente.
3. `/auth/login` sem `ZodValidationPipe` — backlog, não bloqueia Sprint 3 (D39).
4. **D35 (retry com backoff no Prisma) ainda não implementado** — backlog, prioridade antes do Sprint 5, não bloqueia Sprint 3 (D39).
