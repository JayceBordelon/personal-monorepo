import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
// prev day with summary
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('button'));
  const prev = all.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('prev'));
  if (prev) prev.click();
});
await new Promise(r => setTimeout(r, 1500));
const wrap = await page.$('.recharts-wrapper');
if (wrap) await wrap.screenshot({ path: '/tmp/chart-eod.png' });
console.log('saved chart-eod');
// Now go back to live (today)
await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
const wrap2 = await page.$('.recharts-wrapper');
if (wrap2) await wrap2.screenshot({ path: '/tmp/chart-live.png' });
console.log('saved chart-live');
await browser.close();
