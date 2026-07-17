# CricInsights Chat

Greenfield glassy generative-UI chatbot. Single page; Bedrock + MCP tools.

## Run locally

1. Start API + MCP (HTTP):

```bash
# from mono-repo/cricket-ai
pnpm dev:api
# in another terminal — use HTTP so Next can connect
MCP_TRANSPORT=http pnpm dev:mcp
```

2. Configure `apps/cricinsights-chat/.env.local` — copy AWS Bedrock keys from `cricket-ai/.env` plus:

```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=nvidia.nemotron-nano-3-30b
MCP_SERVER_URL=http://localhost:3002/mcp
```

3. Start chat UI:

```bash
pnpm dev:chat
```

Open http://localhost:3003

## Generative UI (v1)

LLM returns `{ text, ui: [{ type, ... }] }` for:

`text` · `player_hero` · `duel_stage` · `bar_chart` · `line_chart` · `radar_chart` · `stats_table` · `podium` · `follow_up_chips`

Player heroes use PNG `imagePath` with drag-to-tilt (no 3D models).
