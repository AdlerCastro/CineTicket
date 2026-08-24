# Sprint 2 — Core Backend — Log de execução

> Registro do que foi pedido a cada agente e o que foi feito manualmente pelo usuário. Ação de agente (Claude Code) e ação manual (usuário) são sempre distinguidas explicitamente.

## Desenvolvimento manual (usuário, antes da revisão)

Módulos `auth/` (module, service, controller, DTO, guards, decorators, strategy) e `movies/` (tmdb.service.ts, movies.service.ts) escritos manualmente pelo usuário, com apoio conversacional do Arquiteto (explicações de NestJS, decorators, JWT, exemplos de código — não registrados em decisions-log por acordo explícito do usuário: "o que eu trouxer aqui" não entra no log, só o que for desenvolvido/corrigido por agente de execução).

## Passo 1 — Revisão de auth/movies + desenvolvimento de sessions/seats/reservations (sessão de backend, branch feature/sprint-2)

**Prompt dado:** revisar o código manual de `auth/`/`movies/` sem presumir correto, corrigir bugs reais encontrados; em seguida desenvolver `sessions/`, `seats/`, `reservations/` completando o Sprint 2 conforme D02/D05/D06/D07/D08/D09/D10/D29/D30/D32/D35.

**Bloqueio intermediário:** agente identificou que `decisions-log.md` só ia até D26 no disco, enquanto a tarefa referenciava D29/D30/D32/D35 — mesmo gap de sincronia já visto antes. Arquivo completo (D01–D36) reenviado pelo Arquiteto; agente releu antes de prosseguir.

**Resultado (agente) — Parte 1, revisão:**

Bugs reais corrigidos, validados rodando a aplicação (não só lint/build):
- `JwtModule.registerAsync` sem `inject: [AppConfigService]` — app crashava no bootstrap.
- `sanitizeUser` vazava `refreshTokenHash` em `/auth/login` (só removia `password`) — violação de regra não-negociável de campo sensível.
- `MoviesModule` com `controllers`/`exports` vazios — rota de busca não existia, `SessionsModule` novo ficaria bloqueado.
- Interfaces do `tmdb.service.ts` não exportadas — build quebrava.
- `findOrCacheMovie` sem tratamento de corrida — corrigido via captura de `P2002`.
- Dependência quebrada no `package.json` removida.
- `tsconfig.json` com `paths` de `@cineticket/shared` apontando pro source, violando `rootDir` — corrigido.
- Guard order (`JwtAuthGuard` antes de `RolesGuard`) já estava correto, nada a fazer.

**Resultado (agente) — Parte 2, desenvolvimento novo:**

- `sessions/`: leitura pública (D32), escrita restrita ao dono (D10), criação atômica de `Session`+`Seat[]` com `findOrCacheMovie` resolvido fora da transação.
- `seats/`: mapa público, status calculado a partir de `Reservation` ativa.
- `reservations/`: criação só `CUSTOMER` autenticado (D32), `expiresAt` +5min (D05), `P2002` da constraint parcial vira `ConflictException`.
- Expiração de reserva `PENDING`: verificação lazy (não job/cron) — decisão de implementação do agente, documentada em `project-state.md`.
- `ZodValidationPipe` genérico novo + `updateSessionSchema` novo em `packages/shared`.

**Validação real, batendo na API contra o Postgres de dev** (não só lint/tsc): sessão gera assentos atomicamente; **concorrência real testada com duas requisições simultâneas no mesmo assento — exatamente uma `201`, outra `409`**; expiração forçada no banco libera o assento corretamente; guards de papel respondendo 401/403 como esperado.

lint, test, test:e2e, build passam limpos. Dois commits locais separados (revisão vs. desenvolvimento novo), sem trailer de co-autoria de IA.

## Ambiguidades resolvidas pelo agente, sem escalar

1. `GET /sessions` sem filtro de `published` — não foi pedido, agente não presumiu regra de produto não solicitada.
2. Layout de assento (`SEATS_PER_ROW = 10`) — decisão de implementação, reversível.
3. `/auth/login` sem `ZodValidationPipe` — pré-existente, fora do checklist explícito, não corrigido para não expandir escopo.
4. D35 (retry com backoff no Prisma) — fora de escopo desta tarefa (não é módulo de domínio), risco registrado para antes do Sprint 5.

## Passo 2 — Reconciliação de branches (main/develop/feature-sprint-2)

**Contexto:** usuário identificou que `main` estava à frente de `develop` — causa raiz: nenhuma instrução anterior especificava em qual branch commitar atualizações de `.context/`/`.md` de raiz (D36, fixado). Merge `main → develop → feature/sprint-2` realizado pelo usuário, com conflito real em `.context/project-state.md` (as duas branches tinham trabalho complementar — uma com Frontend/DevOps/Dockerfiles do Sprint 1, outra com Backend Sprint 2).

**Resolução:** Arquiteto mesclou manualmente o conteúdo dos dois lados do conflito num arquivo único, coerente, sem perda de informação de nenhum dos dois lados. Entregue ao usuário para substituir o arquivo em conflito.

## Pendência real, ainda aberta ao fim do Sprint 2

- **D35 (retry com backoff no Prisma)** — ainda não implementado, risco de crash-loop no deploy Railway, prioridade antes do Sprint 5.
- **`/auth/login` sem `ZodValidationPipe`** — violação pontual de `project-rules.md` §5, não corrigida.
- **`.context/decisions-log.md`** — conflito de merge ainda pendente de resolução pelo usuário (mandado separadamente do `project-state.md`).

## Passo 3 — QA: testes automatizados obrigatórios (sessão de backend, adversarial)

**Prompt dado:** escrever teste e2e para os três casos obrigatórios (concorrência, ingresso duplicado, expiração), usando `Session`/`Seat` descartáveis criadas via Prisma (não reaproveitando a sessão fixa do seed), banco de teste isolado (porta 5435).

**Resultado (agente):**
- **Concorrência de assento — PASSOU, determinístico.** 5 rodadas × 5 clientes concorrentes disputando o mesmo assento, suíte rodada 5 vezes seguidas (125 requisições concorrentes no total): sempre exatamente 1 `201`, resto `409`, nunca `500`, sempre exatamente 1 reserva ativa por assento no banco.
- **Expiração de reserva — PASSOU.** Reserva `PENDING` forçada no passado libera o assento (sweep lazy), nova reserva sucede, reserva antiga permanece `EXPIRED` sem colidir.
- **Ingresso duplicado — BLOQUEADO, corretamente marcado.** `payments/`/`tickets/` ainda vazios (Sprint 4). `describe.skip` com roteiro completo documentado em comentário, sem mock falso criado — decisão certa, evita falsa sensação de cobertura.
- Nenhum bug real de lógica encontrado em `src/` — nada alterado além da infraestrutura de teste (`global-setup.js` reaproveitando `seed.ts` real, `jest-e2e.json` com `moduleNameMapper`).

**Achado fora de escopo, bloqueador de PR:** `pnpm --filter backend lint` falha com 173 erros pré-existentes (aspas duplas violando `singleQuote: true`) em 28 arquivos do Sprint 2 inteiro, nenhum tocado pelo QA. Corretamente não corrigido pelo agente (fora do escopo da tarefa de teste) — mas bloqueia o PR `feature/sprint-2 → develop` já que CI recusa lint com erro (`project-rules.md` §3). Correção rápida (`eslint --fix` em commit `style` isolado) despachada em seguida, antes de abrir o PR de verdade.

## Pendência real, atualizada ao fim do Sprint 2

- **Teste automatizado de concorrência e expiração**: ✅ resolvido, passando de forma determinística em `test/e2e`.
- **Teste de ingresso duplicado**: bloqueado por dependência do Sprint 4 (payments/tickets), corretamente skippado com roteiro documentado.
- **173 erros de lint** (aspas): correção rápida despachada, resultado pendente de confirmação.
- **D35 (retry com backoff no Prisma)** — ainda não implementado, prioridade antes do Sprint 5.
- **`/auth/login` sem `ZodValidationPipe`** — pendente.
- **`.context/decisions-log.md`** — conflito de merge ainda pendente de resolução pelo usuário.