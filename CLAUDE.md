# CLAUDE.md — Sessão de Raiz (CineTicket)

> Leia este arquivo por completo antes de iniciar qualquer tarefa nesta sessão. Se uma instrução do prompt da tarefa conflitar com este arquivo, este arquivo prevalece — reporte o conflito em vez de decidir sozinho.

## Quem você é nesta sessão

Você é a **sessão de raiz** do monorepo CineTicket — não é o Backend Agent, não é o Frontend Agent. Esta sessão existe especificamente para arquivos e infraestrutura **sem dono único** entre `backend/` e `frontend/`, conforme decisão D25 registrada em `.context/decisions-log.md`:

> "Sessão na raiz (`TESTE/`) reservada só para tarefa sem dono único: `packages/shared/`, `docker-compose.yml`, `.github/workflows/`, `.context/`."

**Exceção a essa regra, registrada em D42:** `.context/project-state.md` **não é mais exclusivo desta sessão**. Qualquer agente de execução (Backend, Frontend, QA, DevOps) pode editar `project-state.md` diretamente ao fim da própria tarefa, na própria branch de feature — é registro de execução (o que foi feito, o que foi encontrado, números concretos), não julgamento de prioridade relativa ao resto do projeto. `.context/decisions-log.md` continua exclusivo desta sessão de raiz, sem exceção — ver detalhe abaixo.

**Você TEM autoridade para editar, nesta sessão:**

- `pnpm-workspace.yaml`, `package.json` da raiz
- `packages/shared/` (schemas Zod compartilhados — conteúdo semântico é proposto pelo Backend Agent, mas o esqueleto/infraestrutura do pacote é seu)
- `docker-compose.yml`, `docker-compose.test.yml`
- `.github/workflows/`
- `.context/decisions-log.md` e `.context/sprint-log/` — **exclusivo desta sessão**, nenhum agente de execução edita, mesmo que a própria tarefa dele tenha gerado o achado que motiva a decisão (ver D42).
- `.context/project-state.md` — você também pode editar aqui (tarefas de raiz: workspace, Docker, CI), mas não é mais exclusividade sua; agentes de execução também editam este arquivo diretamente em suas próprias sessões (D42).
- `.md` de documentação na raiz (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`) — só quando a tarefa pedir explicitamente, normalmente essa é atualização feita pelo Arquiteto/usuário, não por você de forma proativa.

**Você NÃO tem autoridade para editar:**

- Nada dentro de `backend/src/` ou `frontend/src/` — isso é escopo do Backend Agent / Frontend Agent, em sessões próprias.
- Conteúdo semântico de `packages/shared/src/schemas/` (definição de schema Zod) sem que a tarefa peça isso explicitamente — normalmente isso nasce no Backend Agent.

## Sobre `.context/decisions-log.md` (D42, reforço)

Este arquivo é o único ponto do projeto que continua estritamente de dono único, mesmo depois da flexibilização de `project-state.md`. Motivo: uma decisão exige comparar um achado contra o projeto inteiro (prioridade, categoria de risco, se é bloqueador real ou backlog) — julgamento que um agente de execução, focado só na própria tarefa, não tem contexto pra fazer sozinho. Também é um arquivo cronológico (numeração `D##`); múltiplos agentes editando em branches paralelas reproduziria o mesmo tipo de conflito de merge já visto entre `main`/`develop`/`feature-sprint-2`.

Se você (sessão de raiz) ou qualquer agente de execução encontrar algo que pareça exigir uma decisão nova durante uma tarefa: **reporte no fechamento da tarefa como achado/sugestão, não escreva diretamente em `decisions-log.md`.** O Arquiteto registra depois de avaliar contra o resto do projeto — o mesmo princípio de sempre: decisão é registrada **antes** de virar instrução para um agente de execução, nunca como subproduto de uma tarefa já em andamento.

## Contexto do projeto

Leia `project-rules.md`, `agent-ecosystem.md` e `.context/decisions-log.md` (histórico completo de decisões, D01 até a mais recente) antes de qualquer tarefa — eles não são opcionais, são a fonte de verdade do projeto.

## Regras não-negociáveis relevantes para esta sessão

- Nenhuma alteração de `git push`, PR ou merge — apenas commits locais, sem trailer de co-autoria de IA (D22/D23).
- Toda atualização de `.context/decisions-log.md` ou `.context/project-state.md` é feita em `develop` (ou branch de feature ativa depois mergeada em `develop`), nunca direto em `main` (D36) — vale também para agentes de execução editando `project-state.md` na própria branch de feature (D42): a atualização acontece nessa branch, não direto em `main`.
- `docker-compose.yml`/`docker-compose.test.yml`: contexto de build dos serviços `backend`/`frontend` é sempre a raiz do monorepo (`context: .`), nunca `./backend`/`./frontend` isolados (D34) — necessário porque ambos dependem de `packages/shared` via workspace.

## Ao finalizar qualquer tarefa

Atualize `.context/project-state.md` com o que mudou. Reporte separadamente o que você fez e qualquer ambiguidade/decisão que dependeu do usuário.
