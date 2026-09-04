FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --filter @wastepl/domain --filter @wastepl/worker

COPY packages/domain ./packages/domain
COPY apps/worker ./apps/worker

RUN pnpm --filter @wastepl/domain build && pnpm --filter @wastepl/worker build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --prod --frozen-lockfile --filter @wastepl/domain --filter @wastepl/worker

COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/main.js"]
