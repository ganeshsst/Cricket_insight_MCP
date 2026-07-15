# Build from monorepo root:
#   docker build -f apps/cricket-api/Dockerfile -t cricket-api .
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec tsc -p libs/database/tsconfig.lib.json
RUN pnpm exec tsc -p apps/cricket-api/tsconfig.app.json

WORKDIR /repo/apps/cricket-api

ENV NODE_ENV=production
ENV CRICKET_API_PORT=8080

EXPOSE 8080

CMD ["node", "dist/main.js"]
