# CineTicket — Frontend

Frontend do CineTicket, plataforma de venda de ingressos de cinema: navegação/busca, painel do organizador, fluxo de reserva com mapa de assentos em tempo real, pagamento simulado, "Meus ingressos" e tela de portaria.

**Stack:** Next.js (App Router) + TypeScript + TailwindCSS + Shadcn UI + React Hook Form + Zod + TanStack Query. Gerenciador de pacote: pnpm.

## Rodando isoladamente

Pré-requisito: backend já rodando em `http://localhost:3333` (ver `backend/README.md`).

```bash
# na raiz do monorepo
pnpm install

# em frontend/
cp .env.example .env
```

Variáveis obrigatórias (ver `.env.example`):

| Variável              | Descrição                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | URL base da API REST do backend (`http://localhost:3333` em dev)                    |
| `NEXT_PUBLIC_WS_URL`  | URL do WebSocket usado pelo mapa de assentos em tempo real (`ws://localhost:3333`) |

```bash
pnpm --filter frontend dev
```

Frontend sobe em **`http://localhost:3000`** (porta 3333 fica reservada para o backend).

## Scripts

| Script  | Comando                     | Descrição                          |
| ------- | ---------------------------- | ----------------------------------- |
| `dev`   | `pnpm --filter frontend dev`   | Sobe o app com hot reload          |
| `build` | `pnpm --filter frontend build` | Build de produção (`next build`)   |
| `lint`  | `pnpm --filter frontend lint`  | ESLint (`next lint`)               |

## Estrutura de pastas

```
frontend/src/app/{(public),(customer),(organizer),(gate)}/
frontend/src/components/{ui,molecules,organisms,templates}/
frontend/src/hooks/
frontend/src/constants/
frontend/src/enums/
frontend/src/types/
frontend/src/lib/
frontend/src/styles/
```

Atomic Design de 4 níveis (D18/D31), adaptado à convenção do Shadcn:

- `components/ui/` — componentes Shadcn puros (tema customizado), sem lógica de negócio. Cumpre o papel de "atoms"; é o destino nativo do CLI do Shadcn, por isso não existe pasta `atoms/` separada.
- `components/molecules/` — combinação pequena de itens de `ui/` com propósito único (ex: `SearchBar`).
- `components/organisms/` — seção completa e independente com lógica de domínio (`SeatMap`, `SessionCard`, `TicketQrDisplay`, `NavHeader`).
- `components/templates/` — esqueleto de layout de página, sem dado real.

Route groups de `app/` (cada um equivale a uma área do produto com público/autenticação próprios):

- **`(public)`** — navegação e busca de sessões abertas a visitante, login e cadastro; seleção de assento também é acessível aqui sem login (D32), autenticação só é exigida na confirmação da reserva.
- **`(customer)`** — área do cliente autenticado: "Meus ingressos", com QR de cada ingresso renderizado client-side.
- **`(organizer)`** — painel do organizador para gestão das próprias sessões.
- **`(gate)`** — tela de portaria para validação de ingresso na entrada da sessão, via leitura de QR por câmera ou fallback manual.

## Dependências não-óbvias

- **`qr-scanner`** — decodificador de QR por câmera usado na tela de portaria (`(gate)/check-in`). Escolhido por rodar em Web Worker e manter bundle pequeno (D46). Acesso à câmera exige **contexto seguro do navegador**: só funciona em HTTPS ou em `localhost`/`127.0.0.1` — em rede local (IP de outra máquina) o navegador bloqueia `getUserMedia` e o scanner não inicializa; use o fallback manual nesse caso.
- **`qrcode.react`** — renderização client-side do QR code de cada ingresso em "Meus ingressos" (`(customer)/my-tickets`).

## Credenciais de teste

Lista completa de usuários semeados (senha e papel) está em `backend/README.md`. Para testar cada área do frontend:

| Área                         | Rota                | Usuário semeado             |
| ---------------------------- | -------------------- | ---------------------------- |
| Cliente (busca, reserva, ingressos) | `/`, `/my-tickets`   | `cliente1@cineticket.dev` (ou `cliente2@cineticket.dev`) |
| Organizador (painel)         | `/dashboard`          | `organizador@cineticket.dev` |
| Portaria (validação de QR)   | `/check-in`           | `portaria@cineticket.dev`    |

## Estrutura de módulos

Ver `CLAUDE.md` deste repositório para a estrutura obrigatória de pastas, convenções e regras não-negociáveis.
