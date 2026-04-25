import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/today.png', fullPage: true });
console.log('saved today (latest day, morning mode)');
// Click prev to a day with summaries
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('button'));
  const prev = all.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('prev'));
  if (prev) prev.click();
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/prev.png', fullPage: true });
console.log('saved prev (with EOD summary)');
await browser.close();
