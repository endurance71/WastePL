FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/pwa/package.json ./apps/pwa/

RUN pnpm install --frozen-lockfile --filter @wastepl/domain --filter @wastepl/pwa

COPY packages/domain ./packages/domain
COPY apps/pwa ./apps/pwa

RUN pnpm --filter @wastepl/domain build && pnpm --filter @wastepl/pwa build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/pwa/dist /usr/share/nginx/html
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
