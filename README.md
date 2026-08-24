# CineTicket

Plataforma de venda de ingressos de cinema com três papéis — **Organizador** (cria sessões a partir de um catálogo de filmes real, via TMDb), **Cliente** (reserva assento num mapa em tempo real, paga de forma simulada e recebe um ingresso com QR assinado) e **Portaria** (valida o ingresso na entrada, por câmera ou digitação manual, com retorno claro de válido/inválido/já utilizado/evento errado).

Este é um projeto de avaliação técnica (processo seletivo), desenvolvido em 7 dias com uso assistido de IA — metodologia de Arquiteto + agentes especializados documentada em [`agent-ecosystem.md`](./agent-ecosystem.md). A regra central de negócio, válida sob concorrência real (múltiplos clientes disputando o mesmo assento, múltiplas validações do mesmo ingresso), é: **o mesmo assento nunca é vendido duas vezes, o mesmo ingresso nunca é validado duas vezes**. Contexto completo, incluindo por que o escopo é o que é, em [`project-description.md`](./project-description.md).

## Stack e arquitetura

Monorepo **pnpm** (`pnpm-workspace.yaml`), três workspaces:

```
backend/          NestJS + TypeScript + PostgreSQL (Prisma) — API REST + WebSocket
frontend/          Next.js (App Router) + TailwindCSS + Shadcn UI — interface
packages/shared/   Schemas Zod compartilhados (validação de formulário no frontend = DTO no backend)
```

Decisões de arquitetura relevantes (histórico completo e justificativa em [`.context/decisions-log.md`](./.context/decisions-log.md)):

- **WebSocket para o mapa de assentos em tempo real, não polling** (D08) — escolha de maior risco técnico assumida conscientemente, com marco de decisão fixado para eventual fallback. Validado sob carga local (12 clientes) e em produção real no Railway antes de ser fechada como solução definitiva, sem fallback acionado (D41).
- **TMDb como catálogo de filme**, em vez de uma API de evento pronta — modelagem própria de sessão/sala/assento (D01).
- **Ingresso = JWT assinado (HS256) com secret próprio**, diferente do secret de autenticação de usuário, carregando `ticketId` no payload — QR é só a representação visual desse JWT, gerado no cliente (D03).
- **Reserva expira em 5 minutos em `PENDING`**, protegida por constraint `UNIQUE` parcial + transação no Postgres — não por "banco rápido" (D05/D06).
- **Deploy split**: backend + Postgres no Railway (processo long-running, necessário para WebSocket persistente), frontend na Vercel (D13).

## Como rodar localmente

Testado do zero nesta sessão (ambiente resetado — containers recriados, processos de dev reiniciados) antes de documentar; todos os comandos abaixo foram executados e confirmados, não copiados de memória.

**Pré-requisitos:** Node.js 20+, pnpm, Docker + Docker Compose.

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir o Postgres de desenvolvimento

```bash
docker compose up -d
```

Sobe um Postgres 16 em `localhost:5434` (`cineticket-postgres-dev`) — porta não-padrão para não colidir com um Postgres local já em uso na máquina.

### 3. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env.example` já vem com `DATABASE_URL` apontando para o container do passo 2. Preencha `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_TICKET_SECRET` (valores livres em dev, nunca o mesmo valor entre os três) e `TMDB_API_KEY` (conta gratuita em [themoviedb.org](https://www.themoviedb.org/settings/api)). `frontend/.env.example` já aponta para `http://localhost:3333` (API) e `ws://localhost:3333` (WebSocket) — não precisa de chave própria.

### 4. Rodar migrations e popular dados de teste

```bash
pnpm --filter backend prisma:migrate
pnpm --filter backend seed
```

O seed é idempotente — popular 1 organizador, 2 clientes, 1 usuário de portaria, e 1 sessão publicada com 10 assentos.

### 5. Rodar backend e frontend

```bash
# terminal 1
pnpm --filter backend dev     # http://localhost:3333 (Swagger em /docs)

# terminal 2
pnpm --filter frontend dev    # http://localhost:3000
```

Confirmado nesta sessão: `GET http://localhost:3333/docs` → `200`; `GET http://localhost:3000/` e `/dashboard` → `200`.

## Credenciais de teste

4 usuários fixos (organizador, 2 clientes, portaria), todos com a mesma senha — lista completa em **[`backend/README.md`](./backend/README.md#usuários-semeados-dev)** (não duplicada aqui para não ter duas fontes de verdade divergindo com o tempo).

## Como rodar os testes

**Backend:**

```bash
pnpm --filter backend lint
pnpm --filter backend test       # unitários — hoje só há suíte e2e, roda 0 testes sem erro
pnpm --filter backend test:e2e   # concorrência de assento, expiração, pagamento, ingresso duplicado, jornadas completas
```

`test:e2e` precisa do banco de teste isolado (porta 5435, sem persistência) no ar **e** de `DATABASE_URL` exportado explicitamente apontando pra ele antes do comando — a suíte não lê `backend/.env` para isso, por desenho (evita rodar e2e contra o banco de dev por engano):

```bash
docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL="postgresql://cineticket:cineticket@localhost:5435/cineticket_test"
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend test:e2e
```

Confirmado nesta sessão: 12 suítes / 40 testes, todos passando (~13s).

**Frontend:**

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
```

## Deploy

- Backend + PostgreSQL: Railway.
- Frontend: Vercel.
- URLs de produção: _a preencher — ver `.context/project-state.md` para o histórico do smoke-test de validação em produção (D41) enquanto o deploy final não é linkado aqui._

## Estrutura de pastas (resumo)

```
cineticket/
├── backend/           NestJS — módulo por domínio (auth, movies, sessions, seats, reservations, payments, tickets, gateway)
├── frontend/           Next.js — app/{(public),(customer),(organizer),(gate)}, components/{ui,molecules,organisms,templates}
├── packages/shared/    Schemas Zod usados por RHF+Zod no frontend e ZodValidationPipe no backend
├── .context/            decisions-log.md, project-state.md — histórico e estado do projeto (ver abaixo)
├── docker-compose.yml         Postgres de dev (porta 5434)
├── docker-compose.test.yml    Postgres de teste, sem persistência (porta 5435)
└── .github/workflows/ci.yml   CI: lint + test + test:e2e (backend), lint + build (frontend)
```

Estrutura obrigatória e convenções de cada repositório estão documentadas em `backend/CLAUDE.md` e `frontend/CLAUDE.md`.

## Sobre o processo de desenvolvimento (uso de IA)

Este projeto foi conduzido com um Arquiteto (Claude, via Claude.ai) orquestrando agentes de execução (Claude Code CLI) especializados por área — Backend, Frontend, QA/Testes, DevOps/Infra — cada um em sessão própria, com fronteira de responsabilidade reforçada por `CLAUDE.md` em cada repositório. Toda decisão de escopo, arquitetura e trade-off está documentada e versionada:

- [`project-description.md`](./project-description.md) — o que é o projeto, para quem, por que este escopo.
- [`project-rules.md`](./project-rules.md) — regras de código, nomenclatura, estrutura de pastas, segurança, banco, git.
- [`agent-ecosystem.md`](./agent-ecosystem.md) — papéis dos agentes, fluxo de sprint, sincronização de contexto.
- [`.context/decisions-log.md`](./.context/decisions-log.md) — histórico cronológico de toda decisão tomada, com justificativa (dono exclusivo: sessão de raiz/Arquiteto).
- [`.context/project-state.md`](./.context/project-state.md) — estado funcional atual, o que foi feito, achados, riscos abertos.

## Status do projeto

Ver [`.context/project-state.md`](./.context/project-state.md) para o estado atualizado (funcional, pendente, riscos abertos) — é o registro vivo, atualizado ao fim de cada sprint/tarefa relevante.
