# Cricket AI

Cricket AI is an [Nx](https://nx.dev) monorepo for a cricket data platform. It provisions AWS infrastructure with CDK (VPC, Aurora PostgreSQL, Flyway migrations) and supports local development with Docker Compose and Postgres.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Local dev                                                       │
│  docker compose → Postgres 16 → Flyway (libs/database/flyway)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AWS (CricketStack-{ENV})                                        │
│                                                                  │
│  VPC 10.10.0.0/16                                                │
│    ├── public subnets (IGW, no NAT)                              │
│    └── private subnets                                           │
│          ├── Aurora PostgreSQL 16 (Serverless v2)                │
│          ├── Migrate Lambda (Docker + Flyway)                    │
│          ├── Waitlist API Lambda (Function URL)                  │
│          └── VPC endpoints (Secrets Manager, Logs, ECR, S3)    │
└─────────────────────────────────────────────────────────────────┘
```

| Project | Path | Role |
|---------|------|------|
| `infra` | `apps/infra` | AWS CDK stack (network, database, migrations, waitlist API) |
| `db-migrate-lambda` | `apps/db-migrate-lambda` | Lambda handler that runs Flyway against Aurora |
| `waitlist-api` | `apps/waitlist-api` | VPC Lambda for waitlist signups in AWS |
| `cricinsights` | `apps/cricinsights` | Next.js web app (CricInsights landing + local waitlist API) |
| `cricket-api` | `apps/cricket-api` | NestJS cricket data APIs + Swagger |
| `mcp-server` | `apps/mcp-server` | MCP tools calling cricket-api |
| `database` | `libs/database` | Shared DB helpers, client, and Flyway SQL migrations |

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+ (`corepack enable` recommended)
- [Docker](https://www.docker.com/) (local Postgres and Flyway)
- [AWS CLI](https://aws.amazon.com/cli/) + credentials (for CDK deploy only)

## Getting started

```bash
pnpm install
cp .env.example .env
```

Edit `.env` if port `5433` is already in use on your machine (see [Local database](#local-database)).

```bash
pnpm typecheck
pnpm build
pnpm db:up
pnpm db:migrate
pnpm dev:web                 # CricInsights at http://localhost:4200
pnpm dev:api                 # Cricket API at http://localhost:3001 (Swagger /docs)
```

## Project structure

```text
Cricket-AI/
├── apps/
│   ├── cricinsights/          # Next.js landing + waitlist API (local)
│   ├── waitlist-api/          # Waitlist Lambda handler (AWS)
│   ├── infra/                 # CDK app (bin/, lib/constructs/)
│   └── db-migrate-lambda/     # Migration Lambda (Docker image)
├── libs/
│   └── database/
│       ├── src/               # Shared constants and helpers
│       └── flyway/sql/        # Versioned SQL migrations
├── docker-compose.yml         # Local Postgres + Flyway
├── .env.example               # Environment variable template
└── nx.json                    # Nx workspace config
```

## Local database

Local Postgres matches the AWS dev database name pattern: `cricket_ai_dev`.

| Command | Description |
|---------|-------------|
| `pnpm db:up` | Start Postgres in Docker |
| `pnpm db:migrate` | Start Postgres (if needed) and run Flyway migrations |
| `pnpm db:down` | Stop containers |
| `pnpm db:reset` | Remove volumes and start a fresh database |
| `pnpm db:ps` | Show container status |
| `pnpm db:logs` | Tail Postgres logs |

Default connection (from `.env.example`):

```text
postgresql://cricketadmin:cricketadmin@localhost:5433/cricket_ai_dev
```

If `5433` is taken, set `DATABASE_PORT` in `.env` (for example `5434`) before running `pnpm db:up`. Docker Compose reads these variables from `.env` automatically.

### Adding a migration

1. Add a new file under `libs/database/flyway/sql/`, for example `V2__add_players.sql`.
2. Run `pnpm db:migrate` locally to validate.
3. Deploy to AWS — the migrate Lambda runs Flyway on stack create/update.

## Environment variables

| Variable | Default | Used for |
|----------|---------|----------|
| `ENV` | `dev` | CDK stack suffix (`CricketStack-dev`) and DB name |
| `REGION` | `ap-southeast-2` | AWS region for CDK deploy |
| `CDK_DEFAULT_ACCOUNT` | from AWS CLI | Target AWS account |
| `AWS_PROFILE` | — | Optional AWS CLI profile |
| `DATABASE_HOST` | `localhost` | Local Postgres host |
| `DATABASE_PORT` | `5433` | Local Postgres host port |
| `DATABASE_NAME` | `cricket_ai_dev` | Database name |
| `DATABASE_USER` | `cricketadmin` | Database user |
| `DATABASE_PASSWORD` | `cricketadmin` | Database password (local only) |
| `DATABASE_URL` | — | Full connection string (optional convenience) |
| `OPENAI_API_KEY` | — | OpenAI API key for future CricInsights AI features |
| `NEXT_PUBLIC_WAITLIST_API_URL` | — | Lambda Function URL in production (omit locally) |

Copy `.env.example` to `.env` for local work. Do not commit `.env`.

## AWS deployment

Configure AWS credentials, then:

```bash
# Preview infrastructure changes
pnpm nx run infra:diff

# Synthesize CloudFormation template
pnpm nx run infra:synth

# Deploy stack (builds migrate Lambda image first)
pnpm nx run infra:deploy
```

Or use root scripts:

```bash
pnpm diff
pnpm synth
pnpm deploy
```

### CDK environment

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `dev` | Environment name (`cricket_ai_{ENV}` database) |
| `REGION` | `ap-southeast-2` | Deployment region |
| `CDK_DEFAULT_ACCOUNT` | — | Set via `aws sts get-caller-identity` or env |

Example:

```bash
export ENV=dev
export REGION=ap-southeast-2
export AWS_PROFILE=your-profile
pnpm deploy
```

### Network design

The VPC uses `10.10.0.0/16` with **public subnets** (Internet Gateway) and **private isolated subnets** for Aurora and the migration Lambda. There is **no NAT gateway**; the Lambda reaches AWS APIs (Secrets Manager, CloudWatch Logs, ECR) through **VPC interface endpoints** to reduce cost and keep traffic private.

## Nx commands

```bash
pnpm nx show projects          # List workspace projects
pnpm nx graph                  # Visualize project graph

pnpm nx run database:build
pnpm nx run database:migrate-local
pnpm nx run db-migrate-lambda:build-image
pnpm nx run waitlist-api:build
pnpm nx run cricinsights:build
pnpm nx run infra:typecheck
pnpm nx run infra:synth
```

## Workspace scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all projects |
| `pnpm typecheck` | Type-check all projects |
| `pnpm synth` | CDK synth (all infra targets) |
| `pnpm diff` | CDK diff |
| `pnpm deploy` | CDK deploy |
| `pnpm dev:web` | Start CricInsights Next.js dev server |

## License

MIT
