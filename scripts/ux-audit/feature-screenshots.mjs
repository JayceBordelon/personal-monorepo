/*
Captures screenshots for two purposes:

  1. Feature screenshots (1440x900 desktop) — visual proof of the
     auto-execution UI changes in PR #43. Saved to OUT_DIR.

  2. OpenGraph image (1200x630, the Twitter/Facebook standard) — a
     real dashboard screenshot to replace the synthetic /og card.
     Saved to OG_OUT.

Run with the local docker stack up at http://localhost:3001.
*/

import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "feature-output");
const OG_OUT = path.join(__dirname, "opengraph-image.png");
const BASE = process.env.TRADING_BASE ?? "http://localhost:3001";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
Each feature targets a specific UI artifact via a CSS selector that
the screenshot scrolls into view before capturing. Charts + live
quotes need extra wait for fetch + render — settle 4s before
screenshot.
*/
const FEATURES = [
  {
    name: "01-dashboard-execution-badge",
    url: "/dashboard",
    desc: "Dashboard — execution badge on the qualifying-pick card",
    scrollTo: "h2", // 'Today's Picks' section
    scrollIndex: 2, // skip 'Price Chart' + 'Exposure'
    waitFor: 4000,
  },
  {
    name: "02-history-execution-badges",
    url: "/history",
    desc: "History — execution badges on past days (paper holding, paper closed +/-, live closed)",
    waitFor: 4000,
  },
  {
    name: "03-trade-detail-execution-panel",
    url: "/trade/COIN?date=2026-04-24",
    desc: "Trade detail — full 4-stat execution panel with paper-mode disclaimer",
    waitFor: 3000,
  },
  {
    name: "04-execute-error-state",
    url: "/execute?token=bogus&action=execute",
    desc: "/execute — could-not-confirm error state (token signature mismatch)",
    waitFor: 2000,
  },
  {
    name: "05-execute-invalid-link",
    url: "/execute",
    desc: "/execute — invalid-link state (missing required params)",
    waitFor: 2000,
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });

  /*
  Feature screenshots — 1440x900 desktop, light theme.
  */
  for (const f of FEATURES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(() => {
      try { window.localStorage.setItem("theme", "light"); } catch {}
    });
    const target = `${BASE}${f.url}`;
    console.log(`[feature] ${f.name} ${target}`);
    try {
      await page.goto(target, { waitUntil: "networkidle2", timeout: 30000 });
    } catch (e) {
      console.warn(`  navigation timeout (continuing): ${e.message}`);
    }
    await sleep(f.waitFor);
    if (f.scrollTo) {
      await page.evaluate((sel, idx) => {
        const els = document.querySelectorAll(sel);
        const el = els[idx ?? 0];
        if (el) el.scrollIntoView({ block: "start" });
      }, f.scrollTo, f.scrollIndex);
      await sleep(800);
    }
    const out = path.join(OUT_DIR, `${f.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    await page.close();
  }

  /*
  OG image — 1200x630, captured from the dashboard at OG resolution.
  Cropped to first 630px of the rendered dashboard so headline + first
  cards are visible.
  */
  console.log(`[og] capturing dashboard hero @ 1200x630`);
  const ogPage = await browser.newPage();
  await ogPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
  await ogPage.evaluateOnNewDocument(() => {
    try { window.localStorage.setItem("theme", "dark"); } catch {}
  });
  await ogPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2", timeout: 30000 });
  // Chart + cards finish painting around 3-4s after networkidle on this stack.
  await sleep(4500);
  // Scroll past the chart to the morning-cards grid — visually denser and
  // makes a better og:image preview than a half-loaded chart.
  await ogPage.evaluate(() => {
    const headers = document.querySelectorAll("h2");
    for (const h of headers) {
      if (h.textContent && h.textContent.includes("Today")) {
        h.scrollIntoView({ block: "start" });
        return;
      }
    }
  });
  await sleep(800);
  const ogBuf = await ogPage.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await writeFile(OG_OUT, ogBuf);
  await ogPage.close();

  await browser.close();
  console.log(`\nfeatures → ${OUT_DIR}`);
  console.log(`og image  → ${OG_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
