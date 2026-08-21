# Sprint 1 — Fundação — Log de execução

> Registro do que foi pedido a cada agente e o que foi feito manualmente pelo usuário. Ação de agente (Claude Code) e ação manual (usuário) são sempre distinguidas explicitamente.

## Setup manual (usuário, antes do Sprint 1)

- Estrutura de pastas inicial de `TESTE/`, `backend/`, `frontend/` criada manualmente.
- `git init`, primeiro commit dos documentos-base (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`) feito manualmente.
- `agent-instructions.md` renomeado para `CLAUDE.md` em `backend/` e `frontend/`, manualmente (D24).

## Passo 1 — Workspace root (sessão de raiz)

**Contexto:** Backend Agent, ao iniciar a tarefa de Sprint 1, identificou que `pnpm --filter backend build` (critério de pronto da tarefa) dependia de `pnpm-workspace.yaml`/`package.json` de raiz inexistentes — escalou em vez de criar sozinho (D26).

**Prompt dado (sessão de raiz):** criar `pnpm-workspace.yaml` (workspaces: backend, frontend, packages/*) + `package.json` mínimo de raiz.

**Resultado (agente):** `pnpm-workspace.yaml` e `package.json` de raiz criados. `.gitignore` criado (não existia). `pnpm install` validado. `pnpm -r list` nesse momento só listava o root — esperado, pois `backend/`, `frontend/`, `packages/shared/` ainda não tinham `package.json` próprio.

## Passo 2 — Esqueleto completo de workspace (sessão de raiz)

**Contexto:** segunda escalada do Backend Agent, mesmo padrão, agora para `packages/shared/package.json` (D27). Decisão: resolver de uma vez para os 3 workspaces, evitando terceira escalada quando o Frontend Agent iniciasse.

**Prompt dado (sessão de raiz):** criar `packages/shared/package.json` + `tsconfig.json`, `backend/package.json` (placeholder), `frontend/package.json` (placeholder). Sem conteúdo de código-fonte.

**Resultado (agente):** os três `package.json` criados, esqueleto puro. `pnpm -r list` passou a listar os 4 workspaces (root, backend, frontend, shared). `.context/project-state.md` atualizado.

## Passo 3 — Postgres containerizado (sessão de raiz)

**Contexto:** Backend Agent, ao precisar rodar `prisma migrate dev` + seed, encontrou um cluster Postgres já rodando localmente (porta 5433) e perguntou por credenciais — rejeitado por contradizer a decisão de Docker Compose dev/test (D28). Primeira tarefa do DevOps Agent (`docker-compose.yml` dev) puxada para frente.

**Prompt dado (sessão de raiz):** criar `docker-compose.yml` com serviço Postgres (porta 5434, evitando conflito com 5433 já ocupada), `backend/.env.example` com `DATABASE_URL` de referência.

**Ação manual (usuário):** Docker Desktop não estava rodando; dockerd de sistema exigia permissão que o usuário não tinha configurada — agente parou e perguntou em vez de usar `sudo` silenciosamente. Usuário subiu o Docker Desktop manualmente.

**Resultado (agente):** `docker-compose.yml` criado e validado (`docker compose ps` saudável, `pg_isready`, `psql SELECT 1` bem-sucedido, porta 5434 confirmada). `.context/project-state.md` atualizado com a `DATABASE_URL` de referência.

## Passo 4 — Tarefa original do Backend Agent (sessão de backend, retomada)

**Prompt dado (retomada, sessão de backend):** usar `backend/.env` apontando para o Postgres containerizado (porta 5434) e prosseguir com a tarefa original de Sprint 1 (schema Prisma completo, migration, seed, config Zod, esqueleto de 9 módulos, schemas Zod compartilhados).

**Resultado (agente):**

- Schema Prisma completo: `User`, `Movie`, `Session`, `Seat`, `Reservation`, `Ticket`.
- Constraint de concorrência implementada como **índice único parcial** (`WHERE status IN ('PENDING','PAID')`, via SQL na migration) em vez de `@@unique` simples do Prisma DSL — decisão técnica do agente, justificada por permitir reabertura de assento após expiração/cancelamento sem violar a constraint. Não altera a regra (D06), só a implementação — dentro do escopo que o agente pode decidir sozinho.
- `seed.ts` idempotente, validado com múltiplas execuções: 1 organizador, 2 clientes, 1 portaria, 1 sessão com 10 assentos.
- `src/config/` com validação de env via Zod.
- 9 módulos NestJS vazios (esqueleto).
- `packages/shared/src/schemas/`: `userSchema`, `createSessionSchema`, `createReservationSchema`.
- `lint`, `test`, `test:e2e`, `build` rodando limpos.
- 7 commits locais, sem trailer de co-autoria de IA.
- `.context/project-state.md` atualizado, incluindo recomendação para o QA Agent testar explicitamente a constraint parcial no Sprint 2.

**Ação manual pendente (usuário):** revisar os 7 commits locais e decidir quando fazer push/PR para `develop` (nenhum agente faz isso, por regra — D22).

## Passo 5 — Dockerfile do backend (sessão de backend)

**Contexto:** Dockerfile estava previsto em `project-rules.md` desde o início, mas nenhuma tarefa até então tinha pedido explicitamente sua criação. Antecipado deliberadamente (não deixado para Sprint 5) por concentrar risco de deploy — bônus significativo depende de deploy funcionando nos 3 componentes.

**Prompt dado (sessão de backend):** criar `backend/Dockerfile` multistage, considerando que o build precisa de acesso a `packages/shared` (dependência interna do workspace pnpm).

**Resultado (agente):** confirmado — build a partir da raiz do monorepo. Dockerfile criado e validado (`docker build` sem erro, container standalone inicia).

## Passo 6 — Ajuste de porta (3333) + README do backend (sessão de backend)

**Contexto:** D29 — backend movido de 3000 (padrão Nest, colidiria com frontend) para 3333.

**Prompt dado (sessão de backend):** configurar `PORT=3333` (main.ts, config/, .env.example), CORS liberando `http://localhost:3000`, criar `backend/README.md` (setup isolado, credenciais dos 4 usuários semeados, scripts, Swagger).

**Resultado (agente):** porta ajustada e validada em log de bootstrap. Swagger configurado em `/docs` (não existia ainda — necessário pro README apontar path real). `backend/README.md` criado. Bug real corrigido no caminho: `tsconfig.json` tinha `incremental: true` + `deleteOutDir: true` do Nest CLI colidindo, mascarando build quebrado — removido `incremental`. Reportado: uma extensão de editor (Console Ninja) alterou `tsconfig.json` nos bastidores durante a sessão, injetando valor inválido — removido pelo agente, usuário avisado a desabilitar a extensão pra esse workspace. TS/Prisma mantidos em 5.9/6.19, sem upgrade (D30).

## Passo 7 — ESLint + Prettier integrado (sessão de raiz)

**Prompt dado (sessão de raiz):** integrar `eslint-config-prettier` + `eslint-plugin-prettier` em backend e frontend, sem reconfigurar `.prettierrc`.

**Resultado (agente):** `.prettierrc` não existia ainda como arquivo (só documentado) — materializado com o conteúdo já especificado em `project-rules.md` §3. Dependências implícitas (`prettier`, `prettier-plugin-tailwindcss`) instaladas. Formatação retroativa de 9 arquivos pré-existentes aplicada num commit `style` separado, sem misturar com a mudança de tooling. Lint validado limpo nos dois repos, com teste negativo confirmando que a integração pega violação de formatação como erro.

## Passo 8 — Sprint 1 do Frontend (sessão de frontend)

**Prompt dado (sessão de frontend):** Next.js (App Router) + TypeScript, Tailwind + Shadcn com tema customizado, dark mode, estrutura Atomic Design, TanStack Query, RHF+Zod consumindo `packages/shared`, `api-client.ts`, 4 rotas de grupo esqueleto.

**Escalada de conflito:** `frontend/CLAUDE.md` (versão desatualizada, pré-D18) descrevia `components/{ui,features}`; `project-rules.md`/D18 pediam Atomic Design de 5 níveis com Shadcn dentro de `atoms/`. Resolvido como **D31**: `components/ui/` mantido como destino nativo do CLI do Shadcn, cumprindo o papel de "atoms" — sem pasta `atoms/` separada. Hierarquia final de 4 níveis: `ui/` → `molecules/` → `organisms/` → `templates/`. `project-rules.md` e `frontend/CLAUDE.md` corrigidos antes de retomar.

**Resultado (agente):** Next.js 14 + TypeScript real, ligado ao workspace (`@cineticket/shared: workspace:*`). Tailwind v3 + Shadcn com tema customizado ("Marquee" — violeta + âmbar, tokens HSL próprios). Dark mode via `next-themes` + toggle funcional. Estrutura Atomic Design de 4 níveis + pastas de apoio. TanStack Query configurado. RHF+Zod instalados, import de `@cineticket/shared` validado. `api-client.ts` + `.env.example` criados. 4 rotas de grupo respondendo (nomes de rota inventados pelo agente como placeholder: `(customer)/my-tickets`, `(organizer)/dashboard`, `(gate)/check-in` — aprovados pelo usuário). Lint e build limpos. 3 commits locais.

**Nota de ambiente:** build fez retry em fontes do Google (`next/font/google`) por instabilidade de rede durante a sessão — funcionou, mas fica registrado como ponto a checar se o ambiente de deploy (Vercel) tiver saída de internet restrita; alternativa seria `next/font/local`.

**Verificação pós-escalada (sem alteração):** checagem posterior (`git show`, `git log --follow`) confirmou que o commit de correção do `frontend/CLAUDE.md` não era duplicado — era a única vez que a estrutura de 4 níveis foi de fato salva no arquivo. Nenhuma correção adicional necessária.

## Decisão de produto durante o Sprint 1 (fora de tarefa de agente) — D32

Discussão entre usuário e Arquiteto (não passou por nenhum agente de execução): UX de navegação sem conta. Decisão final: seleção de assento acessível a visitante, sem criar `Reservation` no banco; login exigido só na confirmação/pagamento, momento em que a `Reservation` real é criada com `customerId` obrigatório (nunca nullable). Desenho alternativo com `guestToken`/`customerId` nullable foi cogitado e descartado. Propagado para `project-rules.md` §4 antes de qualquer agente tocar em código de reserva.

## Nota de segurança de processo (fora do fluxo de sprint)

Números de peso/pontuação de avaliação (informação privilegiada repassada ao Arquiteto) vazaram para 5 arquivos de documentação de processo ao longo do Ciclo 3. Identificados e sanitizados (substituídos por linguagem qualitativa, sem valor numérico). Histórico de commits do GitHub reescrito via `git filter-repo` (Rota A) pelo usuário para remover o dado dos commits antigos, preservando a granularidade do histórico. Uma segunda contaminação foi encontrada e corrigida em `project-rules.md`/`decisions-log.md` na sessão seguinte (conteúdo do Desenho A de reserva por visitante, que nunca deveria ter sido escrito) — corrigida antes de qualquer agente lê-la.

## Pendência aberta para Sprint 2

QA Agent deve testar a constraint de concorrência considerando que é um índice único **parcial**, não um `@@unique` incondicional — o teste precisa cobrir também o caso de reserva expirada/cancelada liberando o assento corretamente para nova reserva, não só o caso de bloqueio simultâneo.

## Passo 5 — Sprint 1 do Frontend Agent (sessão de frontend)

**Contexto:** com backend confirmado em `localhost:3333` e Swagger em `/docs`, iniciada a tarefa equivalente de fundação no frontend.

**Escalada:** conflito real entre `frontend/CLAUDE.md` (versão pré-D18, `components/{ui,features}`) e `project-rules.md`/D18 (Atomic Design de 5 níveis, Shadcn dentro de `atoms/`). Resolvido com o usuário: `ui/` substitui `atoms/` (destino nativo do CLI do Shadcn, evita fricção em todo `npx shadcn add`), hierarquia final de 4 níveis (`ui/molecules/organisms/templates`) — registrado como D31. `project-rules.md` e `frontend/CLAUDE.md` corrigidos.

**Resultado (agente):**

- Next.js 14 (App Router) + TypeScript, ligado ao workspace (`@cineticket/shared: workspace:*`).
- Tailwind v3 + Shadcn com tema customizado ("Marquee": violeta ingresso + âmbar pipoca, tokens HSL próprios) — sem paleta default.
- Dark mode via classe (`next-themes`) + toggle funcional, sem flash.
- Estrutura Atomic Design de 4 níveis + `hooks/constants/enums/types/lib/styles`.
- TanStack Query configurado no layout raiz.
- React Hook Form + Zod instalados; import de `@cineticket/shared` validado.
- `src/lib/api-client.ts` + `.env.example` (`NEXT_PUBLIC_API_URL`, placeholder de WS).
- 4 rotas de grupo respondendo: `/`, `/my-tickets`, `/dashboard`, `/check-in` (nomes de rota definidos pelo agente, aprovados pelo usuário).
- `lint`/`build` limpos. 3 commits locais, sem trailer de co-autoria de IA.

**Nota:** o commit de correção do `frontend/CLAUDE.md` (D31) foi checado numa sessão seguinte após dúvida do usuário sobre possível duplicação — confirmado que não havia versão manual prévia, o commit é a correção real e única, sem divergência a corrigir.

**Ação manual pendente:** revisar commits, decidir quando integrar em `develop`.

## Passo 6 — Prettier integrado ao ESLint (sessão de raiz)

**Prompt dado:** integrar `eslint-config-prettier` + `eslint-plugin-prettier` em `backend/` e `frontend/`, sem reconfigurar `.prettierrc` (já documentado em `project-rules.md` §3).

**Resultado (agente):** integração funcional nos dois repos, validada com teste negativo (violação de formatação proposital pega como erro de lint). Decisões do próprio agente, dentro do escopo esperado: criou `.prettierrc` (só existia documentado, nunca materializado), instalou `prettier`/`prettier-plugin-tailwindcss` (dependências implícitas necessárias), separou formatação retroativa de 9 arquivos pré-existentes num commit `style` próprio.

## Passo 7 — Decisão de produto: UX sem autenticação prévia (conversa com o Arquiteto, sem sessão de execução)

Usuário propôs gatear seleção de assento atrás de login; testado e ajustado para "Desenho B" — seleção de assento é só estado local no frontend, sem `Reservation` no banco até a confirmação; login exigido só nesse momento. Registrado como D32 em `decisions-log.md` e propagado para `project-rules.md` §4.

**Nota de higiene de processo:** nessa mesma edição, uma versão anterior e incorreta do "Desenho A" (com `guestToken`, `customerId` nullable, indevidamente registrada como D32 duplicada + D33) foi encontrada já presente nos arquivos antes da edição correta — removida. Usuário confirmou, comparando arquivo por arquivo, que a versão final em seu repositório está correta e sem essa contaminação.

## Pendência real, ainda aberta

- `backend/Dockerfile` e `frontend/Dockerfile`: prompt gerado (ver histórico), execução não confirmada — tratar como não feito até confirmação.
- `docker-compose.test.yml` e esqueleto de CI (`.github/workflows/`): não iniciado — ver Passo 8, abaixo.

## Pendência aberta para fechar Sprint 1 (DevOps)

`docker-compose.test.yml` e esqueleto de CI (`.github/workflows/ci.yml`) ainda não criados — ver próximo prompt de execução.
