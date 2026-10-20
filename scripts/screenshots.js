/**
 * Captures screenshots of the production build using a locally installed Edge/Chrome and
 * reports icon-geometry checks. Usage: node scripts/screenshots.js (after `npm run build`;
 * puppeteer-core resolved from NODE_PATH).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', 'build');
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
  .find((p) => fs.existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(4173, r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
  const user = { id: 'u-admin', username: 'admin', email: 'admin@beacon.demo', name: 'Administrator', role: 'NATIONAL_ADMIN', homeScope: 'IN', stateCode: null, initials: 'DA' };
  const shots = [['command-centre', '/command-centre'], ['hazard-flood', '/hazards/flood'], ['incidents-filter-open', '/incidents']];

  for (const [theme, zoom] of [['dark', 1], ['light', 1], ['dark', 1.25]]) {
    const page = await browser.newPage();
    // 125% browser zoom == 1.25 device scale factor at a 1280x800 CSS viewport.
    await page.setViewport({ width: zoom === 1 ? 1600 : 1280, height: zoom === 1 ? 1000 : 800, deviceScaleFactor: zoom });
    await page.evaluateOnNewDocument((u, th) => {
      localStorage.setItem('beacon.demo.session.v1', JSON.stringify({ user: u, remember: true, startedAt: new Date().toISOString() }));
      localStorage.setItem('beacon.ui.v1', JSON.stringify({ scope: 'AR', theme: th, sidebarCollapsed: false, groupsCollapsed: {} }));
    }, user, theme);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const suffix = zoom === 1 ? theme : `${theme}-125pct`;
    for (const [name, url] of shots) {
      if (zoom !== 1 && name !== 'command-centre') continue;
      await page.goto(`http://localhost:4173${url}`, { waitUntil: 'networkidle0' });
      await wait(800);
      if (name === 'incidents-filter-open') {
        const btns = await page.$$('.bx-iconselect');
        if (btns[0]) await btns[0].click();
        await wait(200);
      }
      await page.screenshot({ path: path.join(OUT, `${name}-${suffix}.png`) });
      if (name === 'command-centre') {
        const side = await page.$('.bx-sidebar');
        await side.screenshot({ path: path.join(OUT, `sidebar-${suffix}.png`) });
        const m = await page.evaluate(() => {
          const rect = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
          const nav = [...document.querySelectorAll('.bx-nav-item')].map((a) => ({ icon: rect(a.querySelector('svg')), label: rect(a.querySelector('.bx-nav-label')) }));
          const chips = [];
          return { nav, chips };
        });
        const uniq = (arr) => [...new Set(arr)];
        console.log(`[${suffix}] sidebar icons: ${m.nav.length}; widths`, uniq(m.nav.map((n) => n.icon.w)), 'heights', uniq(m.nav.map((n) => n.icon.h)),
          'icon left', uniq(m.nav.map((n) => n.icon.l)), 'label left', uniq(m.nav.map((n) => n.label.l)));
        console.log(`[${suffix}] kpi chips: ${m.chips.length}; sizes`, uniq(m.chips.map((c) => `${c.w}x${c.h}`)), 'radius', uniq(m.chips.map((c) => c.radius)));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
        console.log(`[${suffix}] horizontal overflow:`, overflow);
      }
    }
    console.log(`[${suffix}] console/page errors:`, errors.length ? errors.slice(0, 5) : 'none');
    await page.close();
  }
  await browser.close();
  server.close();
})();
