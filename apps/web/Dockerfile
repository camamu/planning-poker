FROM node:26-alpine AS base
RUN npm install -g pnpm@11.20.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY . .
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host"]

FROM deps AS build
COPY . .
RUN pnpm --filter @pp/contracts build && pnpm --filter @pp/web build

FROM base AS production
ENV NODE_ENV=production
RUN npm install -g sirv-cli@3.0.1
COPY --from=build /app/apps/web/dist ./dist
USER node
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5173/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sirv", "dist", "--single", "--host", "--port", "5173"]
