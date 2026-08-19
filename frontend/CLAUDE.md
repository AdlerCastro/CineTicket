# agent-instructions.md — Frontend (CineTicket)

> Leia este arquivo por completo antes de iniciar qualquer tarefa neste repositório. Se uma instrução do prompt da tarefa conflitar com este arquivo, este arquivo prevalece — reporte o conflito em vez de decidir sozinho.

## Contexto do projeto

CineTicket: plataforma de venda de ingressos de cinema. Este repositório (`frontend/`) é responsável por navegação/busca, painel do organizador, fluxo de reserva com mapa de assentos em tempo real, pagamento simulado, "Meus ingressos", e tela de portaria. Consulte `/project-description.md` e `/.context/project-state.md` (raiz do monorepo) para o estado atual antes de começar.

## Stack deste repositório

Next.js (App Router) + TypeScript + TailwindCSS + Shadcn UI + React Hook Form + Zod + TanStack Query. Gerenciador de pacote: **pnpm**.

## Estrutura obrigatória

```
frontend/src/app/{(public),(customer),(organizer),(gate)}/
frontend/src/components/{ui,features}/
frontend/src/hooks/
frontend/src/lib/
frontend/src/styles/
```

`components/ui/` = componentes Shadcn (tema customizado). `components/features/` = componentes específicos de domínio (`SeatMap`, `TicketQrCode`, etc.) — nunca misturar os dois.

## Convenções deste repositório

- Componentes: `PascalCase.tsx`.
- Hooks: `useAlgumaCoisa.ts`.
- Rotas: pastas `kebab-case`.
- Validação de formulário sempre via React Hook Form + schema Zod importado de `packages/shared` — nunca reescrever validação que já existe lá.

## Regras não-negociáveis deste repositório

1. **Tema Shadcn customizado obrigatório** — `tailwind.config` com tokens de cor/tipografia próprios desde o início. Não é permitido usar o tema default gerado pelo CLI do Shadcn; é critério de avaliação explícito ("identidade própria, sem cara de tela gerada").
2. **Dark mode obrigatório**, via classe + toggle manual — não depender só de `prefers-color-scheme`.
3. **Dado de servidor sempre via TanStack Query** — nunca duplicar em `useState` manual paralelo.
4. **Estado client-side puro** (ex: seleção de assento em andamento) via `useState`/Context local. **Zustand não é usado neste projeto** — se você (agente) identificar um caso que pareça precisar, reporte ao Arquiteto antes de adicionar a dependência; não decida sozinho.
5. **Nunca implementar regra de negócio no frontend** que deveria vir do backend (ex: se um assento pode ou não ser reservado) — sempre confiar na resposta da API; validação de frontend é UX, não fonte de verdade.
6. **Git**: nunca execute `git push`, abra PR ou faça merge — isso é feito manualmente pelo desenvolvedor. Você pode criar commits locais, mas nunca inclua trailer de co-autoria de IA (ex: `Co-Authored-By: Claude`) na mensagem de commit.

## O que você PODE tocar

- Tudo dentro de `frontend/src/`.
- `packages/shared/src/schemas/` — apenas leitura/consumo. Se um schema não existir ou estiver desatualizado, reporte ao Backend Agent via Arquiteto — não crie schema paralelo no frontend.

## O que você NÃO PODE tocar

- Nada em `backend/`.
- `docker-compose.yml`, `.github/workflows/` — isso é do DevOps Agent.

## Comandos de validação (rodar antes de considerar tarefa concluída)

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
```

## Ao finalizar uma tarefa

Atualize `.context/project-state.md` com o que passou a funcionar e qualquer risco/decisão pendente. Não deixe essa atualização para outro agente.
