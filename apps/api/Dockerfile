FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm --filter shared-types build
RUN pnpm --filter api db:generate
RUN pnpm --filter api build

# ─── Run ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache curl openssl
WORKDIR /app

# Copy workspace manifests + lockfile so pnpm can do a frozen prod-only install.
# This guarantees exactly prisma@5.22.0 is used — no npx download at runtime.
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist/

RUN pnpm install --prod --frozen-lockfile

# Copy schema before generate so the runner's node_modules gets a generated client
# (build-stage generate targets build-stage node_modules, not the runner's fresh install)
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
RUN apps/api/node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# Copy compiled application
COPY --from=build /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

# Switch into the api workspace so pnpm-linked binaries and relative paths work
WORKDIR /app/apps/api

COPY --from=build /app/apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

CMD ["sh", "entrypoint.sh"]
