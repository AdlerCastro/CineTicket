# Agent Ecosystem — CineTicket

## Visão geral

4 agentes de execução + 1 Arquiteto. Nenhum papel por inércia — cada um existe por uma fricção específica deste projeto, documentada abaixo. Ver `.context/decisions-log.md` para o histórico completo da decisão.

```
                    ┌─────────────┐
                    │  Arquiteto   │  (esta conversa — não escreve código)
                    └──────┬──────┘
                           │ traduz decisão em prompt
         ┌─────────────────┼─────────────────┬──────────────┐
         ▼                 ▼                 ▼              ▼
   ┌──────────┐     ┌───────────┐     ┌───────────┐  ┌────────────┐
   │ Backend   │     │ Frontend   │     │ QA/Testes │  │ DevOps/    │
   │  Agent    │────▶│  Agent     │     │  Agent     │  │ Infra Agent│
   └──────────┘     └───────────┘     └───────────┘  └────────────┘
   (contrato define        │                 ▲               │
    schema Zod compartilhado)                │ testa TUDO    │ sobe infra
                                              │ (cross-repo)   │ desde dia 1
```

---

## Papéis

### Arquiteto

**Responsabilidade:** traduzir decisão de produto em prompt executável para os agentes; manter contador de rodada/ciclo; garantir que `.context/` (decisions-log, project-state) reflita o estado real antes que o próximo agente comece a trabalhar sobre ele; revisar a cada 10 rodadas.
**Nunca:** escreve código de aplicação.

### Backend Agent — NestJS + Prisma + PostgreSQL

**Dono de:**

- Auth (JWT access+refresh, guards por papel: `ORGANIZER`, `CUSTOMER`, `GATE`)
- Integração TMDb (catálogo de filmes)
- Módulo de sessões (sala, horário, filme, capacidade, preço)
- Módulo de assentos + WebSocket Gateway do mapa em tempo real
- Reserva com constraint UNIQUE + transação (regra de concorrência)
- Pagamento simulado (aprovar/recusar explícito)
- Geração e assinatura de ingresso (JWT HS256 + QR)
- Validação de ingresso na portaria
- DTOs sem campo sensível vazando

**Por que existe como agente dedicado:** concentra o maior risco técnico do projeto (concorrência, WebSocket, assinatura criptográfica). Dividir atenção com UI aumentaria a chance de erro exatamente na parte que mais pesa em segurança/modelagem.

### Frontend Agent — Next.js + Tailwind + Shadcn + TanStack Query

**Dono de:**

- Navegação e busca de sessões
- Painel do organizador (criar/gerenciar sessão a partir do catálogo TMDb)
- Fluxo de reserva + mapa de assentos (consumindo WebSocket do Backend)
- Tela de pagamento simulado
- "Meus ingressos" com QR
- Tela de portaria (câmera + fallback manual de digitação)
- Tema Tailwind customizado + dark mode

**Fronteira com Backend:** consome contrato (schema Zod compartilhado + endpoints documentados), nunca define regra de negócio. Se uma tela precisar de uma regra que o backend não expõe, isso é sinal de gap de contrato — reportar ao Arquiteto, não implementar validação de negócio duplicada no frontend.

### QA/Testes Agent — cross-repo

**Dono de:**

- Teste de concorrência de assento (duas reservas simultâneas do mesmo assento)
- Teste de ingresso usado duas vezes
- Teste de expiração de reserva
- Testes de CRUD complementares (menor prioridade que os três acima)

**Por que existe separado do Backend Agent:** quem escreve a implementação tende a testar o caminho que já sabe que funciona (viés de confirmação). O critério de nota exige explicitamente teste de "regra que poderia quebrar em silêncio" — isso exige mentalidade adversarial (tentar provar que quebra), que funciona melhor vindo de um agente com prompt de "ataque isto" em vez de "confirme isto".

### DevOps/Infra Agent

**Dono de:**

- `docker-compose.yml` (dev) e `docker-compose.test.yml` (test isolado)
- GitHub Actions (lint + test + build) — pipeline dispara em PR para `develop` e para `main`
- Deploy Railway (backend + Postgres) e Vercel (frontend) — a partir de `main`
- Variáveis de ambiente por ambiente, com `.env.example` versionado

**Por que existe separado:** deploy dos três componentes é uma fatia isolada e significativa da avaliação, tem stack própria (YAML, Dockerfile — não TypeScript de aplicação), e historicamente é a parte que fica pra depois e quebra em cima da hora se não tiver dono desde o início do projeto, não só no fim.

## Papéis considerados e descartados

- **Agente de Schema/Shared**: schemas Zod compartilhados nascem no Backend (fonte da verdade dos DTOs) e são só consumidos pelo Frontend. É tarefa dentro do fluxo Backend→Frontend de cada sprint, não trabalho contínuo que justifique agente próprio.
- **Agente de Segurança**: guards, CORS, DTO sem campo sensível e validação dupla são responsabilidade transversal do Backend Agent em toda entrega, não uma feature isolada. Separar criaria a falsa sensação de que só um agente cuida disso.
- **Agente de Documentação/PRD**: os documentos-base nascem direto das decisões da entrevista com o Arquiteto — é papel do Arquiteto manter, não trabalho de execução de código.

---

## Fluxo de sprint

Sprints organizados por dependência técnica, não por dia fixo — mas com marcos de decisão. Todo trabalho de agente acontece em branch `feature/*`/`fix/*`/`chore/*` criada a partir de `develop` (ver `project-rules.md` §9 — modelo híbrido `main`+`develop`). Nenhum agente promove branch para `develop` ou `main` sozinho: push, PR e merge são sempre manuais, feitos pelo desenvolvedor.

**Sprint 1 — Fundação**
DevOps sobe Docker Compose (dev+test) e esqueleto de CI. Backend define schema Prisma completo + `packages/shared` com schemas Zod. Frontend recebe contrato e monta esqueleto de rotas. Todo trabalho em branches próprias a partir de `develop`; usuário integra manualmente ao fim do sprint.

**Sprint 2 — Core Backend**
Auth + guards, integração TMDb, módulo de sessões, módulo de assentos com constraint de concorrência. QA já começa a escrever teste de concorrência em paralelo (não espera o backend "terminar" — testa incrementalmente, sobre o estado mais recente integrado em `develop`).

**Sprint 3 — Core Frontend + Realtime**
Frontend consome sessões/assentos. Backend entrega WebSocket Gateway. Frontend integra mapa em tempo real.
🔒 **Marco de decisão (dia 5):** se WebSocket não estiver estável, Arquiteto decide fallback para polling — decisão registrada em decisions-log, não improviso silencioso do agente.

**Sprint 4 — Fluxo completo + Ingresso**
Pagamento simulado, geração de ingresso (JWT+QR), tela de portaria, validação com todos os retornos (válido/inválido/usado/evento errado).

**Sprint 5 — Testes, deploy, documentação**
QA finaliza os três testes obrigatórios sobre `develop` integrada. DevOps finaliza deploy Railway+Vercel. README completo. Seed de dados. Revisão final do Arquiteto contra o pacote de critérios de avaliação. Merge final `develop → main` (manual) marca o estado entregável.

## Sincronização de contexto

- `.context/decisions-log.md`: toda decisão do Arquiteto (inclusive as tomadas durante execução, não só na entrevista) é registrada aqui **antes** de ser repassada a um agente de execução.
- `.context/project-state.md`: atualizado ao fim de cada sprint — o que está funcional, o que está pendente, riscos abertos. É a fonte que qualquer agente lê antes de começar tarefa nova.
- `.context/sprint-log/`: um arquivo por sprint, com o prompt exato dado a cada agente e o resultado — histórico auditável do processo (relevante para o critério "Uso de IA").
