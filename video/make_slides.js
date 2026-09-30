// 生成 S8（架构与数据库）和 S9（功能取舍）的静态幻灯片。
// 这两段共 102 秒，全是讲解，没有可录的界面 —— 用幻灯片填，每张配缓慢推镜。
//
// 用法：node video/make_slides.js
// 产出：02-raw/slides/S8a.png ... S9c.png（1840×840，与应用画面同高）
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EXE = path.join(process.env.USERPROFILE,
  'AppData', 'Local', 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe');
const OUT = path.join(__dirname, '02-raw', 'slides');
fs.mkdirSync(OUT, { recursive: true });

const W = 1840, H = 840;

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: "Microsoft YaHei", system-ui, sans-serif;
    background: #f7f3ec; color: #1f2937; padding: 56px 72px;
    display: flex; flex-direction: column;
  }
  .kicker { font-size: 24px; font-weight: 700; color: #ff6b35; letter-spacing: .06em; }
  h1 { font-size: 56px; font-weight: 800; margin: 10px 0 6px; letter-spacing: -.01em; }
  .sub { font-size: 25px; color: #8b8175; margin-bottom: 34px; }
  .body { flex: 1; display: flex; gap: 26px; }
  .col { flex: 1; display: flex; flex-direction: column; gap: 18px; }
  .card {
    background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 22px;
    padding: 22px 26px; box-shadow: 0 2px 10px rgba(60,45,30,.05);
  }
  .card h3 { font-size: 27px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
  .card p { font-size: 22px; line-height: 1.55; color: #514a42; }
  .num {
    display: inline-grid; place-items: center; width: 40px; height: 40px; flex: none;
    border-radius: 12px; background: #ffe9de; color: #e85d2a; font-size: 22px; font-weight: 800;
  }
  .num.g { background: #e4f4e8; color: #1f7a45; }
  .num.b { background: #e6eefc; color: #24559e; }
  .chain { display: flex; align-items: center; gap: 14px; }
  .box {
    flex: 1; background: #fff; border: 1px solid rgba(0,0,0,.07); border-radius: 18px;
    padding: 20px 16px; text-align: center; box-shadow: 0 2px 10px rgba(60,45,30,.05);
  }
  .box b { display: block; font-size: 25px; margin-bottom: 5px; }
  .box span { font-size: 19px; color: #8b8175; }
  .arrow { font-size: 30px; color: #c9bdb0; flex: none; }
  .tables { display: flex; gap: 18px; }
  .tbl { flex: 1; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 18px; padding: 18px; }
  .tbl b { font-size: 24px; color: #ff6b35; }
  .tbl ul { margin: 10px 0 0; padding-left: 22px; }
  .tbl li { font-size: 20px; line-height: 1.6; color: #514a42; }
  .rel { font-size: 21px; color: #6b6259; margin-top: 16px; }
  .rel code { background: #efe9e0; padding: 3px 9px; border-radius: 7px; font-size: 19px; }
  .tag { display:inline-block; font-size: 19px; padding: 4px 12px; border-radius: 999px; background:#efe9e0; color:#6b6259; margin-right:8px;}
  .big { font-size: 30px; font-weight: 800; color: #1f2937; }
  .muted { font-size: 21px; color: #8b8175; }
`;

const slides = {
  // ---------- S8 架构与数据库 ----------
  S8a: `
    <div class="kicker">架构分层</div>
    <h1>前后端完全解耦</h1>
    <div class="sub">前端只认接口，后端只认数据库；两边可以各自替换</div>
    <div class="body" style="flex-direction:column;justify-content:center;gap:34px">
      <div class="chain">
        <div class="box"><b>React + Vite</b><span>TypeScript · Tailwind</span></div>
        <div class="arrow">→</div>
        <div class="box"><b>Vite 代理</b><span>/api 统一转发</span></div>
        <div class="arrow">→</div>
        <div class="box"><b>FastAPI</b><span>Python · 同步接口</span></div>
        <div class="arrow">→</div>
        <div class="box"><b>SQLAlchemy</b><span>ORM · 声明式模型</span></div>
        <div class="arrow">→</div>
        <div class="box"><b>SQLite</b><span>4 张表</span></div>
      </div>
      <div class="card">
        <p>接口由 FastAPI 自动生成文档，可以脱离前端直接自测；前端通过代理访问，
        不需要写死后端地址，也不用手工处理跨域。</p>
      </div>
    </div>`,

  S8b: `
    <div class="kicker">数据库设计</div>
    <h1>四张表，按业务拆</h1>
    <div class="sub">一件物品最多送出一次，所以成交信息直接落在物品这一行</div>
    <div class="body" style="flex-direction:column;gap:20px">
      <div class="tables">
        <div class="tbl"><b>users</b>
          <ul><li>住户：姓名</li><li>楼栋房号</li><li>头像</li></ul></div>
        <div class="tbl"><b>items</b>
          <ul><li>名称 / 描述 / 图片</li><li>交易方式 + 价格</li><li>状态 / 发布时间</li><li>送出时间 / 接收人</li></ul></div>
        <div class="tbl"><b>wants</b>
          <ul><li>谁想要哪件</li><li>唯一约束</li><li>防重复表达</li></ul></div>
        <div class="tbl"><b>messages</b>
          <ul><li>公开留言板</li><li>围绕单件物品</li><li>时间正序</li></ul></div>
      </div>
      <div class="rel">
        <span class="tag">users 1—n items</span>
        <span class="tag">users 1—n wants</span>
        <span class="tag">items 1—n wants</span>
        <span class="tag">items 1—n messages</span>
        <br><br>
        时间统一存 <code>epoch 整数秒</code> · 新鲜度不入库，由发布时间实时计算
      </div>
    </div>`,

  S8c: `
    <div class="kicker">数据自洽</div>
    <h1>四条规则写进数据库</h1>
    <div class="sub">不靠前端自觉 —— 即使请求绕过界面校验，数据也不会自相矛盾</div>
    <div class="body">
      <div class="col">
        <div class="card"><h3><span class="num">1</span>标价就必须有价格</h3>
          <p>只有标价物品能带价格；免费送和随便给不允许填价。</p></div>
        <div class="card"><h3><span class="num">2</span>状态与送出时间同进同出</h3>
          <p>标记为已送出的那一刻，必须同时写入送出时间。</p></div>
      </div>
      <div class="col">
        <div class="card"><h3><span class="num">3</span>送出不可能早于发布</h3>
          <p>时间戳上的硬约束，连系统时钟异常都兜住了。</p></div>
        <div class="card"><h3><span class="num">4</span>没送出就没有接收人</h3>
          <p>接收人字段只在已送出状态下才允许存在。</p></div>
      </div>
    </div>`,

  // ---------- S9 功能取舍 ----------
  S9a: `
    <div class="kicker">功能取舍</div>
    <h1>时间有限，砍掉四件事</h1>
    <div class="sub">砍功能不是偷懒，是把时间集中到主流程上</div>
    <div class="body">
      <div class="col">
        <div class="card"><h3><span class="num">1</span>不做登录密码</h3>
          <p>熟人小区的场景，输入名字就能进入，也不需要信用体系。</p></div>
        <div class="card"><h3><span class="num">2</span>不做图片上传</h3>
          <p>用按名称生成的封面代替，识别物品已经够用。</p></div>
      </div>
      <div class="col">
        <div class="card"><h3><span class="num">3</span>不做分页，也不做编辑和撤销送出</h3>
          <p>数据量本来就小；让物品只能从在售走向已送出，减少分支。</p></div>
        <div class="card"><h3><span class="num">4</span>不做实时推送</h3>
          <p>留言板已经能解决沟通问题，不必上长连接。</p></div>
      </div>
    </div>`,

  S9b: `
    <div class="kicker">技术决策</div>
    <h1>三个技术上的判断</h1>
    <div class="sub">每一个都是为了让系统更简单、更好解释</div>
    <div class="body" style="flex-direction:column;gap:20px">
      <div class="card"><h3><span class="num g">1</span>成交信息折叠进物品表</h3>
        <p>一件物品最多送出一次，独立成表只会多一次关联查询、多一个状态不一致的机会；
        放在同一行还能直接用数据库约束"送出时间不早于发布时间"。</p></div>
      <div class="card"><h3><span class="num g">2</span>后端统一用同步接口</h3>
        <p>同步函数跑在线程池里，模型接口卡几十秒也只占用一个线程，不会冻结请求处理。</p></div>
      <div class="card"><h3><span class="num g">3</span>前端不引组件库和请求缓存框架</h3>
        <p>卡片和表单用 Tailwind 与 React 手写，依赖少，出问题更容易定位，也更容易讲清楚。</p></div>
    </div>`,

  S9c: `
    <div class="kicker">回到出发点</div>
    <h1>核心始终是那一件事</h1>
    <div class="body" style="align-items:center;justify-content:center;flex-direction:column;gap:26px">
      <div class="big" style="font-size:44px">让闲置物品，在被忘掉之前被看到</div>
      <div class="card" style="width:100%">
        <h3><span class="num b">→</span>后面可以继续做的方向</h3>
        <p style="margin-top:6px">
          真实账号登录 · 成交流水与审计 · 消息推送 · 物品多图与分类 ·
          接入真实小区的楼栋与门牌体系
        </p>
      </div>
    </div>`,
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, html] of Object.entries(slides)) {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${html}`,
      { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    console.log('  ✓', name + '.png');
  }
  await browser.close();
  console.log('\n幻灯片已生成，共', Object.keys(slides).length, '张 →', OUT);
})().catch(e => { console.error('幻灯片生成失败:', e); process.exit(1); });
