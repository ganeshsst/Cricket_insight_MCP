# Build from monorepo root (Render: Dockerfile Path = apps/mcp-server/Dockerfile, Context = .)
FROM node:22-slim

WORKDIR /app

COPY apps/mcp-server/package.json ./
RUN npm install

COPY apps/mcp-server/ ./

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
