FROM node:20-alpine AS base
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
RUN pnpm --filter api build

# ─── Run ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json .
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules/.ignored_api_modules 2>/dev/null || true

RUN pnpm install --prod --ignore-scripts 2>/dev/null || true

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
