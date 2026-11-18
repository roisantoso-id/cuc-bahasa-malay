// 截整页图，并检查：手机里有没有横向溢出、长页面有没有被裁掉
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForTimeout(500);
  const ov = await p.evaluate(() => [...document.querySelectorAll('.phone .scr *')].filter(e => { const ph = e.closest('.phone').getBoundingClientRect(), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width && (r.right > ph.right + 1 || r.left < ph.left - 1) && !e.closest('.at-days') && !/hm-bird|bt-bird/.test(e.className); }).map(e => e.closest('.pw').id + ' .' + e.className + ' ' + e.textContent.slice(0, 16)).slice(0, 20));
  console.log(ov.length ? '横向溢出: ' + JSON.stringify(ov, null, 1) : '横向溢出: 无');
  const vo = await p.evaluate(() => [...document.querySelectorAll('.phone .scr')].map(e => [e.closest('.pw').id, e.scrollHeight - e.clientHeight]).filter(x => x[1] > 0));
  console.log(vo.length ? '纵向被裁(px): ' + JSON.stringify(vo) : '纵向被裁: 无');
  const small = await p.evaluate(() => [...document.querySelectorAll('.phone .btn,.phone .tab,.phone .item,.phone .rk,.phone .opt,.phone .btn-text,.phone .at-dy,.phone .ln-bd,.phone .it,.phone .bt-sel,.phone .bt-more,.phone .ln-fav,.phone .at-fav,.phone .at-pop-x')].map(e => [e.closest('.pw').id, e.className, Math.round(e.getBoundingClientRect().height)]).filter(x => x[2] < 44 && !/btn-sm/.test(x[1])));
  console.log(small.length ? '点击区不到 88rpx: ' + JSON.stringify(small) : '点击区: 都 ≥ 88rpx（btn-sm 靠伪元素补到 88）');
  await p.screenshot({ path: __dirname + '/shot.png', fullPage: true });
  await (await p.$('.sys')).screenshot({ path: __dirname + '/shot-sys.png' });
  for (const id of process.argv.slice(2)) await (await p.$('#' + id)).screenshot({ path: __dirname + '/shot-' + id + '.png' });
  await b.close();
})();
