// 探针：把页面上的可交互元素和文本结构 dump 出来，用于写可靠的驱动脚本。
// 用法：node video/probe.js [路由]
const { chromium } = require('playwright-core');
const path = require('path');

const EXE = path.join(process.env.USERPROFILE,
  'AppData', 'Local', 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe');
const BASE = 'http://127.0.0.1:5173';
const route = process.argv[2] || '/';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 520, height: 940 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  });
  // 身份直接写进 localStorage，绕过身份弹窗
  await ctx.addInitScript(() => localStorage.setItem('userId', '6'));

  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  console.log('=== 路由 ' + route + ' ===');
  console.log('标题:', await page.title());

  // 可交互元素
  const els = await page.$$eval('button, a, input, select, textarea', nodes =>
    nodes.map((n, i) => {
      const r = n.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.top < 4000;
      return {
        i,
        tag: n.tagName.toLowerCase(),
        type: n.getAttribute('type') || '',
        text: (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        aria: n.getAttribute('aria-label') || '',
        ph: n.getAttribute('placeholder') || '',
        cls: (n.className || '').toString().slice(0, 70),
        y: Math.round(r.top),
        visible,
      };
    }).filter(e => e.visible)
  );
  console.log('--- 可交互元素 (' + els.length + ') ---');
  for (const e of els) {
    console.log(`  [${e.i}] <${e.tag}${e.type ? ' type=' + e.type : ''}> y=${e.y}`
      + (e.text ? ` text="${e.text}"` : '')
      + (e.aria ? ` aria="${e.aria}"` : '')
      + (e.ph ? ` placeholder="${e.ph}"` : ''));
  }

  // 页面可见文本（按块）
  const blocks = await page.$$eval('h1,h2,h3,p,span,li,div', nodes =>
    nodes.filter(n => n.children.length === 0)
      .map(n => ({ t: (n.innerText || '').trim(), y: Math.round(n.getBoundingClientRect().top) }))
      .filter(o => o.t && o.t.length > 1)
  );
  const seen = new Set();
  const uniq = blocks.filter(b => { const k = b.t; if (seen.has(k)) return false; seen.add(k); return true; });
  console.log('--- 文本片段 (' + uniq.length + ') ---');
  for (const b of uniq.slice(0, 90)) console.log(`  y=${b.y}  ${b.t.slice(0, 60)}`);

  console.log('--- 页面高度: ' + await page.evaluate(() => document.body.scrollHeight) + ' ---');
  if (errs.length) {
    console.log('--- 控制台错误 ---');
    errs.slice(0, 10).forEach(e => console.log('  ' + e.slice(0, 160)));
  }
  await browser.close();
})().catch(e => { console.error('探针失败:', e.message); process.exit(1); });
