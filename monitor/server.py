#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
「隔壁」项目 —— 在线进度看板  (零依赖，仅 Python 标准库)

启动：
    python monitor/server.py
然后浏览器打开  http://127.0.0.1:8787

它做什么：
    · 后台每 45 秒自动跑一遍 monitor/verify.py 的全部验收项
    · 把结果实时渲染成网页：哪张卡真通过了、哪张卡 GPT 虚报了、失败在哪一行
    · 顶部显示后端 / 前端 / 数据库的存活状态
    · 右上角「立即重新验收」按钮可手动触发

这是"监控 GPT 干活"的正确姿势：不信它说"完成了"，只看验收结果。
"""

import json
import socket
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify  # noqa: E402

PORT = 8787
REFRESH_EVERY = 45          # 秒
_cache = {"ts": 0, "data": None, "running": False}
_lock = threading.Lock()

# 本机设了 HTTP_PROXY，访问 127.0.0.1 必须显式绕过代理，否则会被绕路或失败
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def port_open(host, port, timeout=0.6):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def backend_ok():
    try:
        with _OPENER.open("http://127.0.0.1:8000/api/ping", timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def run_verify_now():
    """跑一次全量验收，结果写进缓存。加锁避免并发重入。"""
    with _lock:
        if _cache["running"]:
            return
        _cache["running"] = True
    try:
        data = verify.run_all()
        with _lock:
            _cache["ts"] = int(time.time())
            _cache["data"] = data
    except Exception as e:
        with _lock:
            _cache["ts"] = int(time.time())
            _cache["data"] = {"summary": [], "results": [],
                              "error": repr(e), "ts": int(time.time())}
    finally:
        with _lock:
            _cache["running"] = False


def bg_loop():
    while True:
        try:
            run_verify_now()
        except Exception:
            pass
        time.sleep(REFRESH_EVERY)


HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>隔壁 · 项目进度看板</title>
<style>
  :root{
    --bg:#faf7f2; --card:#fff; --brand:#ff6b35; --brand-dark:#e85d2a;
    --t1:#1f2937; --t2:#6b7280; --t3:#9ca3af; --line:rgba(0,0,0,.07);
    --ok:#22c55e; --okbg:#f0fdf4; --fail:#ef4444; --failbg:#fef2f2; --skip:#9ca3af; --skipbg:#f9fafb;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--t1);
    font:14px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
  .wrap{max-width:1080px;margin:0 auto;padding:28px 20px 60px}
  header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  h1{margin:0;font-size:22px;letter-spacing:-.01em}
  h1 b{color:var(--brand)}
  .sub{color:var(--t2);font-size:13px;margin-top:4px}
  button{background:var(--brand);color:#fff;border:0;border-radius:10px;
    padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
  button:hover{background:var(--brand-dark)}
  button:disabled{opacity:.5;cursor:default}
  .bar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 22px}
  .pill{display:inline-flex;align-items:center;gap:7px;background:var(--card);
    border:1px solid var(--line);border-radius:999px;padding:6px 13px;font-size:12.5px;color:var(--t2)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--skip);flex:none}
  .dot.on{background:var(--ok);box-shadow:0 0 0 3px rgba(34,197,94,.18)}
  .dot.off{background:var(--fail);box-shadow:0 0 0 3px rgba(239,68,68,.16)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.03);transition:.18s}
  .card:hover{box-shadow:0 4px 14px rgba(0,0,0,.07)}
  .card.pass{border-left:4px solid var(--ok)}
  .card.fail{border-left:4px solid var(--fail)}
  .card.skip{border-left:4px solid var(--line)}
  .crow{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .cname{font-weight:650;font-size:14.5px}
  .cnum{color:var(--t3);font-size:11.5px;font-variant-numeric:tabular-nums}
  .tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.02em}
  .tag.pass{background:var(--okbg);color:#15803d}
  .tag.fail{background:var(--failbg);color:#b91c1c}
  .tag.skip{background:var(--skipbg);color:var(--t2)}
  .counts{margin-top:9px;font-size:12px;color:var(--t2);font-variant-numeric:tabular-nums}
  .counts em{font-style:normal;color:var(--fail);font-weight:600}
  details{margin-top:10px}
  summary{font-size:12px;color:var(--brand);cursor:pointer;user-select:none;outline:none}
  summary:hover{text-decoration:underline}
  ul{margin:8px 0 0;padding-left:0;list-style:none;font-size:12.5px}
  li{padding:5px 0;border-top:1px dashed var(--line);color:var(--t2);word-break:break-word}
  li.ok{color:var(--t2)}
  li.bad{color:#b91c1c}
  li.sk{color:var(--t3)}
  li .m{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;margin-right:6px}
  .toast{position:fixed;left:50%;top:18px;transform:translate(-50%,-140%);
    background:#111827;color:#fff;padding:9px 18px;border-radius:10px;font-size:13px;
    transition:transform .25s ease;z-index:9}
  .toast.show{transform:translate(-50%,0)}
  footer{margin-top:26px;color:var(--t3);font-size:12px;line-height:1.9}
  code{background:#f3f1ed;padding:1.5px 6px;border-radius:5px;font-size:12px}
  .warnbar{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;
    padding:11px 15px;font-size:12.5px;margin-bottom:18px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>隔壁 <b>· 项目进度看板</b></h1>
      <div class="sub">不采信「已完成」这四个字，只采信验收结果</div>
    </div>
    <button id="btn">立即重新验收</button>
  </header>

  <div class="bar">
    <span class="pill"><i class="dot" id="d-be"></i> 后端 8000</span>
    <span class="pill"><i class="dot" id="d-fe"></i> 前端 5173</span>
    <span class="pill"><i class="dot" id="d-db"></i> 数据库 app.db</span>
    <span class="pill" id="p-ts">尚未验收</span>
  </div>

  <div id="banner"></div>
  <div class="grid" id="grid"></div>

  <footer>
    数据来源：<code>monitor/verify.py</code> 每 45 秒自动全量执行一次。<br>
    启动前后端：<code>uv run uvicorn app.main:app --reload --reload-dir app --port 8000</code> ／ <code>npm run dev</code><br>
    写操作验收后请恢复数据：<code>uv run python -m app.seed --reset</code>
  </footer>
</div>
<div class="toast" id="toast"></div>

<script>
const NAMES = {0:"环境打通",1:"数据层 + seed",2:"身份",3:"物品：列表/详情/发布",4:"想要",
  5:"留言",6:"标记已送出",7:"数据看板",8:"LLM 三件套",9:"UX 打磨",10:"交付材料"};

async function load(force){
  if(force){ document.getElementById('btn').disabled = true; toast('正在重新验收…'); }
  try{
    const r = await fetch('/api/report' + (force ? '?force=1' : ''), {cache:'no-store'});
    const d = await r.json();
    render(d);
  }catch(e){ toast('看板服务异常：' + e.message); }
  document.getElementById('btn').disabled = false;
}

function setDot(id, on){
  const el = document.getElementById(id);
  el.className = 'dot ' + (on ? 'on' : 'off');
}

function render(d){
  setDot('d-be', d.env?.backend);
  setDot('d-fe', d.env?.frontend);
  setDot('d-db',  d.env?.database);
  const age = d.age == null ? '' : (d.age < 60 ? d.age + ' 秒前' : Math.floor(d.age/60) + ' 分钟前');
  document.getElementById('p-ts').textContent = d.ts ? ('验收于 ' + age + (d.running ? ' · 后台正在跑' : '')) : '尚未验收';

  const banner = document.getElementById('banner');
  const fails = (d.summary||[]).reduce((n,c)=>n+c.failed,0);
  if(d.error){
    banner.innerHTML = '<div class="warnbar">验收脚本自身报错：<code>'+esc(d.error)+'</code></div>';
  } else if(fails > 0){
    banner.innerHTML = '<div class="warnbar">有 <b>'+fails+'</b> 项失败 —— 把下面标红的条目原样贴给 GPT，让它修完再报「完成」。</div>';
  } else if((d.summary||[]).some(c=>c.state==='pass')){
    banner.innerHTML = '';
  }

  const byCard = {};
  for(const r of (d.results||[])) (byCard[r.card] = byCard[r.card] || []).push(r);
  const cards = (d.summary||[]);
  const html = cards.map(c=>{
    const rows = byCard[c.card] || [];
    const bad = rows.filter(r=>r.ok===false);
    const sk  = rows.filter(r=>r.ok===null);
    let detail = '';
    if(bad.length || sk.length){
      detail = '<details><summary>查看 '+bad.length+' 项失败 / '+sk.length+' 项跳过</summary><ul>' +
        bad.map(r=>'<li class="bad"><span class="m">FAIL</span>'+esc(r.name)+'<br><span style="color:#6b7280">→ '+esc(r.detail||'')+'</span></li>').join('') +
        sk.map(r=>'<li class="sk"><span class="m">SKIP</span>'+esc(r.name)+' — '+esc(r.detail||'')+'</li>').join('') +
        '</ul></details>';
    } else if(rows.length){
      detail = '<details><summary>查看 '+rows.length+' 项全部通过</summary><ul>' +
        rows.map(r=>'<li class="ok"><span class="m">OK</span>'+esc(r.name)+'</li>').join('') + '</ul></details>';
    }
    return '<div class="card '+c.state+'">'+
      '<div class="crow"><span class="cname">卡 '+c.card+' · '+esc(NAMES[c.card]||c.name)+'</span>'+
      '<span class="tag '+c.state+'">'+({pass:'已通过',fail:'有问题',skip:'未开始'}[c.state])+'</span></div>'+
      '<div class="counts">通过 '+c.passed+' · <em>失败 '+c.failed+'</em> · 跳过 '+c.skipped+'</div>'+
      detail + '</div>';
  }).join('');
  document.getElementById('grid').innerHTML = html || '<div class="card skip">还没有数据。确认后端已启动后点右上角「立即重新验收」。</div>';
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
let tmr;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(tmr); tmr = setTimeout(()=>el.classList.remove('show'), 2200);
}

document.getElementById('btn').onclick = ()=>load(true);
load(false);
setInterval(()=>load(false), 5000);
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, ctype, body):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            return self._send(200, "text/html; charset=utf-8", HTML)
        if path == "/api/report":
            if "force=1" in self.path:
                threading.Thread(target=run_verify_now, daemon=True).start()
            with _lock:
                data = _cache["data"]
                ts = _cache["ts"]
                running = _cache["running"]
            payload = dict(data) if data else {"summary": [], "results": []}
            payload["ts"] = ts
            payload["running"] = running
            payload["age"] = int(time.time()) - ts if ts else None
            payload["env"] = {
                "backend": backend_ok(),
                "frontend": port_open("127.0.0.1", 5173),
                "database": (ROOT / "backend" / "app.db").exists(),
            }
            return self._send(200, "application/json; charset=utf-8",
                              json.dumps(payload, ensure_ascii=False))
        return self._send(404, "text/plain; charset=utf-8", "not found")


def main():
    print("=" * 58)
    print("  隔壁 · 项目进度看板")
    print("=" * 58)
    print(f"  打开：   http://127.0.0.1:{PORT}")
    print(f"  项目根： {ROOT}")
    print(f"  自动验收间隔：{REFRESH_EVERY} 秒")
    print("  停止：   Ctrl+C")
    print("=" * 58)
    threading.Thread(target=bg_loop, daemon=True).start()
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
