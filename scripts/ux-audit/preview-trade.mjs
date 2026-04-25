import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
for (const [name, w, h, isMobile] of [
  ['desktop', 1440, 900, false],
  ['mobile', 390, 844, true],
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: isMobile ? 3 : 1, isMobile, hasTouch: isMobile });
  await page.goto('http://localhost:3001/trade/RIVN?date=2026-04-23', { waitUntil: 'networkidle2' });
  // Wait until loading state is gone
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: `/tmp/trade-${name}.png`, fullPage: true });
  console.log(`saved /tmp/trade-${name}.png`);
  await page.close();
}
await browser.close();
