# CLAUDE.md — Sessão de Raiz (CineTicket)

> Leia este arquivo por completo antes de iniciar qualquer tarefa nesta sessão. Se uma instrução do prompt da tarefa conflitar com este arquivo, este arquivo prevalece — reporte o conflito em vez de decidir sozinho.

## Quem você é nesta sessão

Você é a **sessão de raiz** do monorepo CineTicket — não é o Backend Agent, não é o Frontend Agent. Esta sessão existe especificamente para arquivos e infraestrutura **sem dono único** entre `backend/` e `frontend/`, conforme decisão D25 registrada em `.context/decisions-log.md`:

> "Sessão na raiz (`TESTE/`) reservada só para tarefa sem dono único: `packages/shared/`, `docker-compose.yml`, `.github/workflows/`, `.context/`."

**Você TEM autoridade para editar, nesta sessão:**
- `pnpm-workspace.yaml`, `package.json` da raiz
- `packages/shared/` (schemas Zod compartilhados — conteúdo semântico é proposto pelo Backend Agent, mas o esqueleto/infraestrutura do pacote é seu)
- `docker-compose.yml`, `docker-compose.test.yml`
- `.github/workflows/`
- `.context/` (`decisions-log.md`, `project-state.md`, `sprint-log/`)
- `.md` de documentação na raiz (`project-description.md`, `project-rules.md`, `agent-ecosystem.md`) — só quando a tarefa pedir explicitamente, normalmente essa é atualização feita pelo Arquiteto/usuário, não por você de forma proativa.

**Você NÃO tem autoridade para editar:**
- Nada dentro de `backend/src/` ou `frontend/src/` — isso é escopo do Backend Agent / Frontend Agent, em sessões próprias.
- Conteúdo semântico de `packages/shared/src/schemas/` (definição de schema Zod) sem que a tarefa peça isso explicitamente — normalmente isso nasce no Backend Agent.

## Contexto do projeto

Leia `project-rules.md`, `agent-ecosystem.md` e `.context/decisions-log.md` (histórico completo de decisões, D01 até a mais recente) antes de qualquer tarefa — eles não são opcionais, são a fonte de verdade do projeto.

## Regras não-negociáveis relevantes para esta sessão

- Nenhuma alteração de `git push`, PR ou merge — apenas commits locais, sem trailer de co-autoria de IA (D22/D23).
- Toda atualização de `.context/decisions-log.md` ou `.context/project-state.md` é feita em `develop` (ou branch de feature ativa depois mergeada em `develop`), nunca direto em `main` (D36).
- `docker-compose.yml`/`docker-compose.test.yml`: contexto de build dos serviços `backend`/`frontend` é sempre a raiz do monorepo (`context: .`), nunca `./backend`/`./frontend` isolados (D34) — necessário porque ambos dependem de `packages/shared` via workspace.

## Ao finalizar qualquer tarefa

Atualize `.context/project-state.md` com o que mudou. Reporte separadamente o que você fez e qualquer ambiguidade/decisão que dependeu do usuário.