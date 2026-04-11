# Personal Monorepo

Jayce Bordelon's production monorepo. All services are deployed to a single Digital Ocean droplet running Docker Compose behind Traefik as a reverse proxy with automatic Let's Encrypt TLS.

## Architecture

**Single-server monolithic deployment.** Traefik routes incoming HTTPS requests to the correct container by hostname and path:

- `jaycebordelon.com` / `www.jaycebordelon.com` → Next.js portfolio (port 3000)
- `vibetradez.com` → `/api/*`, `/auth/*`, `/admin/*`, `/health` → Go API server (port 8080, priority 20)
- `vibetradez.com` → everything else → Next.js trading frontend (port 3001, priority 10)

## Project Structure

```
personal-monorepo/
├── jaycebordelon.com/           # Personal portfolio & blog
│   ├── app/                     # Next.js 16 App Router pages
│   ├── components/              # React components + shadcn/ui
│   ├── content/                 # MDX blog posts
│   ├── lib/                     # Utilities
│   ├── Dockerfile               # Multi-stage Node.js build
│   └── package.json             # Next.js 16, React 19, Tailwind v4
│
├── vibetradez.com/
│   ├── server/                  # Go API server (trading backend)
│   │   ├── cmd/scanner/         # Main entry point, cron jobs, workflows
│   │   ├── internal/
│   │   │   ├── config/          # Environment variable loading
│   │   │   ├── email/           # Resend email client
│   │   │   ├── schwab/          # Schwab OAuth + Market Data API
│   │   │   ├── sentiment/       # Reddit WSB sentiment scraper
│   │   │   ├── server/          # HTTP API handlers
│   │   │   ├── store/           # PostgreSQL database layer
│   │   │   ├── templates/       # HTML email templates
│   │   │   └── trades/          # OpenAI trade analysis + prompts
│   │   ├── Dockerfile           # Multi-stage Go build
│   │   └── go.mod
│   │
│   └── client/                  # Next.js trading frontend
│       ├── app/                 # App Router: /, /history, /terms, /faq
│       ├── components/          # Dashboard, history, layout, subscribe
│       ├── hooks/               # Custom React hooks (live quotes, etc.)
│       ├── lib/                 # API client, formatters, calculations
│       ├── types/               # TypeScript interfaces
│       ├── Dockerfile           # Multi-stage Node.js build
│       └── package.json         # Next.js 16, React 19, shadcn/ui, Recharts
│
├── .github/workflows/          # CI/CD pipeline
│   ├── main-pipeline.yml       # Orchestrator: two independent deploy/notify paths
│   ├── sync.yml                # Git pull on production server
│   ├── lint-portfolio.yml      # Biome lint for jaycebordelon.com
│   ├── lint-trading-frontend.yml # Biome lint for vibetradez.com/client
│   ├── lint-trading-server.yml # golangci-lint for vibetradez.com/server
│   ├── build.yml               # Docker compose build (parameterized by service)
│   ├── deploy.yml              # Rolling deployment (parameterized: portfolio or trading)
│   ├── cleanup.yml             # Post-deploy docker system prune
│   ├── healthcheck.yml         # Endpoint verification + granular /health
│   ├── notify-portfolio.yml    # Deploy email for jaycebordelon.com (slate theme)
│   ├── notify-trading.yml      # Deploy email for vibetradez.com (brand gradient theme)
│   └── cd.yml                  # Standalone manual trigger pipeline
│
├── docker-compose.yml          # All services + Traefik config
├── .env                        # Secrets (gitignored)
└── CLAUDE.md                   # This file
```

## Tech Stack

| Project | Stack |
|---------|-------|
| jaycebordelon.com | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (new-york), MDX, Framer Motion |
| vibetradez.com/client | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (new-york), Recharts v3, TradingView Lightweight Charts |
| vibetradez.com/server | Go 1.23, PostgreSQL (Digital Ocean managed), OpenAI GPT-5.4, Schwab Market Data API, Resend email |
| Infrastructure | Docker Compose, Traefik v2.10, Let's Encrypt, Digital Ocean Droplet |

## Database

PostgreSQL hosted on Digital Ocean Managed Databases. Connection string is in `.env` as `DATABASE_URL`. The Go server auto-migrates schema on startup (CREATE TABLE IF NOT EXISTS).

## Key Environment Variables (.env)

- `DATABASE_URL` — PostgreSQL connection string (required, no default)
- `RESEND_API_KEY` — Email delivery
- `OPENAI_API_KEY` — GPT trade analyzer (required to run cron jobs)
- `OPENAI_MODEL` — Override the default OpenAI model (default: latest from `config.DefaultOpenAIModel`)
- `ANTHROPIC_API_KEY` — Claude trade validator (optional; validation skipped if missing or stub)
- `ANTHROPIC_MODEL` — Override the default Anthropic model (default: latest from `config.DefaultAnthropicModel`)
- `SCHWAB_APP_KEY` / `SCHWAB_SECRET` — Market data OAuth
- `ADMIN_KEY` — Protects `/admin/announce` broadcast endpoint
- `EMAIL_RECIPIENTS` — Seed subscribers on first boot

## Development Rules

### Always lint AND build before pushing

Run these checks before every push. No exceptions. CI will fail if they don't pass, and a failed pipeline blocks deployment for everyone.

```bash
# Lint Go
cd vibetradez.com/server && gofmt -w . && go vet ./...

# Lint Next.js (both projects, run from jaycebordelon.com/ where biome is installed)
cd jaycebordelon.com && npx biome check .
cd jaycebordelon.com && npx biome check ../vibetradez.com/client/

# Build Next.js (both projects)
cd jaycebordelon.com && npx next build
cd vibetradez.com/client && npx next build
```

If any lint or build fails, fix it before pushing. Never push code that hasn't been verified locally.

### Always read the latest documentation

When working with Next.js, shadcn/ui, Tailwind CSS, Recharts, or any external library, **always fetch and read the current documentation** before writing code. Do not rely on recalled syntax or API signatures — they may be outdated. This applies even if it takes extra time. Incorrect assumptions about APIs cause more rework than the time saved by skipping docs.

### Recharts (currently pinned at v3)

`vibetradez.com/client` uses **Recharts ^3.8.0** wrapped by the shadcn `ChartContainer` primitive at `components/ui/chart.tsx`. Recharts 3 was a hard break from 2 — read the migration guide before touching any chart code.

**Reference URLs:**

- v2 → v3 migration guide: <https://github.com/recharts/recharts/wiki/3.0-migration-guide>
- Release notes (changelog after 2.x lives only here): <https://github.com/recharts/recharts/releases>
- npm: <https://www.npmjs.com/package/recharts>

**v3 breaking changes that bite us in this codebase:**

- `CategoricalChartState` is gone. Anything that used to read internal chart state via `Customized` or props now must use hooks (`useActiveTooltipLabel`, etc.).
- Many "internal" cloned props are gone: `Scatter.points`, `Area.points`, `Legend.payload`, `activeIndex`. If you see code reading any of these, it's broken on v3.
- `<Customized />` no longer receives extra props.
- `ref.current.current` on `ResponsiveContainer` is gone.
- `XAxis` / `YAxis` axis lines now render even when there are no ticks.
- Multiple `YAxis` instances render in alphabetical order of `yAxisId`, not render order.
- `CartesianGrid` requires explicit `xAxisId` / `yAxisId` to match the axes it pairs with.
- SVG z-order is the JSX render order — to put a series on top, render it last.
- `Area`'s `connectNulls=true` now treats null datapoints as zero instead of skipping them.
- `Pie.blendStroke` is removed; use `stroke="none"`.
- `<Cell>` is **deprecated** as of v3.7 and will be removed in v4. Migrate per-bar/per-slice colors to the chart element's `shape` prop instead. We still use `Cell` in `daily-pnl-chart.tsx` and `daily-breakdown.tsx` — leave them alone for now but plan a migration before bumping major.
- Tooltip custom-content prop type is now `TooltipContentProps`, not `TooltipProps`.
- Since v3.3, every chart accepts a `responsive` prop directly, so `ResponsiveContainer` wrapping is **optional**. Our shadcn `ChartContainer` still wraps with `ResponsiveContainer` for the inline-style fallback.

**Project-specific rules for chart components:**

- Always render charts through `ChartContainer` from `@/components/ui/chart` — it owns the `ResponsiveContainer`, the `--color-*` CSS variable injection, and the tooltip context.
- Never call `.map()` directly on a `data` prop you receive from a parent without a fallback. The `Cannot read properties of null (reading 'map')` runtime crash on `/history` was caused by the server returning `{"days": null}` for an empty range and `filterByRank` calling `data.days.map(...)` unguarded. The lesson: any boundary that produces JSON arrays must initialize them as empty slices server-side (Go nil slice → JSON `null`), and any client function that consumes them must `?? []` them defensively. Same pattern applies to `comparison.go`, `cmd/scanner/main.go`, and any future endpoint that returns lists.
- When passing data into Recharts components, the data prop must be an array, not null/undefined. A guard like `data && data.length > 0 && <BarChart data={data} ...>` is the safest pattern.

### Always use feature branches

Never push directly to `main`. Create a descriptive branch, push there, and let the user handle PRs and merging.

### Design system consistency

Both Next.js frontends share the same design tokens (CSS variables in `globals.css`), font stack (Plus Jakarta Sans, JetBrains Mono), and shadcn/ui configuration (new-york style, neutral base color, lucide icons). Any UI changes must be consistent across both sites.

## API Protection

All `/api/*` routes on the trading server require the `X-VT-Source` header. Without it, requests return 403. The Next.js frontend includes this header on every fetch call. The `/admin/announce` endpoint requires `X-Admin-Key` header matching the `ADMIN_KEY` env var.

## Trading Server Workflows

The Go server runs three cron jobs in Eastern Time:
- **9:25 AM Mon-Fri** — Scrape Reddit sentiment, call OpenAI for 10 ranked trade picks, save to DB, email subscribers
- **4:05 PM Mon-Fri** — Fetch closing prices from Schwab, compute EOD P&L, save summaries, email subscribers
- **4:30 PM Fridays** — Aggregate weekly performance, compute stats (win rate, Sharpe, drawdown), email weekly report

Market holidays are hardcoded in `cmd/scanner/main.go`. Jobs skip on holidays and weekends.

## Common Operations

### Send announcement to all subscribers
```bash
curl -X POST https://vibetradez.com/admin/announce \
  -H "X-Admin-Key: <ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"subject": "...", "badge": "...", "headline": "...", "sections": [{"title": "...", "body": "..."}], "cta_text": "...", "cta_url": "..."}'
```

### Re-authorize Schwab OAuth
Visit `https://vibetradez.com/auth/schwab` in a browser. Tokens are stored in the `oauth_tokens` table and auto-refresh.

### Check server health
```bash
curl https://vibetradez.com/health | jq
```
Returns per-service status for database, OpenAI, Anthropic, Schwab, and API with latencies. Both LLM checks go through the official SDKs and warn (instead of fail) when a stub local key is detected.

### Docker commands on production
```bash
ssh jayce@<server>
cd ~/personal-monorepo
docker compose logs trading-server --tail 50    # View Go server logs
docker compose logs trading-frontend --tail 50  # View Next.js logs
docker compose restart trading-server           # Restart Go server
docker compose up -d --force-recreate trading-server  # Full recreate
```

## Dual-Model Trade Analysis

The morning trade pipeline uses **two language models in sequence**:

1. **OpenAI (GPT-5.4 by default)** generates 10 ranked trade ideas via `vibetradez.com/server/internal/trades/analyzer.go`. The analyzer uses the official `github.com/openai/openai-go/v3` SDK against the Responses API with multi-round Schwab `get_stock_quotes` / `get_option_chain` function tools and built-in `web_search`. Each trade comes back with a 1-10 conviction `score` and a free-form `rationale` defending the score.
2. **Anthropic (Claude Opus 4.6 by default)** then validates GPT's picks via `vibetradez.com/server/internal/trades/validator.go`. Claude is fed GPT's full output and the same Schwab + `web_search` tool surface (using `github.com/anthropics/anthropic-sdk-go`). It returns its own independent 1-10 `score`, a substantive `rationale`, and an optional `concerns` array of red flags.
3. `cmd/scanner/main.go` merges Claude's scores into the trades, computes `combined_score = (gpt + claude) / 2`, and re-ranks the picks by combined score with Claude as the tiebreaker. Both per-model scores and rationales persist to the `trades` table and surface on the dashboard.

If `ANTHROPIC_API_KEY` is missing or matches a local stub, validation is skipped silently and trades persist with `claude_score = 0`. The `/api/model-comparison` endpoint backtests "if you had only followed each model's ranking" and powers the `/models` page.

### Model version refresh policy

Both models are configured via env vars (`OPENAI_MODEL`, `ANTHROPIC_MODEL`) with defaults defined as constants in `vibetradez.com/server/internal/config/config.go` (`DefaultOpenAIModel`, `DefaultAnthropicModel`).

**Any time work touches the trade analyzer, validator, or these defaults, fetch the official Go SDK documentation and refresh the defaults to the current latest production model.** OpenAI and Anthropic publish new model versions regularly; if a default sits stale, trade quality degrades silently. The two pages to read are:

- Anthropic Go SDK: <https://platform.claude.com/docs/en/api/sdks/go>
- OpenAI Go SDK: <https://developers.openai.com/api/docs/libraries?language=golang>

When updating, also bump the `OPENAI_MODEL` / `ANTHROPIC_MODEL` defaults baked into `vibetradez.com/local/docker-compose.local.yml` so the local dev stack matches.

## CI/CD Pipeline

Triggered on push to `main` or manual dispatch. Runs on the production server via SSH. The two sites deploy independently so a slow or failing build on one side never blocks the other.

```
           ┌──────────────────────────────────── PORTFOLIO PATH ────────────────────────────────────┐
           │                                                                                         │
           │  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐   ┌───────────┐         │
           ├─>│ Lint          │──>│ Build            │──>│ Deploy           │──>│ Notify    │         │
           │  │ Portfolio     │   │ jaycebordelon-com│   │ docker rollout   │   │ Portfolio │         │
           │  │ (Biome)       │   └─────────────────┘   │ jaycebordelon-com│   │ Email     │         │
           │  └──────────────┘                          └────────┬─────────┘   └───────────┘         │
┌──────┐   │                                                     │                                   │
│ Push │──>│ Sync                                                ▼                                   │
│ main │──>│ git pull                                   ┌────────────────┐                           │
└──────┘   │                                            │ Both deploys   │                           │
           │                                            │ complete       │                           │
           │                                            └───┬────────┬───┘                           │
           │                                                │        │                               │
           │                                                ▼        ▼                               │
           │                                         ┌─────────┐ ┌────────────┐                      │
           │                                         │ Cleanup │ │ Health     │                      │
           │                                         │ prune   │ │ Check      │                      │
           │                                         └─────────┘ │ endpoints  │                      │
           │                                                     │ + /health  │                      │
           │                                                     └────────────┘                      │
           │                                                                                         │
           │  ┌──────────────┐   ┌─────────────────┐                                                │
           ├─>│ Lint          │──>│ Build            │──┐                                             │
           │  │ Trading FE    │   │ trading-frontend │  │  ┌──────────────────┐   ┌───────────┐      │
           │  │ (Biome)       │   └─────────────────┘  ├─>│ Deploy           │──>│ Notify    │      │
           │  └──────────────┘                         │  │ docker rollout   │   │ Trading   │      │
           │                                           │  │ trading-frontend │   │ Email     │      │
           │  ┌──────────────┐   ┌─────────────────┐   │  │ + force-recreate │   └───────────┘      │
           └─>│ Lint          │──>│ Build            │──┘  │ trading-server   │                      │
              │ Trading BE    │   │ trading-server   │     └──────────────────┘                      │
              │ (Go lint)     │   └─────────────────┘                                               │
              └──────────────┘                                                                      │
           │                                                                                         │
           └──────────────────────────────────── TRADING PATH ───────────────────────────────────────┘
```

1. **Sync** — `git reset --hard origin/main`
2. **Lint / Portfolio** — Biome check on `jaycebordelon.com/` (gates portfolio build only)
3. **Lint / Trading Frontend** — Biome check on `vibetradez.com/client/` (gates trading frontend build only)
4. **Lint / Trading Server** — golangci-lint on `vibetradez.com/server/` (gates trading server build only)
5. **Build** — Three parallel `docker compose build --no-cache` jobs, each gated by its own lint
6. **Deploy / Portfolio** — `docker rollout jaycebordelon-com` (fires as soon as portfolio build finishes)
7. **Deploy / Trading** — `docker rollout trading-frontend` + `docker compose up -d --force-recreate trading-server` (fires as soon as both trading builds finish)
8. **Notify** — Per-service email to bordelonjayce@gmail.com as soon as each deploy completes. Each notification is independent and does not wait for the other site.
9. **Cleanup** — `docker system prune -af --volumes` to reclaim disk space (waits for both deploys)
10. **Health Check** — Verify all endpoints + granular `/health` for trading server services (database, openai, anthropic, schwab, api). The healthcheck step iterates `services | keys[]` so any new service added to the granular `/health` response is automatically gated without YAML changes. Waits for both deploys.
