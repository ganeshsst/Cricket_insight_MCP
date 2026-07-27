# CricInsights Chatbot

Vercel [AI Chatbot](https://github.com/vercel/chatbot) baseline + Auth0 + Bedrock/MCP generative UI.

## Stack

| Layer | Tech |
|-------|------|
| UI shell | Vercel chatbot (sidebar patterns, Next.js App Router) |
| Auth | Auth0 (`@auth0/nextjs-auth0`) — Google + email |
| Answers | Bedrock + MCP tools + `GenerativeRenderer` |
| History | Nest `cricket-api` → Aurora DB `users` (`/chat-history/*`) |

Legacy app `cricinsights-chat` (port 3003) remains as reference. This app runs on **port 3004**.

## Auth0 dashboard

Add these URLs (comma-separated with your existing 3003 entries):

- Allowed Callback URLs: `http://localhost:3004/auth/callback`
- Allowed Logout URLs: `http://localhost:3004`
- Allowed Web Origins: `http://localhost:3004`

## Env

Copy from `cricinsights-chat/.env.local` into `.env.local` and set:

```env
APP_BASE_URL=http://localhost:3004
CRICKET_API_URL=http://localhost:3001
MCP_SERVER_URL=http://localhost:3002/mcp
AUTH0_DOMAIN=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=...
AWS_* / BEDROCK_MODEL_ID=...
```

Root `cricket-ai/.env` needs `USER_DATABASE_NAME=app` and preferably `USERS_DATABASE_URL` with a **read/write** role for inserts into `"user".app_profiles` / `chats` / `messages` (`auth0_user_id` + UUID FKs).

## Run

```bash
# from mono-repo/cricket-ai
pnpm install
pnpm dev:api
MCP_TRANSPORT=http pnpm dev:mcp
pnpm --filter @cricket-ai/cricinsights-chatbot dev
# or: pnpm dev:chatbot
```

Open http://localhost:3004 → Auth0 login → cricket chat with history sidebar.
