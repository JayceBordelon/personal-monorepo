import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('button'));
  const prev = all.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('prev'));
  if (prev) prev.click();
});
await new Promise(r => setTimeout(r, 1500));
// Snap just the exposure section
const handles = await page.$$('h3');
for (const h of handles) {
  const text = await page.evaluate(el => el.innerText, h);
  if (text === 'Exposure Analysis') {
    const card = await h.evaluateHandle(el => el.closest('.rounded-xl, [class*="card"]') || el.parentElement.parentElement);
    await card.asElement().screenshot({ path: '/tmp/snap-exposure.png' });
    console.log('saved exposure');
    break;
  }
}
// Snap chart section
const charts = await page.$$('h2');
for (const h of charts) {
  const text = await page.evaluate(el => el.innerText, h);
  if (text === 'Price Chart') {
    const wrap = await h.evaluateHandle(el => el.parentElement);
    await wrap.asElement().screenshot({ path: '/tmp/snap-chart.png' });
    console.log('saved chart');
    break;
  }
}
await browser.close();
