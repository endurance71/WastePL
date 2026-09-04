FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @wastepl/domain --filter @wastepl/api

COPY packages/domain ./packages/domain
COPY apps/api ./apps/api

RUN pnpm --filter @wastepl/domain build && pnpm --filter @wastepl/api build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --prod --frozen-lockfile --filter @wastepl/domain --filter @wastepl/api

COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
