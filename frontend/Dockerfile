# CONTEXTO DE BUILD: este Dockerfile precisa ser buildado a partir da RAIZ
# do monorepo, não de frontend/ — mesma questão já sinalizada para o
# backend. O frontend depende de @cineticket/shared (packages/shared) via
# "workspace:*", e o pnpm precisa enxergar pnpm-workspace.yaml + pnpm-lock.yaml
# (ambos na raiz) para resolver/instalar isso. Se o contexto for frontend/,
# o build falha (COPY não alcança arquivos fora do contexto).
#
# Build correto (a partir da raiz do monorepo):
#   docker build -f frontend/Dockerfile -t cineticket-frontend \
#     --build-arg NEXT_PUBLIC_API_URL=http://localhost:3333 \
#     --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:3333 \
#     .
#
# NEXT_PUBLIC_* é embutido em build-time (Next.js inlina essas variáveis
# nos bundles client-side na hora do `next build`) — não é lido em
# runtime pelo browser. Por isso viram --build-arg aqui, não `docker run -e`;
# mudar a API de destino exige rebuildar a imagem, não só recriar o container.
# (O server.js standalone ainda lê process.env em runtime no lado servidor,
# mas o código client-side já terá o valor antigo embutido no JS gerado.)

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
WORKDIR /workspace

# ---- deps: instala só o necessário para @cineticket/frontend (+ packages/shared) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile --filter "@cineticket/frontend..."

# ---- builder: código-fonte + next build (standalone) ----
FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3333
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/frontend/node_modules ./frontend/node_modules
COPY pnpm-workspace.yaml package.json .prettierrc ./
COPY packages/shared ./packages/shared
COPY frontend ./frontend

WORKDIR /workspace/frontend
RUN pnpm build

# ---- runner: só o output standalone, sem pnpm/node_modules de dev ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# output: 'standalone' + outputFileTracingRoot (ver next.config.mjs) preserva
# a estrutura do monorepo dentro de .next/standalone — server.js fica em
# frontend/server.js, não na raiz do standalone/.
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
CMD ["node", "frontend/server.js"]
