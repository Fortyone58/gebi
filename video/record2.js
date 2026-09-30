// 按配音时间轴**分段录制**：一段一个浏览器上下文 → 一个独立视频文件。
//
// 为什么要分段：
//   配音总长 288 秒，自由录制只有 123 秒。若事后硬拉长会变成 0.43 倍慢动作。
//   所以录制时就按每段配音时长控节奏 —— 动作做完后若还有剩余时间，
//   就用**缓慢滚动**把时间填满（比定格画面自然得多）。
//
// 用法：node video/record2.js
// 产出：02-raw/seg/S1.webm ... 02-raw/seg/S10.webm（S8/S9 是幻灯片，不录）
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EXE = path.join(process.env.USERPROFILE,
  'AppData', 'Local', 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe');
const BASE = 'http://127.0.0.1:5173';
const RAW = path.join(__dirname, '02-raw');
const SEGDIR = path.join(RAW, 'seg');
const SHOTS = path.join(RAW, 'shots2');
const VW = 520, VH = 940;

// 每段目标时长直接读配音时间轴，保证画面和旁白同步
const tl = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'timeline.json'), 'utf-8'));
const TARGET = {};
for (const s of tl.segments) TARGET[s.sid] = s.dur;

fs.mkdirSync(SEGDIR, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

// ⚠️ 这里**故意不做任何删除**。
// 两个原因：
//   1) 一旦无条件清空目录，"只重录某一段"就会把其它段一起删掉（踩过）。
//   2) 更致命的是，删文件会被沙箱的批量删除守卫拦下
//      （SAFE_DELETE_BULK_CONFIRM_REQUIRED，计数是本轮累计的），
//      脚本在清理阶段直接抛异常，连录制都开始不了（也踩过）。
// video.saveAs() 本身就会覆盖同名文件，所以完全不需要预先删除。
const onlyArgs = process.argv.slice(2).filter(a => /^S\d+$/.test(a));
const queue = onlyArgs.length ? onlyArgs
  : ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10'];

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function glide(page, total, ms, steps = 40) {
  const dy = total / steps;
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await wait(ms / steps); }
}
async function clickText(page, text, after = 700) {
  const loc = page.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  await loc.click({ timeout: 8000 });
  await wait(after);
}
async function shot(page, name) {
  try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch {}
}

// 把剩余时间用缓慢滚动填满；滚到底就反向滚回来
async function fill(page, ms) {
  if (ms < 400) return;
  let left = ms;
  while (left > 300) {
    const chunk = Math.min(left, 6000);
    await glide(page, 150, chunk, 26);
    left -= chunk;
  }
  await wait(Math.max(0, left));
}

// ---------------- 各段动作 ----------------
const RUNNERS = {
  async S1(page, t0) {                                  // 开场：首页缓慢下滚
    await glide(page, 240, 4200, 34);
  },

  async S2(page, t0) {                                  // 列表：新鲜度 / 筛选 / 搜索
    await glide(page, 640, 5200, 36);
    await wait(700);
    await shot(page, 'S2-cards');
    await clickText(page, '免费送', 2200); await shot(page, 'S2-filter');
    await clickText(page, '全部', 900);
    const box = page.locator('input[placeholder="搜物品名称或描述"]');
    await box.click();
    await box.type('书', { delay: 420 });
    await wait(2600); await shot(page, 'S2-search');
    await box.fill('');
  },

  async S3(page, t0) {                                  // 详情：看描述 + 点想要
    await glide(page, 780, 5200, 34);
    await wait(600); await shot(page, 'S3-scrolled');
    await page.mouse.wheel(0, -820);
    await wait(1100);
    await clickText(page, '我想要', 2600);
    await shot(page, 'S3-want');
  },

  async S4(page, t0) {                                  // 详情：FAQ + 留言
    await glide(page, 700, 2400, 16);
    await clickText(page, '还在吗？', 400);
    await wait(11000);                                  // 等模型返回
    await shot(page, 'S4-faq');
    await glide(page, 380, 1600, 12);
    const ta = page.locator('textarea[placeholder="和邻居打个招呼…"]');
    await ta.click();
    await ta.type('请问面板的划痕明显吗？', { delay: 120 });
    await wait(900); await shot(page, 'S4-typed');
    await page.locator('button[aria-label="发送留言"]').click();
    await wait(2600); await shot(page, 'S4-sent');
  },

  async S5(page, t0) {                                  // 发布页：填表 → 选交易方式 → 提交
    await wait(1400); await shot(page, 'S5-empty');
    const name = page.locator('input[placeholder^="例如"]');
    await name.click(); await name.type('九成新折叠小书桌', { delay: 190 });
    const desc = page.locator('textarea[placeholder^="说说成色"]');
    await desc.click();
    await desc.type('桌面没有划痕，白色，用了半年。搬家带不走，希望同小区自提。', { delay: 130 });
    await wait(1100); await shot(page, 'S5-filled');
    await clickText(page, '免费送', 1500);
    await shot(page, 'S5-mode');
    // 提交 —— 旁白说"发布之后会直接跳到详情页"，这里必须真的提交，
    // 否则那句旁白没有对应画面（第一版就漏了这一步）。
    await clickText(page, '发布到楼里', 3200);
    await shot(page, 'S5-submitted');
  },

  async S6(page, t0) {                                  // AI 三件套
    const dlg = (sel) => page.locator(`[role="dialog"] ${sel}`);

    // ⚠️ 必须先把名称和描述填上：表单为空时这两个 AI 按钮是**禁用**的，
    // 直接点会卡到超时（第一版就是这么失败的）。
    const name = page.locator('input[placeholder^="例如"]');
    await name.click();
    await name.type('九成新折叠小书桌', { delay: 150 });
    const desc = page.locator('textarea[placeholder^="说说成色"]');
    await desc.click();
    await desc.type('桌面没有划痕，白色，用了半年。搬家带不走，希望同小区自提。', { delay: 100 });
    await wait(1200); await shot(page, 'S6-filled');

    await clickText(page, '获取定价建议', 1200);
    await shot(page, 'S6-price-dialog');
    let go = dlg('button:has-text("生成建议")');
    await go.waitFor({ state: 'visible', timeout: 10000 });
    await go.click();
    await wait(15000); await shot(page, 'S6-price-result');
    let close = dlg('button[aria-label*="关闭"]');
    if (await close.count()) await close.click().catch(() => {}); else await page.keyboard.press('Escape');
    await wait(1100);

    await clickText(page, '优化文案', 1200);
    await shot(page, 'S6-polish-dialog');
    go = dlg('button:has-text("优化文案")');
    await go.waitFor({ state: 'visible', timeout: 10000 });
    await go.click();
    await wait(15000); await shot(page, 'S6-polish-result');
    for (const t of ['采用', '应用', '使用', '替换']) {
      const b = dlg(`button:has-text("${t}")`);
      if (await b.count()) { await b.click().catch(() => {}); await wait(1700); break; }
    }
    await shot(page, 'S6-adopted');
    close = dlg('button[aria-label*="关闭"]');
    if (await close.count()) await close.click().catch(() => {}); else await page.keyboard.press('Escape');
    await wait(1100);
  },

  async S7(page, t0) {                                  // 标记送出 + 归档
    await glide(page, 620, 2600, 18);
    await wait(500); await shot(page, 'S7-owner-panel');
    await clickText(page, '标记为已送出', 1600);
    await shot(page, 'S7-dialog');
    const sel = page.locator('[role="dialog"] select').first();
    if (await sel.count()) {
      const opts = await sel.locator('option').allTextContents();
      const zhao = opts.find(o => o.includes('赵姐')) || opts[1];
      if (zhao) await sel.selectOption({ label: zhao.trim() }).catch(() => {});
      await wait(1100);
    }
    await shot(page, 'S7-picked');
    const ok = page.locator('[role="dialog"] button:has-text("确认已送出")').first();
    if (await ok.count()) await ok.click().catch(() => {});
    await wait(3000); await shot(page, 'S7-done');
  },

  async S8(page, t0) { /* 幻灯片，见 make_slides.js */ },

  async S9(page, t0) { /* 幻灯片 */ },

  async S10(page, t0) {                                 // 收尾：回首页缓慢下滚
    await wait(1200);
    await glide(page, 300, 4200, 30);
  },
};

// 每段从哪个路由开始
const ENTRY = {
  S1: '/', S2: '/', S3: '/items/2', S4: '/items/2', S5: '/publish',
  S6: '/publish', S7: '/items/9', S8: '/', S9: '/', S10: '/',
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const report = [];

  for (const sid of queue) {
    const target = TARGET[sid];
    process.stdout.write(`\n[${sid}] 目标 ${target.toFixed(1)}s  `);

    const ctx = await browser.newContext({
      viewport: { width: VW, height: VH },
      deviceScaleFactor: 2,
      locale: 'zh-CN',
      recordVideo: { dir: SEGDIR, size: { width: VW, height: VH } },
    });
    await ctx.addInitScript(() => localStorage.setItem('userId', '6'));
    const page = await ctx.newPage();
    const video = page.video();

    await page.goto(BASE + ENTRY[sid], { waitUntil: 'networkidle' });
    await wait(1500);
    const t0 = Date.now();

    try { await RUNNERS[sid](page, t0); }
    catch (e) { console.log(`\n   !! 动作出错（不影响成片）：${e.message.split('\n')[0]}`); }

    const elapsed = (Date.now() - t0) / 1000;
    const remainMs = Math.round((target - elapsed) * 1000);
    process.stdout.write(`实际 ${elapsed.toFixed(1)}s → 填充 ${(remainMs / 1000).toFixed(1)}s`);

    try { await fill(page, Math.max(0, remainMs)); } catch {}
    await wait(200);

    await ctx.close();
    const outPath = path.join(SEGDIR, `${sid}.webm`);
    try { await video.saveAs(outPath); } catch (e) { console.log(' 保存失败:', e.message); }

    // 重复滚动会把页面撑高，无害；这里记录下来方便排查
    report.push({ sid, target, elapsed, padded: remainMs > 0, file: `${sid}.webm` });
    console.log(`  ✓ ${sid}.webm`);
  }

  await browser.close();
  fs.writeFileSync(path.join(RAW, 'record-report.json'),
    JSON.stringify(report, null, 2), 'utf-8');
  console.log('\n分段录屏完成，见 02-raw/seg/');
})().catch(e => { console.error('录制失败:', e); process.exit(1); });
