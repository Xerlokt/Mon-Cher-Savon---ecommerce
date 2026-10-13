# Build from the repository root:  docker build -f apps/api/Dockerfile -t mon-cher-savon-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
# Only the API and the packages it depends on; skip git hooks (there is no .git in the image).
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@mon-cher-savon/api..." \
    && pnpm --filter @mon-cher-savon/api exec prisma generate \
    && pnpm --filter @mon-cher-savon/contracts build \
    && pnpm --filter @mon-cher-savon/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/v1/shipping-options').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
