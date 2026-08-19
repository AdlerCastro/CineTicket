# Decisions Log — CineTicket

> Registro cronológico de decisões tomadas com o Arquiteto. Toda decisão nova (inclusive durante execução dos sprints, não só na entrevista inicial) deve ser adicionada aqui **antes** de virar instrução para um agente de execução.

---

## Ciclo 1 — Descoberta (18/08)

**D01 — API externa: TMDb, não Ticketmaster**
Escolhido TMDb + modelagem própria de sessão/sala/assento em vez de Ticketmaster (que já traria local/data/capacidade prontos). Trade-off consciente: mais trabalho de modelagem, menos integração pronta — escolhido deliberadamente por preferência de projeto (cinema) e por dar mais superfície para demonstrar design de dados ao avaliador.

**D02 — Assento único, sem tipos (PCD/casal)**
Cogitado assento com tipo de prioridade/casal, descartado por ser scope creep sem requisito de negócio associado (feature auto-imposta, não pedida no enunciado). Mantido só assento padrão para não competir por tempo com mapa de assentos + concorrência + WebSocket.

**D03 — Ingresso: JWT HS256 + QR, não otplib**
`otplib` descartado por ser ferramenta errada (gera OTP, não assina payload). Adotado JWT assinado HS256 (via `jsonwebtoken`) com secret próprio, diferente do secret de auth — carrega `ticketId` no payload, validado por assinatura antes de consulta ao banco.

**D04 — Pagamento simulado: botão explícito aprovar/recusar**
Escolhido em vez de randômico, para facilitar teste determinístico do avaliador.

**D05 — Reserva expira em 5 minutos em `PENDING`**
Evita assento travado indefinidamente por abandono de checkout, sem violar a regra de não vender duas vezes.

**D06 — Concorrência: constraint UNIQUE + transação, não "banco rápido"**
Correção de premissa inicial (usuário propôs "atualização síncrona rápida" como solução). Velocidade não impede corrida — só constraint de banco + transação garantem. Regra não-negociável.

**D07 — Auth: access token curto (15min) + refresh token (7 dias) em cookie httpOnly**

**D08 — Realtime: WebSocket, não polling**
Escolha de maior risco técnico assumida conscientemente (usuário quer aprender). Marco de decisão fixado no dia 5: se instável, fallback para polling — decisão do Arquiteto, não improviso de agente.

**D09 — Sem upload de mídia própria**
Pôster de filme vem direto da URL do TMDb. Sem S3/Cloudinary/multer no MVP.

**D10 — Isolamento entre organizadores: leitura livre, escrita restrita**
Organizadores veem sessões uns dos outros, mas só editam as próprias. `organizerId` como guard de escrita, não filtro de visibilidade.

**D11 — Monorepo pnpm**
`backend/`, `frontend/`, `packages/shared/` (schemas Zod compartilhados entre RHF+Zod do frontend e DTOs do backend).

**D12 — Zustand descartado**
TanStack Query cobre dado de servidor; estado client-side puro (seleção de assento em andamento) cabe em `useState`/Context local. Adicionar Zustand seria dependência sem função clara. Decisão reabrível só via Arquiteto, não por agente de execução isoladamente.

**D13 — Deploy: Vercel (frontend) + Railway (backend + Postgres)**
Vercel serverless não sustenta WebSocket persistente — por isso backend vai para Railway, que suporta processo long-running.

**D14 — Internacionalização descartada**
Custo de implementação (i18n completo) não compensava o retorno frente ao tempo que tiraria de funcionalidades centrais do escopo. Dark mode mantido — barato, Tailwind/Shadcn já suportam nativamente.

**D15 — Tema Shadcn customizado obrigatório**
Shadcn com tema default é o visual mais reconhecível de "app gerado por IA" — em tensão direta com o critério "identidade própria, sem cara genérica". Tema Tailwind customizado desde a config inicial, não ajuste cosmético depois.

**D16 — Testes obrigatórios são específicos, não CRUD genérico**
Critério de nota ("regras que poderiam quebrar em silêncio") exige teste adversarial de: concorrência de assento, ingresso duplicado, expiração de reserva. QA/Testes Agent separado do Backend Agent justamente para trazer mentalidade de "tentar quebrar" em vez de "confirmar que funciona".

**D17 — Ecossistema de agentes: 4 papéis (Backend, Frontend, QA/Testes, DevOps) + Arquiteto**
Sem agente de Schema (tarefa dentro do fluxo Backend→Frontend), sem agente de Segurança (responsabilidade transversal do Backend), sem agente de Documentação (papel do Arquiteto).

## Ciclo 2 — Regras de desenvolvimento (18/08)

**D18 — Frontend segue Atomic Design (5 níveis: atoms/molecules/organisms/templates/pages)**
Componentes Shadcn tratados como atoms. Backend segue padrão idiomático NestJS (módulo por domínio). Ambos os repos ganham pastas de apoio dedicadas: `constants/`, `enums/`, `types/`, `schemas/` (quando aplicável), `hooks/`.

**D19 — Nomenclatura: camelCase (variável/função/método) · PascalCase (classe/enum/interface/componente/página) · SCREAMING_SNAKE_CASE (constante)**

**D20 — Prettier travado**: `trailingComma: all`, `semi: true`, `printWidth: 80`, `tabWidth: 2`, `singleQuote: true`, `jsxSingleQuote: true`, `endOfLine: auto`, plugin `prettier-plugin-tailwindcss`. Sem Husky/lint-staged (rigor extra não justificado pelo prazo). Sem plugin de ordenação automática de import (`import/order`/`simple-import-sort`) — detalhe considerado excessivo para 7 dias.

**D21 — Commits: Conventional Commits + emoji semântico** (conceito de referência: especificação Conventional Commits + convenção de emoji por tipo de commit — não atribuído a fonte específica por pedido do usuário). Branch: modelo híbrido `main` + `develop` + `feature/*`/`fix/*`/`chore/*`, sem `release-*`/`hotfix-*` (Git Flow completo descartado por ser desenhado para múltiplos devs/releases paralelos; `develop` mantida por preferência explícita do usuário, mais familiaridade e camada extra de segurança).

**D22 — Nenhum agente de execução faz `git push`, abre PR ou faz merge** — só o desenvolvedor, manualmente. Agentes podem commitar localmente.

**D23 — Proibido trailer de co-autoria de IA em commits** (ex: `Co-Authored-By: Claude`). Deve ser removido se a ferramenta gerar por padrão.

**D24 — `agent-instructions.md` renomeado para `CLAUDE.md` em cada repo**
Claude Code CLI carrega automaticamente um arquivo `CLAUDE.md` na pasta de trabalho — renomear garante leitura automática, sem depender de o usuário lembrar de referenciar o arquivo manualmente a cada prompt.

**D25 — Sessões do Claude Code sempre separadas por repositório**
Uma sessão em `backend/`, outra em `frontend/`, nunca uma sessão só alternando entre pastas. Garante que a fronteira de responsabilidade Backend Agent ↔ Frontend Agent (definida em `agent-ecosystem.md`) seja tecnicamente reforçada, não só nominal. Sessão na raiz (`TESTE/`) reservada só para tarefa sem dono único: `packages/shared/`, `docker-compose.yml`, `.github/workflows/`, `.context/`.

## Ciclo 3 — Início de execução (18/08)

**D26 — Setup de `pnpm-workspace.yaml` + `package.json` de raiz feito em sessão de raiz, não pelo Backend Agent**
Ao iniciar Sprint 1, Backend Agent identificou corretamente que `pnpm --filter backend build` (critério de pronto da própria tarefa) depende de workspace root inexistente, e escalou o conflito em vez de criar o arquivo sozinho (comportamento correto conforme CLAUDE.md). Resolução: workspace root é fundação sem dono único (mesma categoria de `packages/shared`/`docker-compose.yml` já coberta por D25) — criado manualmente pelo usuário em sessão de raiz, antes de o Backend Agent retomar a tarefa original sem alteração de escopo.

**D27 — Esqueleto de `package.json`/`tsconfig.json` de todos os workspaces (backend, frontend, packages/shared) consolidado numa única tarefa de raiz**
Segunda escalada do Backend Agent (mesmo padrão de D26, agora para `packages/shared/package.json`) revelou que resolver bloqueio de infraestrutura um de cada vez é reativo — o Frontend Agent bateria no mesmo problema ao iniciar. Esqueleto puro (sem conteúdo de domínio) de todos os `package.json` é criado de uma vez em sessão de raiz; conteúdo real (schemas, módulos, rotas) permanece com o agente dono de cada repo.

**D28 — Postgres de dev roda em container Docker (porta 5434), não no Postgres local da máquina (porta 5433)**
Backend Agent, ao precisar rodar migration+seed, encontrou um cluster Postgres já rodando localmente e perguntou por credenciais dele. Rejeitado: usar banco do host contradiz a decisão já travada de Docker Compose dev/test separados. Primeira tarefa do DevOps Agent (`docker-compose.yml` dev) puxada para frente, criada em sessão de raiz, para destravar o Backend Agent sem violar a stack decidida. `docker-compose.test.yml` permanece como tarefa futura, não bloqueia Sprint 1.

**D29 — Portas fixas: backend em 3333, frontend em 3000**
Frontend mantém a porta padrão do Next.js (3000, sem necessidade de configuração extra). Backend movido do padrão do Nest (3000, colidiria com o frontend) para 3333. Deve ser refletido em `backend/.env.example` (`PORT=3333`), configuração de CORS do backend (origem permitida `http://localhost:3000`), e qualquer client de API no frontend apontando para `http://localhost:3333`.

**D30 — TypeScript e Prisma travados em 5.9 / 6.19, sem upgrade para TS 7 / Prisma 7**
`typescript-eslint` e `ts-jest` ainda não suportam TS 7 no momento da checagem; Prisma 7 quebraria a configuração atual de `package.json#prisma`. Nenhum agente deve atualizar essas dependências por iniciativa própria — revisão futura só se algo bloquear e passar pelo Arquiteto.

**D31 — Estrutura de componentes do frontend: `ui/` substitui `atoms/`, Atomic Design vira 4 níveis**
Frontend Agent escalou conflito real entre `frontend/CLAUDE.md` (que ainda descrevia `components/{ui,features}`, versão pré-D18) e `project-rules.md`/D18 (Atomic Design de 5 níveis com Shadcn dentro de `atoms/`). Resolução: `components/ui/` mantido como destino nativo do CLI do Shadcn (evita fricção em todo `npx shadcn add` futuro) e cumpre o papel de "atoms" — nenhuma pasta `atoms/` separada é criada, seria redundante. Hierarquia final: `ui/` → `molecules/` → `organisms/` → `templates/` → `app/` (rotas). `project-rules.md` e `frontend/CLAUDE.md` atualizados para refletir isso.

**D32 — Navegação e seleção de assento abertas a visitante; login exigido só na confirmação/pagamento**
Usuário propôs inicialmente gatear a seleção de assento atrás de login (junto com perfil, compra e acesso de organizador). Testado e ajustado: gatear a seleção, não só a compra, adiciona fricção exatamente no momento de maior engajamento (a pessoa escolhendo o lugar), contradizendo o próprio objetivo de fluidez. Adotado **Desenho B**: seleção de assento é só estado local no frontend (`useState`, sem Zustand — já coberto por §7), nenhuma `Reservation` é criada no banco até o momento de confirmar. Só na confirmação: (1) checa autenticação, redireciona para login/cadastro se necessário; (2) autenticado, cria a `Reservation` real (`PENDING`, `customerId` preenchido, timer de 5min), protegida pela constraint UNIQUE + transação já definida (regra central do projeto).

Desenho alternativo descartado (**Desenho A** — reserva anônima com `guestToken`, `customerId` nullable, "reivindicada" no login): exigiria migration adicional, lógica nova de "claim" e mais caminhos de erro (token expirado/inválido/já reivindicado), sem necessidade clara no escopo do projeto. Desenho B reaproveita 100% da proteção de concorrência já construída, sem mudança de schema — nenhum campo `guestToken` existe, `customerId` permanece obrigatório em `Reservation`.
