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

**D33 — Secrets dummy no CI (Sprint 1), migração para GitHub Secrets reais é pendência do Sprint 2**
DevOps Agent usou valores dummy inline no workflow (`ci-test-secret-...`) para satisfazer a validação de env (Zod) sem precisar de credencial real — correto para o Sprint 1, que não chama TMDb de verdade nem valida assinatura JWT contra produção. Quando o Sprint 2 trouxer teste de integração real com TMDb (ou qualquer teste que dependa de resposta real da API), os secrets dummy precisam ser substituídos por GitHub Secrets de verdade — senão o CI passa "verde" testando contra algo que não reflete o comportamento real.

**D34 — Contexto de build dos Dockerfiles é a raiz do monorepo (`context: .`), não a pasta de cada serviço**
Confirmado por Backend Agent e Frontend Agent, independentemente: ambos dependem de `@cineticket/shared` via workspace, então o build precisa enxergar a raiz. Implicação registrada para quem for integrar `docker-compose.yml`/Railway: os dois serviços usam `context: .` + `dockerfile: backend/Dockerfile` (ou `frontend/Dockerfile`), nunca `context: ./backend`.

**D35 — Retry com backoff limitado na conexão inicial do Prisma, para evitar crash-loop de deploy**
Backend Agent identificou que `PrismaService.onModuleInit()` conecta de forma síncrona antes de `app.listen()` — sem banco disponível, o processo crasha (não trava "logando a porta", como o critério de pronto original assumia). Risco real para deploy no Railway: se o Postgres não estiver pronto exatamente quando o container backend sobe, vira crash-loop, arriscando o critério de deploy avaliado. Decisão: adicionar retry com backoff limitado (poucas tentativas, espera crescente) só na conexão inicial do Prisma — mudança pequena e local, não uma reescrita de arquitetura de conexão. Reescrever para arquitetura mais robusta (circuit breaker, health check endpoint dedicado, etc.) seria over-engineering para o prazo do projeto.

**D36 — Convenção de branch para commits de `.context/` e `.md` de raiz: sempre em `develop`, nunca direto em `main`**
Causa raiz identificada de `main` ter ficado à frente de `develop`: nenhuma instrução anterior especificava em qual branch o usuário deveria estar ao copiar/commitar os arquivos de contexto gerados pelo Arquiteto — commits de documentação acabaram acontecendo em branches divergentes. Fixado: toda atualização de `.context/decisions-log.md`, `.context/project-state.md`, `.context/sprint-log/` e `.md` de raiz é commitada em `develop` (ou branch de feature ativa, depois mergeada em `develop`). `main` só recebe essas atualizações via merge de `develop → main`, no marco de fim de sprint/entrega — nunca commit direto.

**D37 — Sessão de raiz ganha CLAUDE.md próprio, confirmando autoridade explícita sobre arquivos sem dono único**
Causa raiz de uma escalada de conflito aparente (D25 sendo lido como bloqueio mesmo numa sessão de raiz legítima): `backend/` e `frontend/` sempre tiveram `CLAUDE.md` afirmando "você é este agente, isso você pode tocar" — a raiz nunca teve o equivalente. Sem esse arquivo, uma sessão rodando na raiz não tinha confirmação de que _era_ a sessão autorizada por D25, só enxergava descrições de papel em terceira pessoa em `decisions-log.md`/`agent-ecosystem.md`. Corrigido com `CLAUDE.md` na raiz do monorepo, afirmando explicitamente escopo de autoridade (packages/shared, docker-compose*.yml, .github/workflows/, .context/) e o que permanece fora do escopo (código-fonte de backend/frontend).

## Ciclo 6 — Fechamento do Sprint 2 e priorização do marco WebSocket (21/08)

**D38 — Sprint 2 (Core Backend) formalmente fechado: PR `feature/sprint-2 → develop` mergeado, com as 3 pendências de fechamento confirmadas resolvidas pelo usuário**
As três pendências que impediam declarar o Sprint 2 encerrado foram confirmadas, individualmente, antes de aceitar o merge como "funcionando perfeitamente": (1) correção de lint (173 erros de aspas duplas) aplicada e validada limpa; (2) conflito de merge em `.context/decisions-log.md` resolvido pelo usuário (registrado separadamente do conflito já resolvido em `project-state.md`, ver Sprint 2); (3) pipeline do GitHub Actions confirmado rodando de verdade (não só validação estática/reprodução manual) — fecha em definitivo o risco aberto #4 do `project-state.md`. Pendências que **não** fazem parte deste fechamento, por não serem bloqueadoras do PR, seguem em aberto no backlog: D35 (retry com backoff no Prisma), `/auth/login` sem `ZodValidationPipe`, integração dos Dockerfiles em `docker-compose.yml`/deploy Railway.

**D39 — Sprint 3 (WebSocket Gateway) inicia imediatamente, antes de qualquer tarefa nova de frontend, dado o marco D08 (dia 5) cair amanhã (22/08)**
Contexto: em 21/08 (dia 4), o frontend ainda não consumia a API real de sessions/seats além do esqueleto de rotas do Sprint 1, e o backend não tinha WebSocket Gateway implementado — ou seja, o marco de decisão "WebSocket estável ou fallback para polling" (D08) chegaria amanhã sem nenhum sinal real para decidir contra, virando escolha às cegas em vez de decisão informada. Resolução: Backend Agent implementa o WebSocket Gateway do mapa de assentos **hoje**, como prioridade imediata — à frente de qualquer tarefa adicional de frontend (que depende do Gateway existir para integrar, de qualquer forma). Usuário confirmou margem real de tempo (hoje até 23:59 + fim de semana de desenvolvimento intenso previsto), suficiente para implementar, testar e ainda ter tempo de revisão antes do marco. Backlog do Sprint 2 (D35, ZodValidationPipe, Dockerfiles→compose/Railway) não bloqueia esse início — fica registrado como não esquecido, só reordenado por trás do WebSocket.

**D40 — Gateway WebSocket recusa subscribe em sessão inexistente ou não-publicada (`published: false`); filtro equivalente nos endpoints REST fica pendente, não incluído nesta tarefa**
Sessão possui campo de publicação no schema (`published`, já existente — sem migration necessária), mas os três endpoints REST relevantes (`GET /sessions`, `GET /sessions/:id`, `GET /sessions/:id/seats`) não o utilizam como filtro hoje (ambiguidade já registrada no Sprint 2: "não foi pedido, agente não presumiu regra não solicitada"). Decisão: no Gateway, `handleConnection`/evento de subscribe busca a sessão via `SessionsService` e recusa a inscrição na room se ela não existir ou não estiver `published: true` — sem exceção para o organizador dono (rascunho não vende assento, não precisa de mapa em tempo real). Filtro de `published` nos três endpoints REST **fica de fora desta tarefa**, para não reabrir superfície já testada e mergeada no Sprint 2 na véspera do marco D08. Risco resultante, aceito conscientemente: hoje é possível ler dados de uma sessão rascunho via REST por quem souber o `sessionId` (baixo risco prático — sem usuário real além do avaliador, ID não é exposto em nenhuma listagem pública) — registrado como pendência de segurança para revisão antes do Sprint 5, mesma categoria de prioridade que D35.

## Ciclo 7 — Fechamento do marco WebSocket (22/08)

**D41 — Marco D08 fechado: WebSocket confirmado em produção real, sem fallback para polling**
Smoke-test executado no Railway (projeto real, addon Postgres, deploy a partir de `feature/sprint-3-websocket-gateway`) com 3 clientes WebSocket reais, fora da rede local, contra a URL pública. Resultado: pior caso de latência (não média) entre 554–642ms em 5 execuções — mais lento que o teste local (11–20ms, esperado dado rede real + Postgres remoto), mas sub-segundo e estável; conexão sobreviveu 2.5min ociosa sem cair; desconexão abrupta detectada em ~250ms com reconexão automática em ~600ms, cliente reentrou na room e voltou a receber eventos normalmente. Nenhum sinal de instabilidade. Decisão: WebSocket mantido como solução definitiva de realtime do mapa de assentos — fallback para polling (previsto desde D08 como opção, não obrigação) não é acionado.

Ressalva registrada, não fechada por este smoke-test: validação rodou com 3 clientes (vs. 12 no teste de carga local) — suficiente para confirmar estabilidade de rede/reconexão, mas não repete o mesmo volume de carga simultânea em produção. Sem necessidade de refazer antes do Sprint 5, mas vale repetir com mais clientes uma vez que o gap de deploy abaixo (achado durante este mesmo smoke-test) estiver corrigido.

**Achado bloqueador para o deploy oficial (Sprint 5), descoberto durante este smoke-test — não corrigido nesta tarefa:** `backend/Dockerfile` não copia `backend/src/prisma/` (schema + migrations) para o estágio final de runtime da imagem. O smoke-test só conseguiu rodar `migrate deploy`/`seed` porque o agente, com autorização explícita do usuário, registrou uma chave SSH e injetou os arquivos manualmente dentro do container já rodando — não é um procedimento repetível nem seguro para o deploy real. **Isso significa que, sem correção do Dockerfile, uma tentativa real de deploy no Sprint 5 falha do mesmo jeito que falharia hoje sem a intervenção manual.** Diferente de D35 (mitigação de robustez, não bloqueia o critério de nota por si só), este é bloqueador direto do critério de deploy avaliado — prioridade confirmada antes de qualquer tentativa de deploy oficial, não apenas "backlog desejável". Chave SSH registrada durante o smoke-test deve ser revogada pelo usuário (`railway ssh keys remove`) e a branch de deploy do Railway revertida de `feature/sprint-3-websocket-gateway` para o padrão, já que o propósito da validação foi cumprido.

**D42 — `.context/project-state.md` pode ser editado diretamente por qualquer agente de execução ao fim da própria tarefa; `.context/decisions-log.md` permanece exclusivo do Arquiteto**
Motivado por um caso real: durante a correção do risco #8 (Dockerfile), o Backend Agent identificou conflito entre D25 (CLAUDE.md raiz reserva `.context/` para sessão de raiz) e a própria tarefa pedindo fechamento do risco em `project-state.md` — escalou corretamente, usuário autorizou pontualmente. Formalizado que essa não precisa ser uma exceção caso a caso: `project-state.md` já era atualizado dessa forma na prática desde o Sprint 1 (o próprio cabeçalho do arquivo sempre disse "atualizado... pelo agente que a executou"), sem violação real de D25 até então — D25 nunca pretendeu cobrir esse arquivo com o mesmo rigor do `decisions-log.md`. Distinção mantida: `project-state.md` é registro de execução (o que foi feito, o que foi encontrado, números concretos) — não exige julgamento de prioridade relativa ao resto do projeto, cabe ao agente que executou a tarefa. `decisions-log.md` exige comparar um achado contra o projeto inteiro (prioridade, categoria de risco, se é bloqueador ou backlog) — julgamento que depende de contexto que o agente de execução, focado só na própria tarefa, não tem motivo pra ter. Mantido o princípio do CLAUDE.md raiz ("decisão nova é registrada **antes** de virar instrução para um agente"): agentes continuam reportando achados/sugestões de decisão no fechamento da tarefa, e o Arquiteto registra em `decisions-log.md` — não o agente diretamente. Motivo prático adicional: `decisions-log.md` é cronológico (numeração D##) e múltiplos agentes em branches paralelas escrevendo nele ao mesmo tempo reproduziria o mesmo tipo de conflito de merge já visto no Sprint 2 (`main`/`develop`/`feature-sprint-2` divergindo em `.context/`), com risco maior por ser o arquivo mais sensível a isso.

## Ciclo 7 (continuação) — Achado durante Sprint 3 Frontend (22/08)

**D43 — Ausência de `POST /auth/register` no backend registrada como backlog de prioridade média, não bloqueador do fechamento do Sprint 3**
Frontend Agent, implementando o fluxo de confirmação de reserva (D32: login/cadastro exigido só na confirmação), construiu `/register` completo e funcional no frontend (RHF + `zodResolver(userSchema)` de `packages/shared`, `role` fixado em `CUSTOMER`), mas o submit recebe 404 real — não existe rota de registro no `AuthModule` do backend, só `POST /auth/login`. Tratado corretamente pelo frontend (erro capturado, mensagem "Cadastro indisponível no momento.", sem sucesso fingido, sem escrita client-side por fora da API).

Avaliado contra o escopo real do projeto: `project-description.md` descreve o papel de Cliente sem menção a autocadastro, e `project-rules.md` §10 já prevê README documentando credenciais dos usuários semeados (2 clientes fixos) especificamente para o avaliador testar o fluxo completo sem precisar se cadastrar. D32 mencionou "login/cadastro" ao definir o momento da autenticação (seleção vs. confirmação), não como decisão isolada de que autocadastro público era requisito obrigatório — não há evidência de que essa lacuna bloqueie o critério de avaliação. Decisão: `/auth/register` fica registrado como gap real (não ignorado), prioridade média no backlog — acima de D35/`ZodValidationPipe` (que são robustez, não feature ausente), mas não bloqueia o fechamento do Sprint 3, que segue validado via login com cliente semeado. Implementação (provavelmente barata — reaproveita hash de senha e criação de `User` já existentes no fluxo de login) fica para tarefa isolada, depois do fluxo principal do Sprint 3 concluído.

**D44 — Dois achados do Frontend Agent elevados a correção pré-Sprint 4 (não backlog pré-Sprint 5): reserva real aceita em sessão não-publicada, e resposta de sessions sem dado de filme**
Validação end-to-end do Frontend Agent (duas abas reais, Chrome automatizado) confirmou na prática o que D40 só tinha avaliado como risco de leitura: uma sessão `published: false` **aceita `POST /reservations` com sucesso (201) via REST** — o Gateway WebSocket recusa o `join:session` para rascunho (D40), mas o endpoint de criação de reserva não checa `published` nenhuma. Isso é mais grave do que o risco #6 original (leitura de rascunho) — é venda real de assento de uma sessão que o organizador nunca publicou. Diferente da decisão em D40 (adiar filtro de leitura REST para pré-Sprint 5, por ser baixo risco prático), este achado é elevado para correção **antes do Sprint 4 iniciar**, porque o Sprint 4 (pagamento/ingresso) constrói diretamente sobre reservas criadas neste fluxo — não faz sentido gerar ingresso real para sessão que nunca foi publicada.

Segundo achado, mesma origem: `GET /sessions` e `GET /sessions/:id` não retornam a relação `movie` (título, pôster) — o `MoviesModule`/`findOrCacheMovie` já existem desde o Sprint 2, mas a query de `sessions.service.ts` não inclui essa relação na resposta. Sem isso, a navegação de sessões que o Frontend Agent acabou de implementar mostra sala/data/preço sem identificar o filme — não é polimento de UX, é o catálogo de filmes (D01, decisão central de escopo do projeto) estar efetivamente ausente da experiência real. Também elevado para correção pré-Sprint 4.

Terceiro achado do mesmo relatório — ausência de rota de refresh de access token (D07 implementado pela metade, sem renovação silenciosa) — **permanece no backlog padrão pré-Sprint 5**, mesma categoria de D35/`ZodValidationPipe`: é robustez de sessão, não bloqueia nem corrompe nenhum dado, ao contrário dos dois achados acima.

## Ciclo 8 — Fechamento formal do Sprint 3 (24/08)

**D45 — Sprint 3 (Core Frontend + Realtime) formalmente fechado, nas duas frentes**
Backend: WebSocket Gateway implementado, testado sob carga local (12 clientes) e validado em produção real no Railway (D39–D41, marco D08 fechado). Frontend: consumo real de `GET /sessions`/`GET /sessions/:id`/`GET /sessions/:id/seats` via TanStack Query, cliente WebSocket com atualização de cache em tempo real sem poll, seleção local de assento (D12), fluxo de confirmação com login exigido só na confirmação (D32). Os dois achados elevados por D44 (reserva real aceita em sessão não-publicada; dado de filme ausente) foram corrigidos no backend e revalidados de ponta a ponta pelo Frontend Agent com navegador real: roteiro de duas abas sem regressão, filme visível em listagem/detalhe, tentativa de reserva em sessão rascunho recusada com erro claro na UI e zero `Reservation` criada (confirmado via banco, não só resposta HTTP).

Pendências que **não** bloqueiam este fechamento, permanecem no backlog: risco #6 (filtro de leitura `published`/dono nos 3 endpoints REST, D40), risco #9 (`ts-node`/seed no Dockerfile, bloqueador de deploy real pré-Sprint 5), D43 (`/auth/register` ausente), risco #11 (refresh de access token ausente), D35 (retry Prisma), `/auth/login` sem `ZodValidationPipe`.

**Achado de processo, digno de nota apesar de já corrigido:** o merge de `develop` que trouxe D44 para a branch do Frontend Agent foi commitado com marcadores de conflito Git (`<<<<<<<`/`=======`/`>>>>>>>`) ainda **literais** dentro de `.context/project-state.md` — ou seja, o merge nunca foi de fato resolvido antes de virar commit, só passou porque markdown não é validado por lint/build. Só foi detectado porque o Frontend Agent leu o arquivo antes de iniciar a tarefa (comportamento esperado pelos `CLAUDE.md`) e reconheceu os marcadores. Isso é a manifestação prática do risco que D42 já tinha antecipado para `decisions-log.md` (múltiplos agentes em branches paralelas colidindo no mesmo arquivo) — só que aconteceu em `project-state.md`, o arquivo que D42 liberou para edição paralela. Não justifica reverter D42, mas justifica reforço de processo: `CLAUDE.md` de `backend/` e `frontend/` devem incluir instrução explícita para checar por marcadores de conflito literais em `.context/` logo após qualquer merge/pull de `develop`, antes de assumir que o merge foi limpo.

## Ciclo 8 (continuação) — Escopo do Sprint 4 (24/08)

**D46 — Leitura de QR na portaria via `qr-scanner` (nimiq); design mobile-first e acessibilidade (boas práticas, sem auditoria formal WCAG) entram como requisito a partir do Sprint 4**
Comparado `qr-scanner` contra `html5-qrcode`, `jsQR` e `@zxing/browser`: `qr-scanner` escolhido por manutenção ativa, uso de Web Worker (não bloqueia a thread principal durante decodificação) e bundle menor — não por conflito de `html5-qrcode` com D15 (correção: D15 trata da identidade visual da interface própria do projeto, não de bibliotecas de terceiros usadas como ferramenta funcional; um scanner de câmera com UI própria da lib não seria, por si só, violação de D15 — a escolha por `qr-scanner` se sustenta pelos critérios técnicos, não por esse argumento). UI da tela de portaria (câmera + fallback manual, ambos exigidos por `project-description.md`) é construída sob o tema customizado (D15), consumindo `qr-scanner` só como decoder.

Design responsivo mobile-first e acessibilidade (HTML semântico, labels de formulário, contraste do tema "Marquee" verificado, navegação por teclado nos fluxos principais — sem auditoria formal WCAG nem lib de teste de acessibilidade nova, dado o prazo de 7 dias) passam a ser requisito explícito a partir desta tarefa em diante. Não é aplicado retroativamente às telas já fechadas dos Sprints 1–3 nesta decisão — revisão retroativa fica como item separado, a decidir se vale a pena antes da entrega final.

## Ciclo 8 (continuação) — Fechamento do Sprint 4 (24/08)

**D47 — Ausência de `GET /tickets/mine` (ou equivalente) registrada como backlog, mesma categoria de D43**
Frontend Agent implementou "Meus ingressos" cobrindo o caminho principal (redirecionamento automático pós-pagamento + fallback de "último ingresso" via `localStorage`), mas sem endpoint de listagem no backend, um cliente que troque de dispositivo ou limpe o navegador não tem forma de redescobrir o `ticketId` dos próprios ingressos, mesmo autenticado e sendo o dono real do `Ticket` no banco. Não bloqueia o critério de avaliação (o roteiro completo — reserva→pagamento→QR→validação na portaria — funciona ponta a ponta num fluxo contínuo), mas é peça real faltando fora do caminho feliz. Backlog, mesma prioridade de D43.

**D48 — Sprint 4 formalmente fechado, nas duas frentes**
Backend: `payments/` (pagamento simulado, D04) e `tickets/` (geração JWT+QR D03, validação de portaria com 4 retornos exatos e proteção atômica de concorrência) implementados, testados sob concorrência real (incluindo achado de corrida real em `POST /payments`, corrigido antes do fechamento). Frontend: tela de pagamento com decisão explícita do usuário (D04), "Meus ingressos" com QR renderizado client-side (D46/opção A), tela de portaria com leitura por câmera (`qr-scanner`) + fallback manual, ambos mobile-first e validados em viewport real. Fix pontual (`fix/payment-response-ticket-id`) incluindo `ticketId` na resposta de pagamento, necessário para a navegação pós-pagamento funcionar sem endpoint de listagem.

Verificação de regressão de `isHydrated` (novo campo em `useAuth`, Tarefa 3) conduzida por comparação A/B real contra o código pré-Sprint-4 — sem regressão encontrada em login ou `ReservationPanel`, documentada em `project-state.md` para não precisar ser refeita se `useAuth` for tocado de novo.

Pendências que **não** bloqueiam este fechamento: D47 (listagem de tickets), risco #6 (filtro de leitura `published`/dono), risco #9 (`ts-node`/seed, bloqueador de deploy real pré-Sprint 5), D43 (`/auth/register`), risco #11 (refresh de access token), D35, `/auth/login` sem `ZodValidationPipe`. Sprint 5 (testes finais, deploy, README, revisão) é a próxima e última frente.

## Ciclo 9 — Escopo do Sprint 5 (24/08)

**D49 — Testes de jornada completa (contrato de API) via extensão da suíte e2e existente do backend (Jest+Supertest), não suíte de browser formal**
Padrão identificado ao longo dos Ciclos 8/9: os furos reais encontrados até agora (D44 — reserva aceita em sessão rascunho; Sprint 4 — `ticketId` ausente na resposta de pagamento) eram furos de **contrato de API entre chamadas em sequência**, não de renderização — nenhum dos dois exigia navegador pra ser detectado, só exigia encadear os endpoints na ordem real de uma jornada completa, em vez de testar cada módulo isolado (que é o que a suíte e2e atual já faz bem). Decisão: adicionar specs de jornada completa (`*-journey.e2e-spec.ts`) à suíte já existente em `backend/test/e2e/` — sequência real de chamadas HTTP simulando o fluxo inteiro de cada papel (customer, organizador, portaria), contra o banco de teste real, sem browser. Zero dependência nova, roda no CI já configurado.

Playwright, já usado ad-hoc pelo Frontend Agent como ferramenta de verificação visual em várias tarefas anteriores (não commitado como dependência, não formalizado como suíte), **continua nesse papel** — não vira suíte formal nesta decisão. Não cobre furos puramente visuais (ex.: o achado de contraste do `JÁ_USADO`), mas esses não foram a causa raiz dos furos reais já encontrados. Se sobrar tempo após o Sprint 5, formalizar Playwright fica como item de polimento, não necessidade — decisão reabrível pelo Arquiteto se o padrão de furos mudar.

**D50 — Painel do organizador ausente na interface: prioridade máxima do Sprint 5, à frente de deploy/README**
A Jornada 2 (D49) confirmou que `PATCH /sessions/:id` já aceita `published: true` desde que o endpoint existe — mas nenhuma tarefa de frontend, em nenhum sprint até agora, implementou funcionalidade real em `(organizer)/`: Sprint 3 e Sprint 4 excluíram essa rota explicitamente do escopo, permanecendo apenas o esqueleto do Sprint 1 (rota respondendo 200, sem funcionalidade). Na prática, toda sessão usada em teste até este ponto (incluindo as sessões de teste dos Sprints 3/4) foi criada via API direta, nunca pela interface.

Avaliado contra `project-rules.md` (Funcionalidades, peso 3, maior critério de nota): um dos três papéis do sistema (organizador) ficaria sem interface demonstrável, exigindo terminal/Postman para ser exercitado pelo avaliador — lacuna de severidade muito maior que qualquer achado anterior (D43, D47), que eram detalhes de robustez dentro de fluxos já funcionais. Decisão: construção completa do painel do organizador (criar sessão com busca de filme via TMDb, listar/editar as próprias sessões, publicar/despublicar) entra como prioridade máxima do Sprint 5, antes de deploy real, README, ou qualquer outro item de fechamento. Acompanhada de um roteiro de verificação completo dos dois fluxos principais (customer e organizador), ponta a ponta, usando Playwright só como ferramenta de verificação (mesmo papel já estabelecido em D49, sem virar dependência/suíte formal do projeto), especificamente para checar se alguma tela ficou despercebida em sprints anteriores.

**Fechamento (24/08):** painel do organizador implementado (listagem própria via filtro client-side por `organizerId`, criação com busca real de filme no TMDb, edição, publicar/despublicar) e verificado ponta a ponta — 10 telas percorridas nos dois fluxos completos (customer e organizador), nenhuma quebrada ou esquecida. Verificação mobile real (viewport fixo no contexto do browser, não resize pós-carga) confirmou ausência de overflow horizontal nas 3 telas novas, incluindo o elemento de maior risco (dropdown de busca de filme). Achado real encontrado e corrigido durante essa verificação: header global colava em viewport estreito com nomes de usuário mais longos (`Organizador Demo`) — corrigido e revalidado também contra `Portaria Demo` (mesmo risco, testado proativamente sem ter sido pedido). D50 considerado fechado.

**D51 — Risco #9 (seed no Dockerfile) e D35 (retry do Prisma) fechados**
Risco #9: causa raiz confirmada como comportamento de detecção de formato de módulo do Node 20.20.2 na imagem `node:20-alpine`, específico dessa imagem — o mesmo `seed.ts`, sem alteração, roda normalmente no host e no runner do CI (Node 20 não-Alpine). Descartada a hipótese de dependência desatualizada antes de corrigir. Solução: `nest build` já compila `seed.ts` para `dist/prisma/seed.js` como efeito colateral de compilar todo `src/` — script novo `seed:prod` executa esse JS já compilado via `node` puro, sem `ts-node`/loader nenhum. Nenhuma mudança no `Dockerfile` foi necessária. Validado dentro do container real, dados confirmados via `psql` direto.

D35: `PrismaService.onModuleInit()` agora tenta `$connect()` até 5 vezes com backoff crescente (1s/2s/4s/8s). Testado nos três cenários relevantes: banco indisponível (backoff visível, crash limpo com o erro `P1001` original após esgotar tentativas — não mascarado), banco voltando a ficar disponível no meio do retry (recuperação automática), e boot normal (sem regressão).

Com isso, os dois bloqueadores de deploy real identificados nos Ciclos 7/8 estão fechados — nada mais impede uma tentativa de deploy oficial no Sprint 5.

## Ciclo 9 (continuação) — Pendências pós-deploy real (24/08)

**D52 — Navegação básica (voltar/home/ações do papel) ausente em todas as telas: prioridade do Sprint 5**
Achado do usuário após o primeiro deploy real: nenhuma tela tem forma explícita de voltar, ir pra home, ou acessar as ações principais do próprio papel — cada rota é uma ilha. Avaliado contra `project-rules.md` (Interface/Qualidade, peso 2): navegação básica ausente é o tipo de lacuna perceptível nos primeiros segundos de uso, mais grave em mobile (D46 já é requisito ativo). Escopo definido deliberadamente enxuto, não um sistema de menu novo: header persistente reaproveitando `AuthStatus.tsx` (já existente, já tocado no fix de D50) — link para home, botão de voltar só onde clarifica (ex: meio de um fluxo de checkout, não em toda tela indiscriminadamente), e as 1-2 ações relevantes pro papel logado (customer → "Meus Ingressos"; organizador → "Painel"). Reabertura pontual de telas já fechadas (Sprints 1–4) para adicionar esse header — não é revisão retroativa completa (que D46 já tinha deixado como item separado), é extensão pontual de um componente compartilhado.

**D53 — D47 elevado de backlog para prioridade: listagem real de ingressos do cliente**
O fallback de `localStorage` (Sprint 4) cobre só quem acabou de pagar, na mesma sessão de navegador — não serve como "visualizar meus ingressos" de verdade. Elevado a prioridade pelo usuário após o deploy real. Requer `GET /tickets/mine` novo no backend (ownership via `customerId`, mesmo padrão de `GET /tickets/:id`) antes da tela de listagem no frontend poder existir de verdade — contrato antes de consumo, mesma ordem de sempre.

**D54 — Achado durante D52: estado de reserva `PENDING` perdido ao reabrir checkout, agora mais fácil de disparar por causa da navegação nova**
`ReservationPanel` não reconcilia estado local com uma `Reservation PENDING` já existente no banco ao revisitar `/sessions/[id]` — o mapa mostra o assento corretamente como `PENDING`, mas o painel volta a "escolha um assento", sem countdown nem botão de pagamento, até a reserva expirar sozinha (5min, D05). Não é perda de dado (`Reservation` continua íntegra no banco) — é dessincronia de UI. Relevância elevada porque o link de "voltar pro home" que D52 acabou de adicionar no meio do checkout é justamente a ação que expõe esse cenário, que antes exigia navegação mais deliberada (ex: fechar aba, editar URL manualmente) pra acontecer. **Resolvido**: `GET /reservations/mine/active?sessionId=X` (isolamento garantido no `WHERE` da query, sweep lazy reaproveitado) + reidratação de estado no frontend, validado reproduzindo o bug antes de corrigir.

## Ciclo 10 — Achados pós-release, papel GATE (24/08)

**D55 — Falha em D52: nenhum caminho de navegação até `/check-in`, só URL direta**
D52 assumiu "portaria não precisa de ação extra" sem verificar se existia algum link até a própria tela de trabalho do papel GATE — não existia nenhum. Não é escopo novo, é completar a cobertura que D52 já deveria ter tido. Correção: adicionar o mesmo padrão de link de papel já usado para customer/organizador (`AuthStatus`), agora também para GATE.

**D56 — Histórico de ingressos validados na portaria: feature nova, escopo mínimo aceito**
Solicitado pelo usuário, condicionado a baixo custo de implementação. Rejeitada a opção mais óbvia (lista mantida só em memória do navegador durante a sessão de uso) por não sobreviver a reload/logout — contradiz a própria ideia de "histórico". Como a portaria já seleciona a sessão antes de validar (fluxo D46), a implementação correta de custo equivalente é backend filtrando `Ticket` com `status: USED` por `sessionId`, reaproveitando o mesmo padrão de query já usado em `GET /tickets/mine` (D53) — persistente de verdade, sem necessidade de rastrear "qual operador de portaria validou" (não solicitado).

**D57 — Risco #6 corrigido no backend (filtro `published`/dono + auth opcional); regressão real encontrada e pendente de correção no frontend antes de fechar**
`GET /sessions`, `GET /sessions/:id`, `GET /sessions/:id/seats` agora filtram sessão `published: false` pra quem não é o organizador dono (404, não 403 — sem confirmar existência pra quem não deveria saber, mesmo raciocínio de D40). Auth opcional implementada (não quebra D32 — visitante anônimo continua navegando sessões publicadas sem exigir login). `ZodValidationPipe` aplicado em `/auth/login` (schema novo mínimo em `packages/shared`).

Verificação obrigatória pedida ao agente confirmou, por leitura real do código (não suposição): `useSessions.ts`, `useSession.ts` e `useSeatMap.ts` chamam `apiClient` sem header de `Authorization` — os outros 8 pontos do frontend que usam auth passam o header explicitamente, esses 3 não. Consequência real, já confirmada: `useMySessions.ts` (painel do organizador, D50), que filtra client-side por `organizerId`, vai parar de mostrar os próprios rascunhos assim que este backend for pra produção — a chamada anônima só recebe sessões `published: true`. **Resolvido**: os 3 hooks corrigidos para enviar token quando autenticado (achado adicional durante a correção — corrida de hidratação de auth, gateada em `isHydrated`); home pública filtra `published: true` explicitamente, independente de login, pra rascunho do organizador continuar visível só no painel (D50), não na home geral.

**D58 — Risco #11 (refresh de access token) implementado por decisão explícita do usuário, apesar do impacto avaliado como majoritariamente de UX**
Avaliação de risco antes da decisão: nenhum dado em jogo (`Reservation`/`Ticket` têm ciclo de vida próprio no backend, independente do token do frontend), sem superfície de ataque nova (refresh token já existe como cookie `httpOnly` desde D07, só sem endpoint pra consumir), expiração já tratada sem crash (401/403 redireciona pro login). Risco real limitado a UX — sessão derrubando usuário no meio de uso contínuo além de 15min. Recomendação inicial do Arquiteto foi não implementar, dado o histórico de `useAuth`/`auth/` serem território já testado com uma regressão real investigada antes (verificação de `isHydrated`). Usuário optou por implementar mesmo assim, para não deixar pendência conhecida em aberto. Mesmo rigor de verificação de regressão da vez anterior aplicado nesta implementação, dado o histórico do arquivo.
