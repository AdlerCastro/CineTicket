# Project State — CineTicket

> Atualizado ao fim de cada sprint (ou tarefa relevante) pelo agente que a executou. Fonte que qualquer agente lê antes de começar algo novo — se este arquivo estiver desatualizado, a tarefa seguinte corre o risco de trabalhar sobre premissa errada.

**Última atualização:** 24/08 — Backend Agent: Sprint 4 (backend) concluído — `payments/` e `tickets/` implementados (pagamento simulado, geração de ingresso JWT+QR, validação de portaria). Ver seção "Backend — Sprint 4" abaixo para detalhes completos (mapeamento de status HTTP dos 4 retornos de validação, decisão de transação, ambiguidades resolvidas). `ticket-single-use.e2e-spec.ts` (BLOQUEADO desde o Sprint 2) ativado e passando; 3 novos specs e2e (`payments.e2e-spec.ts`, `ticket-validation-concurrency.e2e-spec.ts`, `payments-concurrency.e2e-spec.ts`). **Achado + corrigido no próprio dia**: `POST /payments` tinha corrida real sem proteção atômica (check-then-write), confirmada empiricamente com chamadas concorrentes reais antes de reportar a tarefa como pronta — ver detalhe na seção "Backend — Sprint 4". `lint`/`test:e2e`/`build` limpos — suíte e2e completa (37 testes, 9 arquivos) revalidada em 2 execuções seguidas sem flakiness, incluindo 15 rodadas × 5 validações simultâneas do mesmo ingresso e 10 rodadas de concorrência em `POST /payments`.

**Última atualização (anterior 1):** 24/08 — Frontend Agent: revalidação pós-D44 concluída, **Sprint 3 fechado nas duas frentes**. `develop` puxada (backend com D44 já mergeado), roteiro de duas abas re-executado sem regressão, `SessionCard`/detalhe de sessão agora mostram título e pôster do filme (`movie` incluído desde D44), e `ReservationPanel` trata o novo `403` de sessão não-publicada com mensagem própria (sem redirecionar pro login — usuário já está autenticado corretamente, só o assento é que não pode ser reservado). Caso novo testado com sessão rascunho criada manualmente via API (ver detalhe na seção Frontend abaixo): erro visível na UI, zero `Reservation` criada, confirmado via `GET /sessions/:id/seats`. `lint`/`build` limpos. Achado de processo: merge de `develop` anterior tinha sido commitado com marcadores de conflito (`<<<<<<<`/`=======`/`>>>>>>>`) ainda literais em `project-state.md` — corrigido em commit separado antes de iniciar esta tarefa.

**Última atualização (anterior 2):** 24/08 — Backend Agent: os dois achados de D44 corrigidos. (1) `POST /reservations` agora recusa com `403 ForbiddenException` quando a `Session` do `Seat` tem `published: false` — checagem equivalente ao que o Gateway já fazia (D40), aplicada no REST antes da criação da reserva (nenhuma linha chega a ser criada). (2) `GET /sessions` e `GET /sessions/:id` agora incluem a relação `movie` via `include` do Prisma; `GET /sessions/:id/seats` deliberadamente não inclui (ver detalhe na seção Backend abaixo). 2 novos specs e2e; `reservations-concurrency`/`reservation-expiration` revalidados sem regressão.

**Última atualização (anterior 3):** 24/08 — Frontend Agent: Sprint 3 Frontend concluído nesta branch (`feature/sprint-3-frontend-realtime`) — consumo real de `GET /sessions`, `GET /sessions/:id`, `GET /sessions/:id/seats` via TanStack Query, client WebSocket (`socket.io-client`) com join/leave de room por sessão e atualização de cache em tempo real (sem poll/refetch), seleção de assento local, e fluxo de confirmação de reserva com login obrigatório só na confirmação (D32). Validado de ponta a ponta com backend real rodando localmente (Postgres dev + seed) e duas abas de navegador reais (não simulado): assento muda de `AVAILABLE` para `PENDING` na aba B sem refresh assim que a aba A confirma. Achado de processo relevante: `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` não incluíam a relação `movie` (corrigido em D44 acima) — cards/telas de sessão mostravam só sala/data/preço/capacidade. `POST /auth/register` inexistente no backend já registrado pelo Arquiteto em D43 (backlog, não bloqueia).

**Última atualização anterior:** 22/08 — Arquiteto: marco D08 fechado (D41) — smoke-test real no Railway confirmou WebSocket estável em produção (pior latência 554–642ms, idle 2.5min sem queda, reconexão automática ~600ms). WebSocket mantido, sem fallback para polling. Achado bloqueador descoberto durante o smoke-test: `backend/Dockerfile` não inclui `prisma/schema+migrations` no estágio final — deploy real do Sprint 5 falha sem correção (contornado só manualmente via SSH para este teste). Ação pendente do usuário: revogar chave SSH registrada e reverter branch de deploy do Railway.

## Fase atual

Sprint 2 (Core Backend) **encerrado**. **Sprint 3 (Core Frontend + Realtime) fechado, nas duas frentes** — WebSocket Gateway (backend, D39-D41), consumo real + realtime no frontend, e os dois achados pós-entrega (D44: reserva em sessão não-publicada e dado de filme ausente) corrigidos no backend e revalidados no frontend, sem regressão no roteiro de duas abas. **Sprint 4 — lado backend concluído** (pagamento simulado, ingresso JWT+QR, validação de portaria — ver seção "Backend — Sprint 4" abaixo); falta o lado frontend (telas de pagamento, "Meus ingressos" com QR renderizado client-side, tela de portaria com câmera+manual via `qr-scanner`, D46), fora do escopo desta sessão (`backend/`).

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
- ~~**`ticket-single-use.e2e-spec.ts`** — BLOQUEADO, não implementado.~~ **Resolvido (Sprint 4, 24/08)**: `describe.skip` removido, roteiro real executado (reserva → pagamento aprovado → validação `VALIDO` → segunda validação `JA_USADO`). Ver seção "Backend — Sprint 4" acima.

Nenhum bug de concorrência/expiração foi encontrado — o código do Sprint 2 resistiu ao teste adversarial.

**Backend — correção dos dois achados de D44 (24/08):**

- **Reserva em sessão não-publicada (`ReservationsService.create`)**: `session` já era buscada antes da criação da reserva (para validar existência) — a checagem `if (!session.published) throw new ForbiddenException(...)` foi inserida logo em seguida, antes da busca do `Seat` e da transação. Escolhido `ForbiddenException` (403), não `BadRequestException` (400): a requisição em si é bem formada, o que falha é uma regra de autorização sobre o estado do recurso (mesmo raciocínio já usado em `SessionsService.update` para violação de `organizerId`). Mensagem explícita ("Sessão ainda não publicada — não é possível reservar assentos") — diferente do Gateway (D40), que usa mensagem genérica por não exigir autenticação prévia; `POST /reservations` já exige login (D32), então quem chega até essa checagem não é um estranho sondando às cegas.
- **`movie` ausente em `GET /sessions`/`GET /sessions/:id`**: `SessionsService.findAll`/`findOne` agora usam `include: { movie: true }` do Prisma. Novo tipo exportado `SessionWithMovie` (`Prisma.SessionGetPayload<{ include: { movie: true } }>`) substitui o `Session` cru nas assinaturas do service e do controller. Nenhum `select` explícito foi necessário: `Movie` não tem campo interno/de cache (diferente de `User.password`/`refreshTokenHash`, que são segredos reais) — incluir o model inteiro segue o mesmo padrão já usado por `Session`/`Seat` em outros pontos do módulo.
- **`GET /sessions/:id/seats` deliberadamente não inclui `movie`**: o endpoint retorna `SeatMapItem[]` (`id`/`row`/`number`/`status`), um DTO de mapa de assentos, não uma representação de sessão — o frontend já tem `movie` disponível via `GET /sessions/:id` antes de chegar na tela de seleção de assento. Adicionar `movie` ali misturaria escopos e infla um payload consultado com frequência (inclusive via sweep lazy de expiração a cada leitura).
- **Testes novos**: `test/e2e/reservation-unpublished-session.e2e-spec.ts` (403 + zero linhas de `Reservation` criadas, confirmado via Prisma; regressão positiva com sessão publicada) e `test/e2e/sessions-movie-relation.e2e-spec.ts` (`movie` presente em `GET /sessions` e `GET /sessions/:id`; ausente em `GET /sessions/:id/seats`). `reservations-concurrency.e2e-spec.ts` e `reservation-expiration.e2e-spec.ts` revalidados sem alteração de comportamento (sessões de teste continuam `published: true` por padrão em `createDisposableSession`).
- **Fora do escopo desta tarefa, continua em aberto**: risco #6 abaixo (filtro de `published` em `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` para _leitura_) não foi tocado — D44 elevou só a criação de reserva (escrita real) e a ausência de `movie`, não o filtro de leitura já adiado por D40. Continua backlog pré-Sprint 5.

**Backend — Sprint 4 (pagamento simulado, ingresso JWT+QR, validação de portaria — 24/08):**

Branch `feature/sprint-4-payments-tickets-gate`. `payments/` e `tickets/` implementados do zero (módulos vazios desde o Sprint 1). Nenhuma migration nova — nenhum model `Payment` foi criado: a decisão do pagamento (D04) é só uma transição de estado sobre `Reservation` (`PENDING`→`PAID`/`CANCELLED`), que já modela tudo que o projeto pede; um model de auditoria de pagamento separado não foi pedido em lugar nenhum do escopo (`project-description.md`/`project-rules.md`) e teria sido abstração sem função clara neste momento — se o Arquiteto quiser histórico de tentativas de pagamento no futuro, é decisão nova, não implícita nesta tarefa.

- **`POST /payments`** (`@Roles('CUSTOMER')`): recebe `{ reservationId, decision: 'APPROVE' | 'DECLINE' }` (`processPaymentSchema`, novo em `packages/shared`). Ownership: só o `customerId` dono da `Reservation` pode pagar/recusar (`ForbiddenException`, mesmo padrão de `SessionsService.update`). Reaproveita `ReservationsService.expireStalePendingForSession` (D05) antes de checar o status — reserva expirada nunca chega a ser paga, sem duplicar a lógica de sweep lazy. Qualquer status != `PENDING` (expirada, já paga, cancelada) rejeita com `409 ConflictException`.
  - **DECLINE**: `Reservation` → `CANCELLED`. Assento libera imediatamente — mesmo padrão do sweep de expiração, via `SeatsGateway.emitSeatUpdate(sessionId, { seatId, status: 'AVAILABLE' })`. Nenhum `Ticket` é criado neste caminho.
  - **APPROVE**: `Reservation` → `PAID` **e criação do `Ticket` na MESMA transação** (`prisma.$transaction`), não como passo síncrono seguinte fora dela. Decisão: geração de ticket aqui é 100% local (UUID + assinatura JWT, sem I/O externo/rede) — incluir na transação é barato e evita o estado inconsistente de uma `Reservation PAID` sem `Ticket` correspondente caso algo falhe no meio (ex.: erro de serialização do Postgres). `TicketsService.createForReservation(reservationId, tx)` recebe o `Prisma.TransactionClient` da chamada, não abre a própria transação.

- **🐛 Achado real + corrigido (mesmo dia, antes de reportar a tarefa como pronta): corrida em `POST /payments` sem proteção atômica.** Investigado a pedido explícito de revisão ("o que acontece se 2+ POST /payments chegarem simultâneos pra mesma Reservation?"). A implementação inicial fazia `findUniqueOrThrow` + checagem de `status !== PENDING` em JS, depois um `update` **incondicional por `id`** — clássico check-then-write que D06 já existe pra evitar, e que eu apliquei corretamente em `tickets.service.ts#validate` mas não copiei pra cá. Confirmado empiricamente com chamadas concorrentes reais (não só raciocínio): 5× `APPROVE` simultâneo na mesma reserva → `[409, 500, 409, 409, 201]`, um `500` não tratado (`P2002` da constraint `Ticket.reservationId @unique`, segunda aprovação tentando criar um segundo `Ticket`); `APPROVE`+`DECLINE` misto (2×2) → `[201, 201, 500, 201]`, **três `201` simultâneos**, terminando com `Reservation CANCELLED` e um `Ticket VALID` ainda associado a ela (inconsistência real de dado, não só resposta HTTP errada). Corrigido trocando os dois `update`s (approve e decline) por `prisma.reservation.updateMany({ where: { id, status: 'PENDING' }, data: {...} })` — mesmo padrão atômico já usado na validação de portaria; só uma requisição consegue sair de `PENDING`, as demais recebem `count: 0` e `409` limpo, sem chegar a tentar criar `Ticket`. Revalidado 5× seguidas pós-fix, sempre exatamente 1 vencedor (às vezes `APPROVE`, às vezes `DECLINE` — a ordem de commit no Postgres decide, não a ordem de disparo em JS), nunca `500`, nunca dois `Ticket`s, nunca `Reservation CANCELLED` com `Ticket` associado. Novo spec permanente `test/e2e/payments-concurrency.e2e-spec.ts` (10 testes: 5 rodadas × APPROVE concorrente, 5 rodadas × APPROVE/DECLINE misto) cobre isso daqui pra frente.

- **`GET /tickets/:id`** (`@Roles('CUSTOMER')`): retorna `{ id, status, jwt, usedAt, session: { id, room, startsAt, movie }, seat }` — `jwt` é o JWT assinado como string; **QR não é gerado no backend** (D46/opção A), frontend renderiza client-side a partir desse campo. Restrito ao customer dono da `Reservation` original (`ForbiddenException` para qualquer outro usuário, incluindo outro `CUSTOMER`) — ambiguidade resolvida sem travar a tarefa: a tarefa não especificava guard além de "endpoint de consulta", mas o `jwt` retornado É o ingresso funcional (quem tiver a string pode validar na portaria), então deixá-lo sem ownership check seria abrir uma forma de vazar ingresso alheio. Sem endpoint de listagem (`GET /tickets`/`GET /tickets/mine`) — não foi pedido, e o critério de pronto só menciona "`GET /tickets/:id` ou equivalente".

- **`Ticket.code` reaproveitado para guardar o JWT assinado inteiro** (não um código curto separado): o campo já existia no schema desde o Sprint 1 (`code String @unique`), antes do desenho final de D03 estar fechado. Como o JWT em si já cumpre o papel de "código único do ingresso" (payload mínimo `{ ticketId }`, assinado com `JWT_TICKET_SECRET`), reaproveitar `code` evitou uma coluna nova/migration para guardar essencialmente a mesma informação duas vezes. **Sem `expiresIn`** na assinatura — o ingresso não expira por tempo (nada no projeto pede isso), só passa a ser rejeitado quando `status` vira `USED`.

- **`POST /tickets/validate`** (`@Roles('GATE')`) — mantido dentro do módulo `tickets/`, não um módulo `gate/` separado: a validação opera exclusivamente sobre o `Ticket` (assinatura + status), reaproveita o mesmo `JWT_TICKET_SECRET`/include de sessão+assento+filme do `GET /tickets/:id`, e um módulo novo só para "portaria" seria uma fronteira artificial sem responsabilidade própria (mesmo raciocínio de simplicidade já usado noutros pontos do projeto). Recebe `{ token, sessionId }` (`validateTicketSchema`) — `sessionId` é a sessão que a tela de portaria está validando no momento; **pressuposto assumido conforme a própria tarefa sugeriu** ("a tela de portaria sabe qual sessão está checando") — sem isso não haveria como calcular EVENTO_ERRADO. Se esse pressuposto não bater com o desenho real da tela de portaria (ex.: ela escanear o QR sem já ter a sessão selecionada), o contrato do endpoint precisa mudar — reportado aqui explicitamente por não ser 100% derivável do enunciado.
  - **Mapeamento de status HTTP dos 4 retornos exatos (`project-description.md`)**:
    - `VALIDO` → **`200 OK`** (`@HttpCode(HttpStatus.OK)` explícito — POST no Nest é `201` por padrão, sobrescrito porque nenhum recurso novo é criado, só uma transição de estado é confirmada). Corpo: `{ result: 'VALIDO', ticket: {...} }`.
    - `INVALIDO` → **`400 BadRequestException`** — cobre os dois casos que a tarefa agrupa como uma coisa só (assinatura que não bate/JWT malformado, verificado ANTES de qualquer query; e `ticketId` decodificado que não existe no banco). Semanticamente é entrada não reconhecida como ingresso válido, não um recurso ausente (por isso não usei 404 — o JWT vem no corpo, não faz parte da URL).
    - `JA_USADO` → **`409 ConflictException`** — mesmo código já usado em `reservations/` pra conflito de estado (assento já reservado); consistência de convenção dentro do projeto.
    - `EVENTO_ERRADO` → **`422 UnprocessableEntityException`** — a requisição é bem formada e o ingresso existe/é genuíno, mas semanticamente não se aplica à sessão sendo checada; código distinto de 400/409 pra o frontend da portaria conseguir diferenciar as 4 situações sem parsear a mensagem.
  - **Ambiguidade resolvida — precedência entre EVENTO_ERRADO e JA_USADO**: um ingresso já USED de uma sessão diferente da que está sendo checada tecnicamente atende às duas condições. Decisão: **EVENTO_ERRADO tem precedência** — é checado antes da tentativa de marcar `USED`, porque é um descasamento de identidade (este ingresso nunca pertenceu à sessão da portaria atual) que não depende do estado de uso. Avisar "sessão errada" é mais acionável pro funcionário da portaria do que "já usado" nesse caso (ele pode estar na fila errada). Reportado aqui por não estar explícito no enunciado.
  - **Concorrência (🔒 não-negociável)**: marcação `USED` via `prisma.ticket.updateMany({ where: { id, status: 'VALID' }, data: { status: 'USED', usedAt: new Date() } })` — **um único UPDATE condicional atômico**, não duas queries separadas (check-then-update). Sob concorrência real do Postgres (mesmo em `READ COMMITTED`, o isolamento default), a segunda requisição concorrente bloqueia no lock de linha até a primeira commitar, depois reavalia o `WHERE status = 'VALID'` contra o estado já `USED` e afeta 0 linhas — sem precisar de `$transaction` explícita (o UPDATE já é atômico sozinho), mesmo espírito de D06 (proteção real no banco, não em duas idas à aplicação).

- **Testes novos/reativados** (detalhe completo dos casos em `backend/test/e2e/`):
  - `ticket-single-use.e2e-spec.ts` — `describe.skip` removido (bloqueado desde o Sprint 2). Roteiro real: reserva → pagamento aprovado → `GET /tickets/:id` (JWT real) → primeira validação `VALIDO` → segunda validação do mesmo JWT `JA_USADO`.
  - `payments.e2e-spec.ts` — DECLINE libera assento pra outro cliente (seat map + nova reserva bem-sucedida); APPROVE gera `Ticket VALID` consultável só pelo dono (403 pra outro customer); reserva expirada rejeitada com 409 sem virar `PAID` (permanece `EXPIRED` via sweep); ownership (403 pra quem não é dono da reserva).
  - `ticket-validation-concurrency.e2e-spec.ts` — 5 rodadas × 5 validações simultâneas do mesmo QR (mesmo rigor de `reservations-concurrency.e2e-spec.ts`): exatamente 1 `200/VALIDO`, resto `409/JA_USADO`, nunca 500, nunca dois `VALIDO`; banco sempre reflete `USED` uma única vez. Mais 2 casos isolados: `EVENTO_ERRADO` (ticket de uma sessão validado contra outra) e `INVALIDO` (JWT malformado, sem tocar o banco).
  - `payments-concurrency.e2e-spec.ts` — adicionado depois do achado de corrida documentado acima: 5 rodadas × 5 `APPROVE` simultâneos (exatamente 1 vence, resto 409, nunca 500, no máximo 1 `Ticket`) + 5 rodadas × `APPROVE`/`DECLINE` misto (exatamente 1 decisão vence, estado final da `Reservation` sempre consistente com a presença/ausência de `Ticket`).
  - Suíte completa (9 arquivos, 37 testes) revalidada em 2 execuções seguidas (`pnpm test:e2e`) sem flakiness — 15 rodadas de concorrência de portaria (75 requisições simultâneas), 10 rodadas de concorrência em `POST /payments` e 15 rodadas de concorrência de assento (já existentes), todas determinísticas.

- **Commits locais** (sem push/PR/merge, sem trailer de IA): 2 commits `feat` (`tickets` primeiro — módulo autocontido; `payments` depois — depende de `TicketsService`) + 1 commit `test` (ativação do skip + 2 specs novos) + 1 commit `fix` (corrida em `POST /payments`, achado durante revisão pós-implementação — ver acima). **Desvio da sugestão da tarefa** ("payments / tickets / gate validation", 3 commits): a validação de portaria vive nos MESMOS arquivos de `tickets.service.ts`/`tickets.controller.ts` que a geração/consulta do ingresso (ver decisão de módulo acima) — fragmentar um único arquivo coeso em dois commits exigiria staging parcial artificial, contrariando a própria regra de "não misturar módulos não relacionados" (aqui não há dois módulos, é um só, por escolha deliberada). Granularidade adotada segue o padrão já usado no Sprint 2 (`4091bec`: um `feat` por grupo de módulos relacionados, `test` separado depois).

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
2. ~~`GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` não trazem a relação `movie`~~ — **resolvido em D44**, ver seção de revalidação abaixo.
3. Registration (`role`) fixado em `CUSTOMER` no formulário de `/register`, sem seletor de papel exposto ao visitante — `userSchema` exige o campo, mas autocadastro público de `ORGANIZER`/`GATE` não é um caso de uso pedido em lugar nenhum do projeto.

**Frontend — Sprint 3, revalidação pós-D44 (24/08):**

Tarefa de fechamento: puxar `develop` (D44 já mergeado via PR #4), re-executar o roteiro de duas abas para confirmar ausência de regressão, e cobrir os dois efeitos visíveis no frontend das correções do Backend Agent (dado de filme e novo `403`).

- **`movie` exibido**: `Session` (tipo local de resposta de API, `frontend/src/types/session.ts`) ganhou o campo `movie: Movie` (`id`/`tmdbId`/`title`/`synopsis`/`posterUrl`/`createdAt`/`updatedAt`, espelhando o `include` do Prisma). `SessionCard` e o `<h1>` da tela de detalhe (`/sessions/[id]`) agora mostram `session.movie.title`; `SessionCard` também renderiza `session.movie.posterUrl` num `<img>` simples (sem `next/image` — pôster vem de `image.tmdb.org`, host externo, configurar `next.config.mjs#images` ficaria fora do escopo "nenhum arquivo além do necessário" desta tarefa). Poster do seed (`A Origem`) é uma URL real e utilizável — nada faltou para reportar aqui.
- **Novo `403` tratado (`ReservationPanel`)**: antes desta tarefa, qualquer `403` era tratado como problema de auth e redirecionava pro `/login` — errado para o novo caso, porque o usuário já está autenticado corretamente e o problema é a sessão não-publicada, não a sessão dele. Adicionado `extractApiErrorMessage` (parse do corpo JSON de erro do Nest, que `ApiError.message` guarda cru) para distinguir: se a mensagem contém "não publicada", mostra erro específico ("Esta sessão ainda não foi publicada pelo organizador...") e limpa a seleção, sem redirecionar; qualquer outro `403` (ex.: guard de role) continua redirecionando pro login como antes.
- **Sessão rascunho de teste criada manualmente**: não havia sessão `published: false` disponível para testar o caso novo. Criada via `POST /sessions` autenticado como `organizador@cineticket.dev` (seed), reaproveitando `tmdbId: 27205` (já cacheado pelo seed como "A Origem" — evita depender de `TMDB_API_KEY` real). `published` nasce `false` por default do schema (`createSessionSchema` não aceita esse campo na criação). Sessão: `id 037c1256-d91f-4177-8d7a-2dce60f56c9a`, sala "Sala Rascunho QA", capacidade 10. **Mantida no banco de dev** (não removida) — útil para o Backend Agent/QA repetirem o mesmo teste sem precisar recriar; se o Arquiteto preferir um banco de dev "limpo", é seguro deletar (`DELETE FROM "Session" WHERE id = '037c1256-d91f-4177-8d7a-2dce60f56c9a'` mais os `Seat`s associados, nenhuma `Reservation` foi criada para ela).

Roteiro completo re-executado, navegador real (Chrome automatizado), backend local (`develop` puxada, Postgres dev container, seed):

1. **Regressão do roteiro anterior**: seleção sem login → redireciona pro `/login`, zero chamada a `POST /reservations` (confirmado via `GET /sessions/:id/seats`); login com `cliente1@cineticket.dev` → seleção do assento A1 → confirmação → `201`, painel com countdown; segunda aba mostrou A1 mudar de `AVAILABLE` pra `PENDING` sem F5. **Sem regressão.**
2. **Filme visível**: listagem e detalhe mostram "A Origem" (título) e pôster em todas as sessões, incluindo a rascunho.
3. **Caso novo (sessão rascunho)**: seleção do assento A1 na sessão `037c1256-...` → confirmar reserva → UI mostra "Esta sessão ainda não foi publicada pelo organizador — não é possível reservar assentos." (sem redirecionar pro login, sem tela em branco) → confirmado via `read_network_requests` que a chamada real foi `POST /reservations` `403` (não um erro simulado no cliente) → confirmado via `GET /sessions/:id/seats` que nenhum assento da sessão rascunho mudou de status (zero `Reservation` criada).
4. `pnpm --filter frontend lint` e `pnpm --filter frontend build` limpos.

**Achado de processo, não relacionado ao código da tarefa**: o merge de `develop` (que trouxe D44) tinha sido commitado (`b7cb56b`) com marcadores de conflito (`<<<<<<< HEAD` / `=======` / `>>>>>>> develop`) ainda literais dentro de `project-state.md` — o merge não tinha sido resolvido de fato antes de virar commit. Corrigido em commit separado (`851e791`), preservando o conteúdo de ambos os lados (achados do Backend Agent sobre D44 e do Frontend Agent sobre o Sprint 3 original), antes de iniciar o trabalho desta tarefa.

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
- [x] **Sprint 4 — Backend: pagamento simulado (`payments/`), ingresso JWT+QR (`tickets/`), validação de portaria com proteção de concorrência (`POST /tickets/validate`). Ver seção "Backend — Sprint 4" acima. `ticket-single-use.e2e-spec.ts` (bloqueado desde o Sprint 2) ativado e passando.**
- [ ] Sprint 4 — Frontend: tela de pagamento simulado, "Meus ingressos" com QR renderizado client-side (D46), tela de portaria (câmera via `qr-scanner` + fallback manual, D46).
- [ ] Sprint 5 — Testes finais, deploy Railway+Vercel, README, seed, revisão final.
- [ ] **Bloqueadores confirmados do deploy real (Sprint 5), prioridade alta**: risco #9 (`ts-node` não executa `seed.ts` na imagem `node:20-alpine` do Dockerfile) — risco #8 (Dockerfile sem schema/migrations no runtime) já resolvido.
- [ ] Backlog (não bloqueia Sprint 4, mas não é o mesmo bloqueador acima): D35 (retry com backoff no Prisma), `/auth/login` sem `ZodValidationPipe`, D40 (filtro de `published`/dono nos 3 endpoints REST de sessions — impacto de UX confirmado no Sprint 3, ver risco #6), D43 (`POST /auth/register` ausente no backend, prioridade média).

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
12. ~~`GET /sessions`/`GET /sessions/:id` não incluem a relação `movie`~~ — **resolvido (D44, 24/08)**: mesmo item do risco #14 abaixo. Frontend revalidou visualmente: título e pôster aparecem em listagem e detalhe (ver seção de revalidação, Frontend Sprint 3).

13. ~~`POST /reservations` aceitava reserva real em sessão `published: false`~~ — **resolvido (D44, 24/08)**: `ReservationsService.create` recusa com `403 ForbiddenException` antes de qualquer escrita, confirmado por teste e2e (zero linhas de `Reservation` criadas no banco). Mais grave que o item 6 (que é só leitura) porque era venda real de assento — corrigido antes do Sprint 4 iniciar, conforme priorização de D44. **Revalidado pelo Frontend (24/08)** com sessão rascunho real criada via API (`037c1256-...`): UI mostra erro compreensível, sem redirecionar pro login, zero `Reservation` criada — ver seção de revalidação, Frontend Sprint 3.
14. ~~`GET /sessions`/`GET /sessions/:id` sem dado de filme~~ — **resolvido (D44, 24/08)**: relação `movie` incluída via Prisma `include`. `GET /sessions/:id/seats` deliberadamente fora do escopo (é DTO de mapa de assentos, não de sessão). **Revalidado pelo Frontend (24/08)**: título e pôster renderizando em listagem e detalhe.

**Nota de processo — exceção pontual ao D25:** durante a correção do risco #8, o agente de backend identificou conflito entre `CLAUDE.md` raiz (D25 — `.context/` é escopo de sessão de raiz) e a própria tarefa pedindo pra fechar o risco #8 em `project-state.md`. Escalado corretamente antes de agir; usuário autorizou a edição direta nesta tarefa específica, em commit separado. **Isso não reabre D25** — é uma autorização pontual, não precedente. Se editar `.context/` fora da sessão de raiz voltar a acontecer, deve ser escalado de novo, não presumido como já aprovado.

## Decisões pendentes de revisão futura

1. ~~Backfill de D27–D29~~ — resolvido, `decisions-log.md` até D39.
2. Upgrade TypeScript 7 / Prisma 7 — adiado deliberadamente.
3. `/auth/login` sem `ZodValidationPipe` — backlog, não bloqueia Sprint 3 (D39).
4. **D35 (retry com backoff no Prisma) ainda não implementado** — backlog, prioridade antes do Sprint 5, não bloqueia Sprint 3 (D39).
