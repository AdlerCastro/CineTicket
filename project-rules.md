# Project Rules — CineTicket

Regras obrigatórias para qualquer agente (humano ou IA) que escreva código neste repositório. Regras marcadas com 🔒 são não-negociáveis — derivam de constraint técnica ou de critério de avaliação explícito, não de estilo.

---

## 1. Estrutura de pastas (monorepo)

Backend segue o padrão idiomático do NestJS (módulo por domínio, gerado como `nest g module`). Frontend segue **Atomic Design** (Brad Frost) adaptado à convenção de tooling do Shadcn — quatro níveis, não cinco:

- **`ui/`**: componentes Shadcn puros, sem lógica de negócio (`Button`, `Input`, `Badge`, `Spinner`). Cumpre o papel de "atoms" — nomeado `ui/` (não `atoms/`) porque é o destino nativo do CLI do Shadcn; brigar contra essa convenção geraria fricção a cada `npx shadcn add`. Nenhuma pasta `atoms/` separada existe — seria redundante.
- **`molecules/`**: combinação pequena de itens de `ui/` com um propósito único (`SearchBar` = `Input` + `Button`; `SeatCell` = célula clicável do mapa).
- **`organisms/`**: composição de moléculas/`ui` formando uma seção completa e independente (`SeatMap`, `SessionCard`, `TicketQrDisplay`, `NavHeader`).
- **`templates/`**: esqueleto de layout de página, sem dado real — define onde cada organism entra.
- **`app/` (Next.js App Router)**: as rotas reais, que injetam dado nos templates — equivalente a "pages" do Atomic Design.

Ambos os repositórios têm pastas de apoio dedicadas para `constants/`, `enums/`, `types/`, `schemas/` (quando aplicável) e `hooks/` — nunca misturado dentro de módulo/componente de domínio.

```
cineticket/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── movies/           # integração TMDb
│   │   │   ├── sessions/         # sessão de cinema (sala, horário, filme)
│   │   │   ├── seats/            # mapa de assentos
│   │   │   ├── reservations/     # reserva + expiração + concorrência
│   │   │   ├── payments/         # pagamento simulado
│   │   │   ├── tickets/          # geração/validação de ingresso (QR+JWT)
│   │   │   └── gateway/          # WebSocket Gateway do mapa de assentos
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   └── pipes/
│   │   ├── constants/            # valores fixos (ex: tempo de expiração da reserva)
│   │   ├── enums/                # ex: ReservationStatus, UserRole
│   │   ├── types/                # tipos TS que não são DTO nem model Prisma
│   │   ├── config/               # carregamento e validação de env (Zod)
│   │   ├── prisma/                # schema.prisma, migrations, seed.ts
│   │   └── main.ts
│   ├── test/
│   │   ├── unit/
│   │   └── e2e/                  # inclui testes adversariais de concorrência
│   ├── Dockerfile
│   └── CLAUDE.md
│
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router — "pages" do Atomic Design
│   │   │   ├── (public)/         # busca, listagem, detalhe de sessão
│   │   │   ├── (customer)/       # reserva, meus ingressos
│   │   │   ├── (organizer)/      # painel do organizador
│   │   │   └── (gate)/           # portaria
│   │   ├── components/
│   │   │   ├── ui/               # componentes Shadcn puros (tema customizado) — papel de "atoms"
│   │   │   ├── molecules/
│   │   │   ├── organisms/
│   │   │   └── templates/
│   │   ├── hooks/
│   │   ├── constants/
│   │   ├── enums/
│   │   ├── types/                # tipos locais de UI (não duplicar o que já existe em packages/shared)
│   │   ├── lib/                  # client de API, client WebSocket, utils
│   │   └── styles/
│   ├── Dockerfile
│   └── CLAUDE.md
│
├── packages/
│   └── shared/                   # schemas Zod compartilhados (fonte única de validação)
│       └── src/
│           ├── schemas/
│           └── types/
│
├── .context/
│   ├── decisions-log.md
│   ├── project-state.md
│   └── sprint-log/
│
├── docker-compose.yml            # dev
├── docker-compose.test.yml       # test isolado
├── .github/workflows/ci.yml
├── project-description.md
├── project-rules.md
├── agent-ecosystem.md
└── README.md
```

🔒 **Nunca criar arquivo fora do módulo (backend) ou nível atômico (frontend) correspondente.** Se uma funcionalidade não se encaixa em nenhum módulo/nível existente, isso é sinal de que falta um módulo/componente novo — não de que algo deve virar `misc/` ou `utils/` genérico solto na raiz de `src/`.

🔒 **Estado client-side real (se necessário) mora em `stores/`** — ver §7. Não incluído na árvore acima porque, por decisão registrada (D12), Zustand não é usado neste projeto; a pasta só nasce se essa decisão for revista explicitamente pelo Arquiteto.

---

## 2. Nomenclatura

| Elemento                               | Convenção                              | Exemplo                                                           |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Variáveis, atributos, funções, métodos | `camelCase`                            | `seatId`, `reserveSeat()`                                         |
| Classes, enums, interfaces             | `PascalCase`                           | `ReservationService`, `ReservationStatus`, `CreateReservationDto` |
| Componentes React / páginas (frontend) | `PascalCase`                           | `SeatMap.tsx`, `TicketQrCode.tsx`                                 |
| Constantes                             | `SCREAMING_SNAKE_CASE`                 | `RESERVATION_TTL_MINUTES`, `MAX_SEATS_PER_ORDER`                  |
| Arquivos de módulo NestJS              | `kebab-case.tipo.ts`                   | `reservations.service.ts`, `create-reservation.dto.ts`            |
| Hooks                                  | `camelCase` prefixado com `use`        | `useSeatSelection.ts`                                             |
| Rotas Next.js (pastas)                 | `kebab-case`                           | `app/(customer)/my-tickets/`                                      |
| Tabelas do banco (Prisma model)        | `PascalCase` singular                  | `model Reservation`, `model Ticket`                               |
| Colunas do banco                       | `camelCase` (Prisma mapeia automático) | `seatId`, `expiresAt`                                             |
| Variáveis de ambiente                  | `SCREAMING_SNAKE_CASE`                 | `TMDB_API_KEY`, `JWT_TICKET_SECRET`                               |
| Schemas Zod compartilhados             | `camelCase` + sufixo `Schema`          | `createReservationSchema`                                         |

🔒 **DTO de entrada e schema Zod compartilhado devem ter o mesmo nome semântico** (`CreateReservationDto` no backend ↔ `createReservationSchema` em `packages/shared`) — isso é o que garante que os dois lados nunca divergem silenciosamente.

---

## 3. Formatação

Prettier configurado na raiz do monorepo (`.prettierrc`), aplicado a `backend/` e `frontend/` via workspace:

```json
{
  "trailingComma": "all",
  "semi": true,
  "printWidth": 80,
  "tabWidth": 2,
  "singleQuote": true,
  "jsxSingleQuote": true,
  "endOfLine": "auto",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- ESLint configurado em ambos os repos (regras padrão do NestJS/Next.js, sem `import/order` customizado — decisão consciente de não adicionar complexidade extra de lint dado o prazo de 7 dias).
- 🔒 Nenhum PR é aceito com erro de lint — CI bloqueia merge (ver `agent-ecosystem.md`, pipeline).
- Sem `any` implícito ou explícito no TypeScript, exceto em fronteira de biblioteca externa sem tipagem (justificar com comentário `// eslint-disable-next-line` explicando por quê).
- Import absoluto (`@/modules/...`) em vez de relativo profundo (`../../../`) em ambos os repos.
- Funções assíncronas sempre com tratamento de erro explícito — nunca uma `Promise` solta sem `.catch()` ou `try/catch`.

---

## 4. Regras de banco de dados

🔒 **Concorrência de assento (regra central do projeto, não-negociável):**

- Constraint `UNIQUE` no banco em `(sessionId, seatId)` para reservas em estado ativo (`PENDING` ou `PAID`) — a segunda tentativa de reserva do mesmo assento **deve falhar no banco**, nunca só na checagem de aplicação.
- Toda operação de criação de reserva roda dentro de transação (`prisma.$transaction`) com isolamento que impede corrida de leitura-antes-de-escrita.
- Reserva em `PENDING` expira automaticamente após 5 minutos (job/cron ou verificação lazy no momento da leitura — decisão de implementação do Backend Agent, mas o comportamento é obrigatório).

🔒 **Fluxo de reserva não exige autenticação prévia (D32):** a seleção visual de assento (navegação, mapa em tempo real via WebSocket) é acessível a visitante, sem conta. Nenhuma linha `Reservation` é criada nesse momento — é só estado local no frontend (`useState`). `Reservation.customerId` **nunca é nullable**: a linha só passa a existir no momento da confirmação/pagamento, quando o usuário já está autenticado. Login/cadastro é exigido exatamente nessa transição (seleção → confirmação), não antes. Não existe conceito de reserva "de visitante" persistida no banco — a concorrência entre visitantes escolhendo o mesmo assento antes de logar é resolvida pelo erro padrão de concorrência (acima) no momento em que a `Reservation` real é criada.

🔒 **Ingresso:**

- Nunca reutilizável — validação de portaria marca o ingresso como `USED` dentro de transação, e uma segunda tentativa de validação do mesmo código deve ser rejeitada de forma determinística (não é aceitável depender só de checagem de aplicação sem proteção de concorrência aqui também, mesmo sendo caso de uso menos crítico que a reserva).

- Migrations do Prisma versionadas no repositório, nunca `db push` direto em produção.
- `seed.ts` obrigatório e idempotente (pode rodar mais de uma vez sem duplicar dados) — semeia 1 organizador, 2 clientes, 1 portaria, 1 sessão publicada com assentos disponíveis.

---

## 5. Segurança

🔒 Regras obrigatórias, sem exceção:

- Toda rota autenticada usa `Guard` de papel (`@Roles('ORGANIZER' | 'CUSTOMER' | 'GATE')`) — nunca checagem de papel manual dentro do controller/service.
- Nenhuma entidade retorna campo sensível (`password`, `refreshTokenHash`) em response — uso de `class-transformer` (`@Exclude()`) ou `select` explícito no Prisma. Proibido `return user` cru vindo direto do Prisma.
- CORS restrito às origens conhecidas (frontend local + domínio de deploy), nunca `origin: '*'` em produção.
- Validação Zod obrigatória em toda entrada de dado, **nos dois lados** (frontend via RHF+Zod, backend via pipe de validação) — nunca confiar só na validação client-side.
- JWT de ingresso (HS256) assinado com secret próprio, diferente do secret de auth de usuário — comprometer um não compromete o outro.
- Refresh token em cookie `httpOnly`, nunca em `localStorage`.

---

## 6. Testes

🔒 Cobertura mínima obrigatória, independente de "cobertura geral" de código:

1. **Teste de concorrência de assento**: duas requisições simultâneas tentando reservar o mesmo assento — exatamente uma deve suceder, a outra deve falhar de forma controlada (não pode quebrar com erro 500 genérico).
2. **Teste de ingresso duplicado**: validar o mesmo QR duas vezes na portaria — segunda tentativa deve retornar "já utilizado", nunca validar com sucesso.
3. **Teste de expiração de reserva**: reserva em `PENDING` além de 5min não deve mais bloquear o assento para outro cliente.

Testes de CRUD simples (criar/listar/editar) são bem-vindos mas não substituem os três acima — eles são o critério que efetivamente pontua.

---

## 7. Estado no frontend

- Dado vindo do servidor (sessões, filmes, assentos, ingressos) → sempre TanStack Query, nunca duplicado em estado local manual.
- Estado realmente client-side (ex: seleção de assento em andamento antes de confirmar) → `useState`/Context local do componente.
- 🔒 **Zustand não é usado neste projeto** — decisão registrada em `.context/decisions-log.md`. Se durante o desenvolvimento surgir necessidade genuína de estado compartilhado entre telas distantes que TanStack Query + Context não resolvem bem, essa decisão deve ser revisada explicitamente com o Arquiteto antes de adicionar a dependência — não adicionada silenciosamente por um agente de execução.

---

## 8. Interface

🔒 Shadcn UI é obrigatório pelo enunciado, mas **nunca usado com tema default do CLI** — paleta de cor, tipografia e espaçamento customizados desde a configuração inicial do Tailwind (`tailwind.config` com tokens próprios), não ajuste cosmético em cima do template gerado. Ver critério "interface com identidade própria" no `agent-ecosystem.md`.

Dark mode obrigatório, via classe (`dark:` do Tailwind + toggle), não apenas `prefers-color-scheme` sem controle manual.

---

## 9. Git, commits e branches

**Commits — Conventional Commits + emoji semântico.** Formato: `:emoji: tipo: descrição curta no imperativo`.

| Tipo       | Uso                                  | Emoji |
| ---------- | ------------------------------------ | ----- |
| `feat`     | novo recurso                         | ✨    |
| `fix`      | correção de bug                      | 🐛    |
| `docs`     | mudança só em documentação           | 📚    |
| `style`    | formatação, sem mudança de lógica    | 👌    |
| `refactor` | mudança que não altera comportamento | ♻️    |
| `perf`     | melhoria de performance              | ⚡    |
| `test`     | criação/alteração de teste           | 🧪    |
| `build`    | dependências, arquivos de build      | 📦    |
| `ci`       | pipeline, configuração de CI         | 🧱    |
| `chore`    | tarefa administrativa, config        | 🔧    |
| `init`     | primeiro commit do repositório       | 🎉    |
| `revert`   | reversão de commit anterior          | 🔙    |

Exemplos:

```
git commit -m ":sparkles: feat: adiciona guard de papel para portaria"
git commit -m ":bug: fix: corrige race condition na reserva de assento"
git commit -m ":test_tube: test: adiciona teste de concorrência de assento"
```

- Um commit por unidade lógica de mudança — evitar commits gigantes misturando módulos não relacionados.
- Nenhum commit direto na branch principal sem passar pelo pipeline de CI (lint+test+build).

**Branches.** Modelo híbrido: `main` (sempre estável, reflete o que está pronto pra entrega) + `develop` (integração do trabalho em andamento) + branches de apoio de vida curta. Sem `release-*`/`hotfix-*` — Git Flow completo foi avaliado e parcialmente descartado: as branches de release/hotfix são desenhadas para múltiplos devs com produção rodando em paralelo a novos releases, cenário que não existe em projeto solo de 7 dias com uma única entrega final. `develop` mantida por preferência explícita do desenvolvedor (familiaridade e camada extra de segurança antes de tocar `main`); decisão registrada em `.context/decisions-log.md`.

```
main        ← sempre estável, reflete o que será entregue
develop     ← integração do trabalho corrente, todas as features nascem/mergeiam aqui
feature/*   ← criada a partir de develop, mergeada de volta em develop
fix/*
chore/*
```

Convenção de nome, usando os mesmos tipos da tabela de commit acima:

```
feature/seat-map-websocket
fix/reservation-race-condition
chore/docker-compose-setup
```

Branch mergeada em `develop` via PR, depois deletada. `develop → main` só quando houver um estado pronto pra ser considerado "entregável" (ex: fim de cada sprint, e obrigatoriamente antes do prazo final).

🔒 **Nenhum agente de execução (Claude Code CLI) executa `git push`, abre PR ou faz merge.** Push, abertura de PR e merge são feitos manualmente pelo desenvolvedor. Agentes podem criar commits locais como unidade de trabalho, mas a decisão de subir e integrar é sempre humana.

🔒 **Nenhum commit deve conter atribuição de co-autoria a Claude ou a qualquer IA** (ex: trailer `Co-Authored-By: Claude`). Se um agente de execução gerar esse trailer por padrão de ferramenta, ele deve ser removido antes do commit ser criado.

---

## 10. Documentação

- Todo endpoint documentado via Swagger/OpenAPI (decorators do NestJS) — não é opcional, faz parte do critério de deploy avaliado ("documentação da API publicada").
- README na raiz cobre: como subir o projeto (Docker Compose), como configurar a API TMDb (variável de ambiente, onde obter a key), como rodar testes, como acessar dados semeados (credenciais dos 4 usuários de teste), link de deploy.
- Todo artefato de processo gerado com IA (specs, PRD, decisions-log) fica versionado em `.context/` e referenciado explicitamente no README — é critério de nota próprio ("Uso de IA").
