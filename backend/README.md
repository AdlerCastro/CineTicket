# CineTicket — Backend

API do CineTicket, plataforma de venda de ingressos de cinema: auth, integração TMDb, sessões, assentos, reservas, pagamento simulado, ingressos e validação de portaria.

**Stack:** NestJS + TypeScript + PostgreSQL + Prisma ORM + JWT + Zod. Gerenciador de pacote: pnpm.

## Rodando isoladamente

Pré-requisito: o Postgres de dev containerizado na raiz do monorepo precisa estar no ar (`docker compose up -d` na raiz — ver `docker-compose.yml`).

```bash
# na raiz do monorepo
pnpm install

# em backend/
cp .env.example .env
# preencher DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_TICKET_SECRET,
# TMDB_API_KEY e CORS_ORIGINS conforme o .env.example

pnpm --filter backend prisma:migrate
pnpm --filter backend seed
pnpm --filter backend dev
```

## Porta e documentação

- API sobe em **`http://localhost:3333`** (porta 3000 fica reservada para o frontend).
- Documentação Swagger em **`http://localhost:3333/docs`**.

## Scripts

| Script       | Comando                          | Descrição                              |
| ------------ | --------------------------------- | --------------------------------------- |
| `dev`        | `pnpm --filter backend dev`       | Sobe a API com watch mode               |
| `build`      | `pnpm --filter backend build`     | Build de produção (`nest build`)        |
| `lint`       | `pnpm --filter backend lint`      | ESLint sobre `src/`                     |
| `test`       | `pnpm --filter backend test`      | Testes unitários (Jest, `test/unit/`)   |
| `test:e2e`   | `pnpm --filter backend test:e2e`  | Testes e2e (Jest, `test/e2e/`)          |

## Usuários semeados (dev)

`pnpm --filter backend seed` popula 4 usuários de teste, todos com a mesma senha:

| Papel        | Email                         | Senha      |
| ------------ | ------------------------------ | ---------- |
| Organizador  | `organizador@cineticket.dev`   | `senha123` |
| Cliente 1    | `cliente1@cineticket.dev`      | `senha123` |
| Cliente 2    | `cliente2@cineticket.dev`      | `senha123` |
| Portaria     | `portaria@cineticket.dev`      | `senha123` |

Também é criada 1 sessão publicada (1 filme, sala com 10 assentos disponíveis).

## Estrutura de módulos

Ver `CLAUDE.md` deste repositório para a estrutura obrigatória de pastas, convenções e regras não-negociáveis.
