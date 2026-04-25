import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

const TRADING_BASE = process.env.TRADING_BASE ?? "http://localhost:3001";

const VIEWPORTS = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
];

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/dashboard", label: "dashboard" },
  { path: "/history", label: "history" },
  { path: "/models", label: "models" },
  { path: "/trade/RIVN?date=2026-04-23", label: "trade" },
  { path: "/faq", label: "faq" },
  { path: "/terms", label: "terms" },
  { path: "/this-route-does-not-exist", label: "not-found" },
];

const THEMES = ["light", "dark"];

async function setTheme(page, theme) {
  await page.evaluateOnNewDocument((t) => {
    try {
      window.localStorage.setItem("theme", t);
    } catch {}
  }, theme);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkOverflow(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const overflowing = [];
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > docWidth + 1 || r.left < -1) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === "string" ? el.className.slice(0, 80) : "";
        const id = el.id || "";
        overflowing.push({
          selector: `${tag}${id ? `#${id}` : ""}${cls ? `.${cls.split(" ").filter(Boolean).slice(0, 2).join(".")}` : ""}`,
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          docWidth,
        });
      }
    }
    return overflowing.slice(0, 25);
  });
}

async function checkSmallTapTargets(page) {
  return page.evaluate(() => {
    const targets = document.querySelectorAll(
      "a, button, [role='button'], input[type='button'], input[type='submit'], [tabindex]:not([tabindex='-1'])",
    );
    const small = [];
    for (const el of targets) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const minDim = Math.min(r.width, r.height);
      if (minDim < 32) {
        const text = (el.innerText || el.getAttribute("aria-label") || "").slice(0, 40).replace(/\s+/g, " ");
        small.push({
          tag: el.tagName.toLowerCase(),
          text,
          width: Math.round(r.width),
          height: Math.round(r.height),
        });
      }
    }
    return small.slice(0, 25);
  });
}

async function checkBrokenImages(page) {
  return page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    const broken = [];
    for (const img of imgs) {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push({ src: img.src, alt: img.alt });
      }
    }
    return broken;
  });
}

async function checkMissingAlt(page) {
  return page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    return Array.from(imgs)
      .filter((img) => !img.alt || img.alt.trim().length === 0)
      .map((img) => ({ src: img.src, role: img.getAttribute("role") || null }))
      .slice(0, 25);
  });
}

async function checkMissingButtonLabels(page) {
  return page.evaluate(() => {
    const buttons = document.querySelectorAll("button, [role='button']");
    const missing = [];
    for (const b of buttons) {
      if (!(b instanceof HTMLElement)) continue;
      const text = (b.innerText || "").trim();
      const aria = b.getAttribute("aria-label");
      const title = b.getAttribute("title");
      if (text.length === 0 && !aria && !title) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        missing.push({
          html: b.outerHTML.slice(0, 120),
        });
      }
    }
    return missing.slice(0, 10);
  });
}

async function checkContrast(page) {
  // Simple heuristic: catch elements with color very close to background.
  return page.evaluate(() => {
    function parseRgb(s) {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((x) => parseFloat(x.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    }
    function lum({ r, g, b }) {
      const norm = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
    }
    function contrast(c1, c2) {
      const a = lum(c1);
      const b = lum(c2);
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    }
    function blend(over, under) {
      // Standard "source-over" alpha composite.
      const a = over.a + under.a * (1 - over.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (over.r * over.a + under.r * under.a * (1 - over.a)) / a,
        g: (over.g * over.a + under.g * under.a * (1 - over.a)) / a,
        b: (over.b * over.a + under.b * under.a * (1 - over.a)) / a,
        a,
      };
    }
    function bgOf(el) {
      // Walk up the tree, collect every translucent backgroundColor, then
      // composite them onto the page's body bg so we get the actual
      // perceived color behind the text.
      const stack = [];
      let cur = el;
      while (cur && cur instanceof HTMLElement) {
        const p = parseRgb(getComputedStyle(cur).backgroundColor);
        if (p && p.a > 0) stack.push(p);
        cur = cur.parentElement;
      }
      const rootBg = parseRgb(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
      let result = { ...rootBg, a: 1 };
      for (let i = stack.length - 1; i >= 0; i--) {
        result = blend(stack[i], result);
      }
      return result;
    }
    function hasGradientBackground(el) {
      // Walk up looking for a CSS gradient on background-image; if any
      // ancestor paints one we can't compute a single ratio reliably,
      // so skip the element rather than emit a false positive.
      let cur = el;
      while (cur && cur instanceof HTMLElement) {
        const bi = getComputedStyle(cur).backgroundImage || "";
        if (bi.includes("gradient(")) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    const all = document.querySelectorAll("body *");
    const issues = [];
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      if (!el.innerText || el.innerText.trim().length === 0) continue;
      // Only check elements whose direct text content is non-empty
      const direct = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim().length > 1,
      );
      if (!direct) continue;
      if (hasGradientBackground(el)) continue;
      const style = getComputedStyle(el);
      const fg = parseRgb(style.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const ratio = contrast(fg, bg);
      const fontSize = parseFloat(style.fontSize);
      const isLargeBold = fontSize >= 18.66 && parseInt(style.fontWeight) >= 700;
      const isLarge = fontSize >= 24 || isLargeBold;
      const min = isLarge ? 3 : 4.5;
      if (ratio < min) {
        const text = el.innerText.trim().slice(0, 60).replace(/\s+/g, " ");
        issues.push({
          ratio: Math.round(ratio * 100) / 100,
          required: min,
          fontSize,
          text,
          tag: el.tagName.toLowerCase(),
        });
      }
    }
    // De-duplicate by text snippet
    const seen = new Set();
    const out = [];
    for (const i of issues) {
      const k = `${i.tag}:${i.text}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(i);
      if (out.length >= 20) break;
    }
    return out;
  });
}

async function dismissOverlays(page) {
  // If a modal or cookie banner is up, try to close it.
  await page.evaluate(() => {
    const candidates = document.querySelectorAll("[role='dialog'] [aria-label*='close' i], [role='dialog'] button");
    for (const c of candidates) {
      if (!(c instanceof HTMLElement)) continue;
      const t = (c.innerText || "").toLowerCase();
      if (t.includes("close") || t === "×") {
        c.click();
        return;
      }
    }
  });
}

async function auditRoute(browser, viewport, route, theme) {
  const page = await browser.newPage();
  await setTheme(page, theme);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  });
  await page.setUserAgent(viewport.userAgent);

  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const httpErrors = [];

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleMessages.push({
        type,
        text: msg.text().slice(0, 400),
        location: msg.location(),
      });
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ message: err.message, stack: (err.stack || "").slice(0, 600) });
  });
  page.on("requestfailed", (req) => {
    requestFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });
  page.on("response", async (res) => {
    const status = res.status();
    if (status >= 400) {
      httpErrors.push({ url: res.url(), status });
    }
  });

  const url = TRADING_BASE + route.path;
  const startedAt = Date.now();
  let navError = null;
  let title = "";

  try {
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    title = await page.title();
    if (resp && resp.status() >= 400 && route.label !== "not-found") {
      navError = `Got HTTP ${resp.status()} for ${url}`;
    }
  } catch (e) {
    navError = String(e);
  }
  const loadMs = Date.now() - startedAt;

  // Let CSS animations / hydration finish.
  await sleep(800);

  // Capture the "no-scroll" first paint to detect IntersectionObserver-gated content
  // (Reveal animations) that stays opacity:0 if the user never scrolls / the crawler
  // never scrolls.
  const noScrollScreenshotPath = path.join(
    OUTPUT_DIR,
    "screenshots",
    `${route.label}__${viewport.name}__${theme}__noscroll.png`,
  );
  await page.screenshot({ path: noScrollScreenshotPath, fullPage: true });
  const hiddenAfterFirstPaint = await page.evaluate(() => {
    const all = document.querySelectorAll("body *");
    let hidden = 0;
    let total = 0;
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      const op = parseFloat(cs.opacity);
      if (Number.isNaN(op)) continue;
      total++;
      if (op < 0.05 && el.innerText && el.innerText.trim().length > 5) {
        hidden++;
      }
    }
    return { hidden, total };
  });

  // Scroll through the page in increments so IntersectionObserver fires.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = window.innerHeight * 0.6;
      const max = document.documentElement.scrollHeight;
      const tick = setInterval(() => {
        y += step;
        window.scrollTo(0, y);
        if (y >= max) {
          clearInterval(tick);
          window.scrollTo(0, 0);
          setTimeout(resolve, 400);
        }
      }, 120);
    });
  });
  await sleep(600);

  const screenshotPath = path.join(
    OUTPUT_DIR,
    "screenshots",
    `${route.label}__${viewport.name}__${theme}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let overflow = [];
  let smallTapTargets = [];
  let brokenImages = [];
  let missingAlt = [];
  let missingButtonLabels = [];
  let contrastIssues = [];

  if (!navError) {
    overflow = await checkOverflow(page);
    if (viewport.isMobile) {
      smallTapTargets = await checkSmallTapTargets(page);
    }
    brokenImages = await checkBrokenImages(page);
    missingAlt = await checkMissingAlt(page);
    missingButtonLabels = await checkMissingButtonLabels(page);
    contrastIssues = await checkContrast(page);
  }

  await page.close();

  return {
    route: route.path,
    label: route.label,
    viewport: viewport.name,
    theme,
    url,
    title,
    loadMs,
    navError,
    consoleMessages,
    pageErrors,
    requestFailures,
    httpErrors,
    overflow,
    smallTapTargets,
    brokenImages,
    missingAlt,
    missingButtonLabels,
    contrastIssues,
    hiddenAfterFirstPaint,
    screenshot: path.relative(OUTPUT_DIR, screenshotPath),
    noScrollScreenshot: path.relative(OUTPUT_DIR, noScrollScreenshotPath),
  };
}

async function interactionWalk(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  });
  await page.setUserAgent(viewport.userAgent);

  const observations = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 200)}`);
  });

  async function snap(label) {
    const p = path.join(
      OUTPUT_DIR,
      "screenshots",
      `interaction__${viewport.name}__${label}.png`,
    );
    await page.screenshot({ path: p, fullPage: false });
    observations.push({ step: label, screenshot: path.relative(OUTPUT_DIR, p) });
  }

  // 1. Land on home and try to find subscribe / sign-up CTA
  await page.goto(TRADING_BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(800);
  await snap("01-home");

  // Subscribe CTA on this app actually says "Sign in" / "Sign in or sign up"
  const opened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a"));
    const target = buttons.find((b) => /sign\s*in|sign\s*up|subscribe|notify|email me/i.test((b.innerText || "").trim()));
    if (target instanceof HTMLElement) {
      target.click();
      return target.innerText.trim();
    }
    return null;
  });
  if (opened) {
    await sleep(500);
    await snap("02-subscribe-open");
    observations.push({ step: "subscribe-button-text", value: opened });
    // Close by Escape
    await page.keyboard.press("Escape");
    await sleep(300);
  } else {
    observations.push({ step: "subscribe-button-text", value: null, note: "no subscribe-style button found" });
  }

  // 2. Navigate to /dashboard so the Top-N filter and date-nav controls exist.
  await page.goto(TRADING_BASE + "/dashboard", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1000);
  await snap("02b-dashboard");

  // Top-N filter — try clicking Top 1 / Top 3 / Top 5 / Top 10
  const topFilterClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, [role='button']"));
    const clicks = [];
    for (const t of ["Top 1", "Top 3", "Top 5", "Top 10"]) {
      const btn = all.find((b) => (b.innerText || "").trim() === t);
      if (btn instanceof HTMLElement) {
        btn.click();
        clicks.push(t);
      }
    }
    return clicks;
  });
  observations.push({ step: "top-n-filter-clicks", value: topFilterClicked });
  await sleep(400);
  await snap("03-after-top-n");

  // 3. Date nav — try clicking prev arrow if present
  const prevArrowClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, [aria-label]"));
    const target = all.find((b) => {
      const aria = b.getAttribute && b.getAttribute("aria-label");
      return /prev|previous|earlier/i.test(aria || "");
    });
    if (target instanceof HTMLElement) {
      target.click();
      return true;
    }
    return false;
  });
  observations.push({ step: "date-prev-clicked", value: prevArrowClicked });
  await sleep(600);
  await snap("04-prev-day");

  // 4. Visit /history and toggle modes
  await page.goto(TRADING_BASE + "/history", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(800);
  await snap("05-history");
  const modeClicks = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button"));
    const clicks = [];
    for (const t of ["Week", "Month", "Year", "All"]) {
      const btn = all.find((b) => (b.innerText || "").trim() === t);
      if (btn instanceof HTMLElement) {
        btn.click();
        clicks.push(t);
      }
    }
    return clicks;
  });
  observations.push({ step: "history-mode-clicks", value: modeClicks });
  await sleep(400);
  await snap("06-history-after-toggle");

  // 5. Visit /models
  await page.goto(TRADING_BASE + "/models", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(800);
  await snap("07-models");

  await page.close();
  return { viewport: viewport.name, observations, errors };
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
  await mkdir(path.join(OUTPUT_DIR, "screenshots"), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        console.log(`[audit] ${theme} :: ${vp.name} :: ${route.path}`);
        const r = await auditRoute(browser, vp, route, theme);
        results.push(r);
      }
    }
  }

  const interactions = [];
  for (const vp of VIEWPORTS) {
    console.log(`[interaction] ${vp.name}`);
    interactions.push(await interactionWalk(browser, vp));
  }

  await browser.close();

  await writeFile(
    path.join(OUTPUT_DIR, "report.json"),
    JSON.stringify({ trading_base: TRADING_BASE, results, interactions }, null, 2),
  );

  // Summary
  const summary = [];
  summary.push(`# UX Audit — ${new Date().toISOString()}`);
  summary.push(`Target: ${TRADING_BASE}`);
  summary.push("");
  for (const r of results) {
    const issueCount =
      r.consoleMessages.length +
      r.pageErrors.length +
      r.requestFailures.length +
      r.httpErrors.length +
      r.overflow.length +
      r.smallTapTargets.length +
      r.brokenImages.length +
      r.missingAlt.length +
      r.missingButtonLabels.length +
      r.contrastIssues.length;
    summary.push(
      `## [${r.theme ?? "?"} | ${r.viewport}] ${r.label} — ${r.route} — ${issueCount} flag(s) — ${r.loadMs}ms${r.navError ? `  ❌ ${r.navError}` : ""}`,
    );
    if (r.pageErrors.length) summary.push(`  pageErrors: ${r.pageErrors.length}`);
    if (r.consoleMessages.length) summary.push(`  consoleMessages: ${r.consoleMessages.length}`);
    if (r.httpErrors.length) summary.push(`  httpErrors: ${r.httpErrors.length}`);
    if (r.requestFailures.length) summary.push(`  requestFailures: ${r.requestFailures.length}`);
    if (r.overflow.length) summary.push(`  overflow: ${r.overflow.length}`);
    if (r.smallTapTargets.length) summary.push(`  smallTapTargets: ${r.smallTapTargets.length}`);
    if (r.brokenImages.length) summary.push(`  brokenImages: ${r.brokenImages.length}`);
    if (r.missingAlt.length) summary.push(`  missingAlt: ${r.missingAlt.length}`);
    if (r.missingButtonLabels.length) summary.push(`  missingButtonLabels: ${r.missingButtonLabels.length}`);
    if (r.contrastIssues.length) summary.push(`  contrastIssues: ${r.contrastIssues.length}`);
    summary.push("");
  }
  await writeFile(path.join(OUTPUT_DIR, "summary.md"), summary.join("\n"));
  console.log(`\nWrote ${OUTPUT_DIR}/report.json + summary.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
