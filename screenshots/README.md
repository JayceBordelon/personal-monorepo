# UI/UX enhancements — visual snapshots

After-state screenshots that accompany [PR #N — `feat/ui-ux-enhancements`](https://github.com/JayceBordelon/jaycestuff/pulls?q=head%3Afeat%2Fui-ux-enhancements). This branch is **screenshots only** — no code changes — so it never merges; it exists as a reference link for the PR description.

Captured by `scripts/ux-audit/audit.mjs` on the `feat/ui-ux-enhancements` branch against the local Docker stack at `http://localhost:3001`.

## Layout

```
screenshots/
├── desktop/                # 1440x900 viewport, full page per route
│   ├── home.png
│   ├── dashboard.png
│   ├── history.png
│   ├── models.png
│   ├── faq.png
│   ├── terms.png
│   └── not-found.png
├── mobile/                 # iPhone 14 Pro (390x844), full page per route
│   └── (same routes)
└── interactions/           # interaction-walk steps (open subscribe modal,
    ├── desktop/            #  click Top-N filter, click date prev,
    └── mobile/             #  toggle Week/Month/Year/All, etc.)
```

## What to look for

- **`desktop/models.png`, `mobile/models.png`** — head-to-head card and side-by-side panels now read **ChatGPT** / **Claude** instead of `gpt-5.5` / `claude-opus-4-7`. Cumulative P&L legend updated.
- **`desktop/history.png`, `mobile/history.png`** — Equity Curve and Daily P&L cards no longer carry duplicate headings (was rendered twice — once by the outer `<Section>`, once by `<CardTitle>`).
- **`mobile/*.png`** — footer link cluster, brand link, nav tabs, history mode toggle, models range tabs, Top-N dropdown trigger, and the Terms back-to-top link all expand to ≥44px tap height on mobile while preserving desktop density.
- **`desktop/home.png`, `mobile/home.png`** — landing copy now says "ChatGPT and Claude" instead of "GPT Latest and Claude Latest". The Reveal IntersectionObserver fix means above-fold content paints synchronously, so SEO / OG snapshots see the hero without scrolling.
- **`interactions/`** — confirms subscribe CTA opens, dashboard date-prev arrow works, Top-N control switches state, and the history Week/Month/Year/All toggle cycles correctly on both viewports.

## Reproducing

```bash
# 1. Boot the local stack on the feat/ui-ux-enhancements branch
git checkout feat/ui-ux-enhancements
cd vibetradez.com/local
docker compose -f docker-compose.local.yml up --build -d

# 2. Run the audit harness
cd ../../scripts/ux-audit
npm install   # first time only
node audit.mjs

# Output lands in scripts/ux-audit/output/{report.json,summary.md,screenshots/}
```
