// 自动驱动「隔壁」完成整段演示流程，同时录屏 + 打时间戳 + 逐步截图。
//
// 用法：  node video/record.js
// 产出：  02-raw/<video>.webm      录屏
//         02-raw/beats.json        每个动作的时间戳（供 ffmpeg 按配音时间轴裁剪）
//         02-raw/shots/*.png       每步截图（用来核对这一步到底成没成）
//
// 设计原则：每一步都 try/catch，失败只记录不中断 —— 保证任何情况下都有一段可用的录屏。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EXE = path.join(process.env.USERPROFILE,
  'AppData', 'Local', 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe');
const BASE = 'http://127.0.0.1:5173';
const RAW = path.join(__dirname, '02-raw');
const SHOTS = path.join(RAW, 'shots');
const VW = 520, VH = 940;

fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(RAW)) {
  if (f.endsWith('.webm') || f === 'beats.json') fs.unlinkSync(path.join(RAW, f));
}

const beats = [];
let T0 = Date.now();
const now = () => Date.now() - T0;
const log = (...a) => console.log('  ', ...a);

function beat(name, note) {
  beats.push({ name, t: now(), note: note || '' });
  console.log(`[${(now() / 1000).toFixed(1)}s] ${name}${note ? '  — ' + note : ''}`);
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
  catch (e) { log('截图失败', name, e.message); }
}

// 平滑滚动，录出来的画面不会一跳一跳
async function glide(page, total, ms, steps = 30) {
  const dy = total / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await wait(ms / steps);
  }
}

async function clickText(page, text, opts = {}) {
  const loc = page.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
  await loc.waitFor({ state: 'visible', timeout: opts.timeout || 8000 });
  await loc.click({ timeout: 8000 });
  await wait(opts.after ?? 600);
}

async function tryStep(label, fn) {
  try { await fn(); }
  catch (e) { console.log(`   !! ${label} 失败：${e.message.split('\n')[0]}`); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
    recordVideo: { dir: RAW, size: { width: VW, height: VH } },
  });
  await ctx.addInitScript(() => localStorage.setItem('userId', '6'));
  const page = await ctx.newPage();

  // 等首屏稳定后再开始计时，避免把加载态录进去
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await wait(1500);
  T0 = Date.now();                     // 以"首屏就绪"为时间原点，与视频开头对齐
  await page.screenshot({ path: path.join(SHOTS, '00-baseline.png') });

  // ---------- B1 开场：首页缓慢下滚 ----------
  beat('B1-open', '首页卡片流');
  await glide(page, 260, 5000);
  await shot(page, 'B1');

  // ---------- B2 列表：新鲜度 / 筛选 / 搜索 ----------
  beat('B2-list', '滚动看三档新鲜度');
  await glide(page, 700, 6000);
  await wait(800);

  await tryStep('筛选免费送', async () => {
    beat('B2-filter-free');
    await clickText(page, '免费送', { after: 1800 });
    await shot(page, 'B2-filter');
  });
  await tryStep('恢复全部', async () => { await clickText(page, '全部', { after: 500 }); });

  await tryStep('搜索"书"', async () => {
    beat('B2-search');
    const box = page.locator('input[placeholder="搜物品名称或描述"]');
    await box.click();
    await box.type('书', { delay: 260 });
    await wait(2200);
    await shot(page, 'B2-search');
    await box.fill('');
    await wait(800);
  });

  // ---------- B3 详情页：点想要 ----------
  beat('B3-detail', '进入电磁炉详情');
  await page.goto(BASE + '/items/2', { waitUntil: 'networkidle' });
  await wait(1600);
  await shot(page, 'B3-top');
  await glide(page, 900, 5000, 26);
  await wait(600);
  await shot(page, 'B3-scrolled');

  await tryStep('点我想要', async () => {
    beat('B3-want');
    await page.mouse.wheel(0, -900);
    await wait(900);
    await clickText(page, '我想要', { after: 2200 });
    await shot(page, 'B3-want');
  });

  // ---------- B4 FAQ + 留言 ----------
  await tryStep('FAQ 还在吗', async () => {
    beat('B4-faq');
    await glide(page, 700, 2500, 14);
    await clickText(page, '还在吗？', { after: 300 });
    await wait(9000);                 // 等模型返回
    await shot(page, 'B4-faq');
  });

  await tryStep('发一条留言', async () => {
    beat('B4-msg');
    await glide(page, 500, 2000, 12);
    const ta = page.locator('textarea[placeholder="和邻居打个招呼…"]');
    await ta.click();
    await ta.type('请问面板的划痕明显吗？', { delay: 90 });
    await wait(700);
    await shot(page, 'B4-msg-typed');
    await page.locator('button[aria-label="发送留言"]').click();
    await wait(2500);
    await shot(page, 'B4-msg-sent');
  });

  // ---------- B5 发布页 ----------
  beat('B5-publish', '进入发布页');
  await page.goto(BASE + '/publish', { waitUntil: 'networkidle' });
  await wait(1500);
  await shot(page, 'B5-empty');

  await tryStep('填写表单', async () => {
    beat('B5-form');
    const name = page.locator('input[placeholder^="例如"]');
    await name.click();
    await name.type('九成新折叠小书桌', { delay: 85 });
    const desc = page.locator('textarea[placeholder^="说说成色"]');
    await desc.click();
    await desc.type('桌面没有划痕，白色，用了半年。搬家带不走，希望同小区自提。', { delay: 55 });
    await wait(900);
    await shot(page, 'B5-filled');
  });

  // ---------- B6 两个 AI 弹窗 ----------
  // 注意：这两个弹窗都是两步的 —— 点入口按钮只是"打开弹窗"，
  // 还要点弹窗**内部**的确认按钮才会真正发起模型调用。第一版漏了这一步，
  // 录出来只有空弹窗，没有 AI 结果。所以下面一律用 [role="dialog"] 限定作用域。
  const dlg = (sel) => page.locator(`[role="dialog"] ${sel}`);

  await tryStep('定价建议：打开并生成', async () => {
    beat('B6-price-open');
    await clickText(page, '获取定价建议', { after: 900 });
    await shot(page, 'B6-price-dialog');
    beat('B6-price-generate', '点弹窗内的「生成建议」');
    const go = dlg('button:has-text("生成建议")');
    await go.waitFor({ state: 'visible', timeout: 8000 });
    await go.click();
    await wait(15000);                       // 等模型返回
    await shot(page, 'B6-price-result');
  });
  await tryStep('关闭定价弹窗', async () => {
    const close = dlg('button[aria-label*="关闭"]');
    if (await close.count()) await close.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await wait(1000);
  });

  await tryStep('文案优化：打开并生成', async () => {
    beat('B6-polish-open');
    await clickText(page, '优化文案', { after: 900 });
    await shot(page, 'B6-polish-dialog');
    beat('B6-polish-generate', '点弹窗内的「优化文案」');
    const go = dlg('button:has-text("优化文案")');
    await go.waitFor({ state: 'visible', timeout: 8000 });
    await go.click();
    await wait(15000);
    await shot(page, 'B6-polish-result');
  });
  await tryStep('采用优化结果', async () => {
    beat('B6-adopt');
    for (const t of ['采用', '应用', '使用', '替换', '接受']) {
      const b = dlg(`button:has-text("${t}")`);
      if (await b.count()) { await b.click().catch(() => {}); await wait(1600); break; }
    }
    await shot(page, 'B6-adopted');
    const close = dlg('button[aria-label*="关闭"]');
    if (await close.count()) await close.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await wait(1000);
  });

  // ---------- B7 提交 + 标记送出 ----------
  await tryStep('提交发布', async () => {
    beat('B7-submit');
    await clickText(page, '免费送', { after: 500 });
    await page.locator('button:has-text("发布到楼里")').click();
    await wait(3000);
    await shot(page, 'B7-submitted');
  });

  await tryStep('小电扇标记送出', async () => {
    beat('B7-giveaway', '打开小电扇（刘同学自己的物品）');
    await page.goto(BASE + '/items/9', { waitUntil: 'networkidle' });
    await wait(1600);
    await glide(page, 700, 3000, 16);
    await wait(500);
    await shot(page, 'B7-owner-panel');
    await clickText(page, '标记为已送出', { after: 1500 });
    await shot(page, 'B7-dialog');
    // 弹窗里挑接收人，再确认
    const cand = page.locator('button:has-text("赵姐"), label:has-text("赵姐"), li:has-text("赵姐")').first();
    if (await cand.count()) { await cand.click().catch(() => {}); await wait(900); }
    await shot(page, 'B7-dialog-picked');
    for (const t of ['确定', '确认', '确认送出', '标记为已送出', '提交']) {
      const b = page.locator(`button:has-text("${t}")`).last();
      if (await b.count()) { await b.click().catch(() => {}); break; }
    }
    await wait(2600);
    await shot(page, 'B7-done');
  });

  // ---------- B8 归档 + 看板 ----------
  await tryStep('已送出归档', async () => {
    beat('B8-archived');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await wait(1400);
    await clickText(page, '已送出', { after: 2200 });
    await shot(page, 'B8-archived');
  });

  await tryStep('看板', async () => {
    beat('B8-dashboard');
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
    await wait(1200);
    await shot(page, 'B8-dashboard-top');
    await glide(page, 420, 4200, 20);
    await wait(1500);
    await shot(page, 'B8-dashboard-bottom');
  });

  // ---------- B9 收尾 ----------
  beat('B9-close', '回到首页缓慢下滚');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await wait(1400);
  await glide(page, 320, 5000);

  beats.push({ name: 'END', t: now(), note: '' });
  await ctx.close();                 // 关闭上下文才会把视频落盘
  await browser.close();

  fs.writeFileSync(path.join(RAW, 'beats.json'),
    JSON.stringify({ viewport: { width: VW, height: VH }, beats }, null, 2), 'utf-8');

  const webm = fs.readdirSync(RAW).find(f => f.endsWith('.webm'));
  console.log('\n录屏文件:', webm || '(未生成)');
  console.log('总时长: 约 %s 秒', (beats[beats.length - 1].t / 1000).toFixed(1));
  console.log('时间戳: 02-raw/beats.json');
  console.log('截图:   02-raw/shots/');
})().catch(e => { console.error('录制失败:', e); process.exit(1); });
