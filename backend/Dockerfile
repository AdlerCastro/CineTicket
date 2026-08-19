# CONTEXTO DE BUILD: este Dockerfile precisa ser buildado a partir da RAIZ
# do monorepo, não de backend/ — mesma questão já sinalizada para o
# frontend. O backend depende de @cineticket/shared (packages/shared) via
# "workspace:*", e o pnpm precisa enxergar pnpm-workspace.yaml + pnpm-lock.yaml
# (ambos na raiz) para resolver/instalar isso. Se o contexto for backend/,
# o build falha (COPY não alcança arquivos fora do contexto).
#
# Build correto (a partir da raiz do monorepo):
#   docker build -f backend/Dockerfile -t cineticket-backend .
#
# Diferente do frontend (que usa output 'standalone' do Next e por isso
# dispensa node_modules real em runtime), o Nest não tem bundling próprio:
# o dist/ compilado continua usando require() normal do Node. Por isso a
# imagem final aqui precisa preservar node_modules de verdade — inclusive
# a estrutura de symlinks do pnpm (backend/node_modules/@cineticket/shared
# -> ../../../packages/shared, resolvida em relação à raiz do workspace).
# É por isso que WORKDIR permanece /workspace até a imagem final, em vez
# de /app como no frontend: mudar a raiz quebraria os symlinks relativos.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
# Prisma (query engine nativo) precisa de libssl em runtime no Alpine —
# a imagem node:20-alpine não traz openssl por padrão.
RUN apk add --no-cache openssl
WORKDIR /workspace

# ---- deps: instala só o necessário para @cineticket/backend (+ packages/shared) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY backend/package.json ./backend/package.json
RUN pnpm install --frozen-lockfile --filter "@cineticket/backend..."

# ---- builder: código-fonte + build de packages/shared + prisma generate + nest build ----
FROM base AS builder
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/backend/node_modules ./backend/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend

# packages/shared precisa estar compilado (dist/) porque o require() em
# runtime resolve @cineticket/shared pelo campo "main" do seu package.json
# (dist/index.js) — o path alias em tsconfig.json aponta pro source só
# para type-checking em tempo de desenvolvimento, não afeta o JS emitido.
RUN pnpm --filter @cineticket/shared build
# Gerado explicitamente (em vez de confiar no postinstall do @prisma/client)
# porque nesta etapa o schema.prisma só chega depois do COPY backend acima.
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

# ---- runner: imagem final, roda dist/main.js já compilado ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3333

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

COPY --from=builder --chown=nestjs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/shared ./packages/shared
COPY --from=builder --chown=nestjs:nodejs /workspace/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/backend/dist ./backend/dist
COPY --from=builder --chown=nestjs:nodejs /workspace/backend/package.json ./backend/package.json

USER nestjs
EXPOSE 3333
CMD ["node", "backend/dist/main"]
