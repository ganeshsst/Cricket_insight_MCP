# Build from monorepo root (Render: Dockerfile Path = apps/cricket-api/Dockerfile, Context = .)
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY libs/database ./libs/database
COPY apps/cricket-api ./apps/cricket-api

# Install only cricket-api + @cricket-ai/database (skips Next/CDK to save build memory)
RUN pnpm install --frozen-lockfile --filter @cricket-ai/cricket-api...

WORKDIR /repo/apps/cricket-api

ENV NODE_ENV=production
ENV CRICKET_API_PORT=8080

EXPOSE 8080

# tsx avoids Node ESM resolution issues in compiled @cricket-ai/database dist output
CMD ["npx", "tsx", "src/main.ts"]
