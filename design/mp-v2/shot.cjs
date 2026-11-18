const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const d of ['A', 'B', 'C']) {
    const p = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1.5 });
    await p.goto('file://' + __dirname + '/index.html?d=' + d);
    if (!(await p.$('#' + d))) { await p.close(); continue; }
    await p.waitForTimeout(400);
    const ov = await p.evaluate(() => [...document.querySelectorAll('.phone *')].filter(e => { const ph = e.closest('.phone').getBoundingClientRect(), r = e.getBoundingClientRect(); return r.width && (r.right > ph.right + 1 || r.left < ph.left - 1) && getComputedStyle(e).position !== 'absolute'; }).map(e => e.closest('.pw').querySelector('figcaption b').textContent + ' ' + e.className + ' ' + e.textContent.slice(0, 20)).slice(0, 20));
    if (ov.length) console.log(d, '横向溢出:', ov);
    const vo = await p.evaluate(() => [...document.querySelectorAll('.phone .body')].map(e => [e.closest('.pw').querySelector('figcaption b').textContent, e.scrollHeight - e.clientHeight]).filter(x => x[1] > 0));
    if (vo.length) console.log(d, '纵向超出(px):', JSON.stringify(vo));
    await p.screenshot({ path: __dirname + '/shot-' + d + '.png', fullPage: true });
    await p.close();
  }
  await b.close();
})();
