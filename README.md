# CineTicket

Plataforma de venda de ingressos de cinema — projeto de avaliação técnica, desenvolvido em 7 dias com uso assistido de IA (metodologia documentada em `agent-ecosystem.md`).

Fluxo: Organizador cria sessões a partir de um catálogo de filmes (TMDb) → Cliente reserva assento num mapa em tempo real, paga de forma simulada, recebe ingresso com QR → Portaria valida o ingresso na entrada.

## Estrutura do monorepo

```
cineticket/
├── backend/          NestJS + Prisma + PostgreSQL — API, auth, WebSocket, lógica de negócio
├── frontend/          Next.js + Tailwind + Shadcn UI — interface
├── packages/shared/   Schemas Zod compartilhados entre backend e frontend
├── .context/          Artefatos de processo (decisões, estado, log de execução por sprint)
├── docker-compose.yml Postgres containerizado (dev)
└── *.md (raiz)        Documentação de processo — ver seção abaixo
```

Gerenciador de pacote: **pnpm**, com workspaces (`pnpm-workspace.yaml`) registrando `backend`, `frontend` e `packages/*`.

## Como rodar o projeto

### Pré-requisitos

- Node.js (versão compatível com Next.js 15 / NestJS 10 — ver `.nvmrc` se presente em cada repo)
- pnpm
- Docker + Docker Compose

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir o Postgres (dev)

```bash
docker compose up -d
```

Sobe um Postgres em `localhost:5434` (porta escolhida para não conflitar com uma instância local eventualmente já em uso na 5432/5433).

### 3. Configurar variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` e preencha:

| Variável            | Descrição                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Já vem preenchida apontando para o container Docker (`postgresql://cineticket:cineticket@localhost:5434/cineticket_dev`)                          |
| `JWT_ACCESS_SECRET` | Secret para token de autenticação de usuário                                                                                                      |
| `JWT_TICKET_SECRET` | Secret **próprio e diferente** do de auth, usado para assinar o QR do ingresso                                                                    |
| `TMDB_API_KEY`      | Chave de API do TMDb — criar conta gratuita em [themoviedb.org](https://www.themoviedb.org/) → configurações → API, e gerar uma API Key (v3 auth) |

Repita o processo para `frontend/.env.example` → `frontend/.env` quando o arquivo existir (variáveis de URL da API e do WebSocket).

### 4. Rodar migrations e popular dados de teste

```bash
cd backend
npx prisma migrate dev
pnpm exec ts-node src/prisma/seed.ts
```

O seed popula:

- 1 usuário Organizador
- 2 usuários Cliente
- 1 usuário de Portaria
- 1 sessão de cinema publicada, com assentos disponíveis

_Credenciais dos usuários semeados: ver `backend/README.md` (gerado junto com o seed, não versiona senha em texto plano neste README raiz)._

### 5. Rodar em desenvolvimento

```bash
# terminal 1
cd backend && pnpm dev

# terminal 2
cd frontend && pnpm dev
```

## Deploy

- Backend + PostgreSQL: Railway.
- Frontend: Vercel.
- Links de produção: _preencher ao final do Sprint 5._

## Documentação da API

Swagger/OpenAPI disponível em `/api/docs` (ou equivalente) quando o backend está rodando. _URL exata a confirmar conforme configuração final do backend._

## Sobre o processo de desenvolvimento (uso de IA)

Este projeto foi conduzido com um Arquiteto (Claude, via Claude.ai) orquestrando agentes de execução (Claude Code CLI) especializados por área — Backend, Frontend, QA/Testes, DevOps/Infra. Toda decisão de escopo, arquitetura e trade-off está documentada e versionada:

- **`project-description.md`** — o que é o projeto, para quem, estado atual.
- **`project-rules.md`** — regras de código, nomenclatura, estrutura de pastas, segurança, banco, git.
- **`agent-ecosystem.md`** — papéis dos agentes, fluxo de sprint, sincronização de contexto.
- **`.context/decisions-log.md`** — histórico cronológico de toda decisão tomada, com justificativa.
- **`.context/project-state.md`** — estado funcional atual do projeto.
- **`.context/sprint-log/`** — um arquivo por sprint, com o prompt exato dado a cada agente, o resultado, e o que foi feito manualmente pelo desenvolvedor.

## Papéis de usuário (seed)

| Papel       | O que faz                                                 |
| ----------- | --------------------------------------------------------- |
| Organizador | Cria e gerencia sessões a partir do catálogo TMDb         |
| Cliente     | Navega, reserva assento, paga (simulado), recebe ingresso |
| Portaria    | Valida ingresso na entrada (câmera ou código manual)      |

## Testes

```bash
cd backend
pnpm test        # unitários
pnpm test:e2e    # inclui testes de concorrência de assento, ingresso duplicado, expiração de reserva
```

## Status do projeto

Ver `.context/project-state.md` para o estado atualizado (o que está funcional, pendente, riscos abertos).
