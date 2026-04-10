# vibetradez.com

Jayce Bordelon's production monorepo. Two public services and the infrastructure that runs them, all deployed to a single Digital Ocean droplet behind Traefik.

## What's in here

```
vibetradez.com/   (the repo)
├── jaycebordelon.com/   Personal portfolio + blog (Next.js 16, MDX, Framer Motion)
├── vibetradez.com/      Options trading service
│   ├── server/          Go API (cron jobs, dual-model LLM analysis, Schwab market data, Resend email)
│   ├── client/          Next.js 16 dashboard (live picks, history, model comparison)
│   └── local/           Self-contained Docker stack with seeded Postgres for offline dev
├── .github/workflows/   CI/CD pipeline (sync → lint → build → deploy → cleanup → healthcheck → notify)
├── docker-compose.yml   Production stack: Traefik + portfolio + trading server + trading frontend
└── CLAUDE.md            Project conventions, dev rules, and the dual-model architecture in detail
```

## Two services, one host

| Hostname | Container | Port | Routes |
|---|---|---|---|
| `jaycebordelon.com` / `www.jaycebordelon.com` | `jaycebordelon-com` | 3000 | All paths (Next.js portfolio) |
| `vibetradez.com` / `www.vibetradez.com` | `trading-server` | 8080 | `/api/*`, `/auth/*`, `/admin/*`, `/health` (priority 20) |
| `vibetradez.com` / `www.vibetradez.com` | `trading-frontend` | 3001 | Everything else (priority 10, Next.js trading UI) |
| `jayceb.com` / `www.jayceb.com` | — | — | 301 redirect to `jaycebordelon.com` |

Traefik handles TLS (Let's Encrypt) and routes by hostname + path priority. The legacy `jayceb.com` portfolio domain is kept around as a permanent redirect so existing links don't break.

## Trading service highlights

- **Dual-model trade analysis.** Every weekday morning the Go cron has GPT (OpenAI Responses API via `openai-go/v3`) generate 10 ranked options ideas with multi-round Schwab quote/option-chain function calls and `web_search`. Claude (Anthropic Messages API via `anthropic-sdk-go`, Opus 4.6) then independently scrutinizes each pick with the same Schwab + web search toolset and assigns its own 1-10 score and rationale. The combined score (simple average, Claude as tiebreaker) becomes the final ranking that subscribers see.
- **`/models` page.** Frontend route showing OpenAI vs Anthropic backtested side by side: total P&L, win rate, average return, agreement rate, and a cumulative P&L line chart for each model's hypothetical "top-3 picks per day" portfolio. Backed by `GET /api/model-comparison?range=...`.
- **Configurable models.** `OPENAI_MODEL` and `ANTHROPIC_MODEL` env vars override the defaults baked into `vibetradez.com/server/internal/config/config.go` (`DefaultOpenAIModel`, `DefaultAnthropicModel`). The defaults must be refreshed from the official SDK docs whenever this code is touched — see CLAUDE.md "Model version refresh policy".
- **Live Schwab data.** Authorized via OAuth at `/auth/schwab`; tokens auto-refresh and persist to the `oauth_tokens` table. Quote and option-chain calls feed both the cron analyzer and the live dashboard.
- **Email delivery.** Resend handles morning picks, EOD summaries, weekly reports, and admin announcements. Subscribers stored in Postgres; HTML templates in `vibetradez.com/server/internal/templates/`.
- **Granular `/health`.** One endpoint reports per-service status (database, openai, anthropic, schwab, api) using the actual SDK clients, with latencies. The deployment healthcheck job auto-gates on every service in the response without needing YAML changes per addition.

## Running locally

The trading service has a self-contained Docker stack that boots Postgres + the Go server + the Next.js frontend with realistic seeded data. No production credentials, no external API calls, no Traefik.

```bash
cd vibetradez.com/local
docker compose -f docker-compose.local.yml up --build
```

Then open <http://localhost:3001>. Stub keys are baked into the compose file so the server starts without making real OpenAI / Anthropic / Schwab / Resend calls; the cron jobs are pushed to Sunday so they never fire. The seed data includes ~10 trading days of dual-scored trades and EOD summaries so the dashboard, history page, and `/models` comparison all render with content. See `vibetradez.com/local/README.md` for the full reference.

The portfolio site is just a Next.js app:

```bash
cd jaycebordelon.com
npm run dev
```

## CI / CD

`main` is the deploy branch. Pushing to `main` triggers `.github/workflows/main-pipeline.yml`, which SSHes into the production droplet and runs:

1. **sync** — `git reset --hard origin/main`
2. **lint** — Biome (TS) + gofmt + go vet
3. **build** — `docker compose build --no-cache` for every service
4. **deploy** — `docker rollout` for the web apps (zero-downtime), `docker compose up -d --force-recreate` for background services
5. **cleanup** — `docker system prune -af --volumes` to reclaim disk
6. **healthcheck** — endpoint checks plus granular `/health` parsing; fails on any non-ok service
7. **notify** — email with the pipeline result and commit info

Per the project rules in `CLAUDE.md`: never push directly to `main`, always work on feature branches, and let the human merge.

## Where to look next

- `CLAUDE.md` — full project conventions, env var reference, dual-model details, common operations, and the model version refresh policy
- `vibetradez.com/local/README.md` — running the local Docker stack and inspecting the seeded data
- `docker-compose.yml` — production Traefik routing and the legacy 301 redirects
- `.github/workflows/` — CI/CD pipeline definitions
