import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
for (const w of [800, 900, 1024]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900 });
  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    const prev = all.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('prev') || b.getAttribute('aria-label')?.toLowerCase().includes('earlier'));
    if (prev) prev.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    const tr = document.querySelector('table tbody tr[aria-expanded]');
    if (tr) tr.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const overflow = await page.evaluate(() => {
    const t = document.querySelector('table');
    const wrap = t?.parentElement;
    return wrap ? {
      tableW: t.scrollWidth,
      wrapW: wrap.clientWidth,
      horizScroll: t.scrollWidth > wrap.clientWidth,
    } : { error: 'no table' };
  });
  console.log('w=' + w, JSON.stringify(overflow));
  const cell = await page.$('td[colspan="8"]');
  if (cell) await cell.screenshot({ path: `/tmp/expanded-${w}.png` });
  await page.close();
}
await browser.close();
