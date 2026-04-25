import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
async function go(url, w, h, isMobile, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: isMobile ? 3 : 1, isMobile, hasTouch: isMobile });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  // For dashboard, click prev to get a day with summaries
  if (url.includes('/dashboard')) {
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button'));
      const prev = all.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('prev') || b.getAttribute('aria-label')?.toLowerCase().includes('earlier'));
      if (prev) prev.click();
    });
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.screenshot({ path: `/tmp/snap-${name}.png`, fullPage: true });
  console.log(`saved /tmp/snap-${name}.png`);
  await page.close();
}
await go('http://localhost:3001/dashboard', 1440, 900, false, 'dashboard-desktop');
await go('http://localhost:3001/dashboard', 390, 844, true, 'dashboard-mobile');
await go('http://localhost:3001/trade/RIVN?date=2026-04-23', 1440, 900, false, 'trade-desktop');
await go('http://localhost:3001/trade/RIVN?date=2026-04-23', 390, 844, true, 'trade-mobile');
await browser.close();
