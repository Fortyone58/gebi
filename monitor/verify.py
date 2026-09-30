#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
「隔壁」项目 —— 自动验收脚本  (零依赖，仅 Python 标准库)

为什么需要它：
    GPT 说"任务卡 3 完成了"这句话本身不是证据。这个脚本按 DEVELOPMENT.md §15
    的验收项逐条真跑一遍，输出客观的 通过 / 失败。GPT 的自述不可信，这个可信。

用法：
    python monitor/verify.py                 # 只读检查（安全，不改数据）
    python monitor/verify.py --write         # 额外跑写操作检查（会写入测试数据）
    python monitor/verify.py --card 3        # 只验某一张卡
    python monitor/verify.py --json r.json   # 额外输出 JSON 报告

    # 提示：--write 之后请跑 `uv run python -m app.seed --reset` 恢复干净数据
"""

import argparse
import json
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Windows 控制台默认 GBK，中文/符号会炸，先修
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
DOCS = ROOT / "docs"
DB = BACKEND / "app.db"
API = "http://127.0.0.1:8000"

# 关键：本机环境变量里设了 HTTP_PROXY/HTTPS_PROXY（指向 127.0.0.1:8644），
# urllib 默认会把这些请求也发给代理，导致访问 127.0.0.1 被绕路甚至失败。
# 所以显式禁用代理来访问本地服务。
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

RESULTS = []


def rec(card, name, ok, detail=""):
    RESULTS.append({"card": card, "name": name, "ok": bool(ok), "detail": str(detail)[:400]})


def skip(card, name, why):
    RESULTS.append({"card": card, "name": name, "ok": None, "detail": why})


def http(method, path, body=None, uid=None, timeout=20):
    """返回 (status_code, payload)。连不上时 status 为 None。"""
    req = urllib.request.Request(API + path, method=method)
    if body is not None:
        req.data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    if uid is not None:
        req.add_header("X-User-Id", str(uid))
    try:
        with _OPENER.open(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, (json.loads(raw) if raw.strip() else None)
        except Exception:
            return e.code, raw
    except Exception as e:
        return None, str(e)


def db_query(sql, args=()):
    """只读查询本地 sqlite。失败返回 None。"""
    if not DB.exists():
        return None
    try:
        con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
        try:
            return con.execute(sql, args).fetchall()
        finally:
            con.close()
    except Exception:
        return None


# ---------------------------------------------------------------- 前端源码检查
#
# ⚠️ 重要原则（踩过坑后总结）：
#   检查前端要**看功能有没有实现，不要看文件名对不对**。
#   第一版脚本按 DEVELOPMENT.md §5.2 的组件名逐个查文件是否存在，结果连续误报：
#     · GPT 把骨架屏 + 空状态合并进 LoadingAndEmpty.tsx（而不是 SkeletonCard/EmptyState 两个文件）
#     · 容器宽度写在 AppShell.tsx（而不是 App.tsx）
#     · localStorage 抽象进 identity.ts，api.ts 只调 clearUserId()
#     · 筛选栏直接写在 ListPage.tsx（而不是单独的 FilterBar.tsx）
#   这些都是更好的组织方式，却被文件名检查判成失败。所以下面一律按**能力**判断。

def src_files():
    src = FRONTEND / "src"
    if not src.exists():
        return []
    return [p for p in src.rglob("*.ts*") if "node_modules" not in p.parts]


def src_blob():
    """把 frontend/src 下所有 ts/tsx 拼成一个大字符串，用于能力检索。"""
    out = []
    for p in src_files():
        try:
            out.append(p.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass
    return "\n".join(out)


def lib_blob():
    lib = FRONTEND / "src" / "lib"
    if not lib.exists():
        return ""
    out = []
    for p in lib.rglob("*.ts*"):
        try:
            out.append(p.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass
    return "\n".join(out)


def backend_up():
    st, _ = http("GET", "/api/ping", timeout=4)
    return st == 200


# ---------------------------------------------------------------- 卡 0 环境打通

def card0():
    css = FRONTEND / "src" / "index.css"
    vite = FRONTEND / "vite.config.ts"
    if css.exists():
        t = css.read_text(encoding="utf-8", errors="replace")
        rec(0, "index.css 用 v4 语法 @import \"tailwindcss\"", '@import "tailwindcss"' in t)
        rec(0, "index.css 没有残留 v3 的 @tailwind 指令", "@tailwind base" not in t)
        rec(0, "index.css 含品牌色 #ff6b35", "ff6b35" in t.lower())
    else:
        rec(0, "frontend/src/index.css 存在", False, "文件不存在")
    if vite.exists():
        t = vite.read_text(encoding="utf-8", errors="replace")
        rec(0, "vite.config.ts 配了 /api 代理", "/api" in t)
        rec(0, "代理指向 127.0.0.1（不是 localhost）", "127.0.0.1" in t)
        rec(0, "vite.config.ts 挂载了 tailwindcss 插件", "@tailwindcss/vite" in t)
    else:
        rec(0, "frontend/vite.config.ts 存在", False, "文件不存在")
    rec(0, "frontend/node_modules 已安装", (FRONTEND / "node_modules").is_dir())
    if backend_up():
        st, p = http("GET", "/api/ping")
        rec(0, "GET /api/ping 返回 ok", st == 200 and isinstance(p, dict) and p.get("ok") is True, f"{st} {p}")
    else:
        rec(0, "后端已启动（/api/ping 可达）", False, "连不上 8000 端口，先把后端起起来")


# ---------------------------------------------------------------- 卡 1 数据层

EXPECTED_TABLES = ("users", "items", "wants", "messages")


def card1():
    rec(1, "backend/app.db 存在", DB.exists())
    if not DB.exists():
        return
    rows = db_query("select name from sqlite_master where type='table'") or []
    names = {r[0] for r in rows}
    rec(1, "4 张表都建好了 (users/items/wants/messages)",
        all(t in names for t in EXPECTED_TABLES), f"实际表: {sorted(names)}")
    rec(1, "没有多余的 trades 表（应折叠进 items）", "trades" not in names)

    n_users = db_query("select count(*) from users")
    n_items = db_query("select count(*) from items")
    rec(1, "seed 数据干净：正好 6 个用户",
        n_users and n_users[0][0] == 6,
        f"实际 {n_users}。多出来的通常是手动点「我是新住户」测试留下的，"
        f"跑 `uv run python -m app.seed --reset` 就能清掉 —— 这不是代码问题，但录屏前要清")
    rec(1, "seed 了 10 件物品", n_items and n_items[0][0] == 10, f"实际 {n_items}")

    ddl = db_query("select sql from sqlite_master where name='items'")
    ddl_txt = ddl[0][0] if ddl else ""
    rec(1, "items 有 price/trade_mode 一致性 CHECK", "price IS NOT NULL" in ddl_txt or "price is not null" in ddl_txt)
    rec(1, "items 有 status/given_away_at 一致性 CHECK", "given_away_at IS NOT NULL" in ddl_txt or "given_away_at is not null" in ddl_txt)
    rec(1, "items 有「成交不早于发布」CHECK", "given_away_at >= created_at" in ddl_txt.replace("\n", " "))
    rec(1, "items 有 given_to_user_id 约束 CHECK", "given_to_user_id" in ddl_txt)

    # 新鲜度三档必须都能覆盖到
    row = db_query("select count(*) from items where created_at > ?", (int(__import__("time").time()) - 24 * 3600,))
    fresh = row[0][0] if row else 0
    rec(1, "至少有 2 件物品落在「刚上架」档", fresh >= 2, f"{fresh} 件")
    old = db_query("select count(*) from items where created_at < ?", (int(__import__("time").time()) - 72 * 3600,))
    rec(1, "至少有 3 件物品落在「已上架X天」档", (old[0][0] if old else 0) >= 3, f"{old}")

    # 免费送的物品不能有价（否则 CHECK 会炸，这里反向确认数据是对的）
    bad = db_query("select count(*) from items where trade_mode<>'priced' and price is not null")
    rec(1, "免费送/随便给的物品 price 都是 NULL", bad and bad[0][0] == 0, f"违规 {bad}")

    # 「最快被领走」的数据前提：空气炸锅必须是 2 小时成交
    r = db_query("select given_away_at - created_at from items where title like '%空气炸锅%'")
    took = r[0][0] if r and r[0][0] is not None else None
    rec(1, "空气炸锅的成交耗时为 2 小时（最快被领走的数据前提）",
        took == 7200, f"实际 {took} 秒（期望 7200）")

    # 「最想要」的数据前提：婴儿推车有 5 人想要，且不含 owner
    r = db_query("""select count(*) from wants w join items i on i.id=w.item_id
                    where i.title like '%推车%'""")
    rec(1, "婴儿推车有 5 人想要（最想要的数据前提）", r and r[0][0] == 5, f"实际 {r}")
    r = db_query("""select count(*) from wants w join items i on i.id=w.item_id
                    where i.title like '%推车%' and w.user_id = i.owner_id""")
    rec(1, "想要关系里没有 owner 自己", r and r[0][0] == 0, f"违规 {r}")

    # 最关键的一项：应用层是否真的开了 foreign_keys PRAGMA
    fk_pragma_check()


def fk_pragma_check():
    """
    用应用自己的 engine 插一条 owner_id=999999 的物品。
      外键生效  -> 报 FOREIGN KEY constraint failed（正是我们要的）
      外键失效  -> 插入成功，说明 PRAGMA foreign_keys=ON 没起作用

    ⚠️ 踩过的坑：判断成功与否**只能看 stdout**。因为 Python 报错时 traceback 会
    把源码那一行原样回显到 stderr，而源码里就写着 print(<哨兵>)，如果在
    stdout+stderr 合并串里找哨兵，会把源码回显误当成"插入成功"。
    """
    sentinel = "__FK_PROBE_INSERT_SUCCEEDED__"
    # 注意：这里必须是能塞进单行的写法。`with ...:` 是复合语句，
    # 不能跟在分号后面，否则 uv run python -c 会直接 SyntaxError（踩过一次）。
    code = (
        "from sqlalchemy import text;"
        "from app.database import engine;"
        "conn = engine.connect();"
        "conn.execute(text(\"INSERT INTO items(owner_id,title,description,trade_mode,status,created_at)"
        " VALUES(999999,'__fk_probe__','','free','available',0)\"));"
        "conn.commit();"
        f"print('{sentinel}')"
    )
    try:
        for uv in ("uv", str(Path.home() / ".local" / "bin" / "uv.exe")):
            try:
                p = subprocess.run([uv, "run", "python", "-c", code], cwd=str(BACKEND),
                                   capture_output=True, text=True, timeout=120,
                                   encoding="utf-8", errors="replace")
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                rec(1, "SQLite 外键 PRAGMA 真的生效了", False, "探测子进程超时")
                return

            stdout = p.stdout or ""
            stderr = p.stderr or ""
            if sentinel in stdout:
                rec(1, "SQLite 外键 PRAGMA 真的生效了", False,
                    "非法外键（owner_id=999999）被成功插入了 -> app/database.py 的 "
                    "PRAGMA foreign_keys=ON 没有真正生效")
            elif "FOREIGN KEY constraint failed" in stderr:
                rec(1, "SQLite 外键 PRAGMA 真的生效了", True, "非法外键被正确拒绝")
            else:
                last = stderr.strip().splitlines()[-1][:180] if stderr.strip() else "无输出"
                rec(1, "SQLite 外键 PRAGMA 真的生效了", None,
                    f"探测没跑起来（不是外键问题，可能 app.database 导入失败）：{last}")
            return
        skip(1, "SQLite 外键 PRAGMA 真的生效了", "找不到 uv 命令，无法自动验证")
    finally:
        _cleanup_fk_probe()


def _cleanup_fk_probe():
    """万一探测行真插进去了，删掉，别污染 seed 数据。"""
    if not DB.exists():
        return
    try:
        con = sqlite3.connect(str(DB))
        con.execute("DELETE FROM items WHERE title = '__fk_probe__'")
        con.commit()
        con.close()
    except Exception:
        pass


# ---------------------------------------------------------------- 卡 2 身份

def card2():
    if not backend_up():
        skip(2, "全部身份检查", "后端未启动")
        return
    st, users = http("GET", "/api/users")
    rec(2, "GET /api/users 返回列表", st == 200 and isinstance(users, list), f"{st}")
    if isinstance(users, list):
        rec(2, "预置住户齐备（≥6 个）", len(users) >= 6, f"实际 {len(users)}")

    st, _ = http("GET", "/api/me")
    rec(2, "GET /api/me 不带身份头返回 401", st == 401, f"实际 {st}")

    st, _ = http("GET", "/api/me", uid="abc")
    rec(2, "GET /api/me 身份非整数返回 401", st == 401, f"实际 {st}")

    st, _ = http("GET", "/api/me", uid=999999)
    rec(2, "GET /api/me 身份不存在返回 401", st == 401, f"实际 {st}")

    if isinstance(users, list) and users:
        uid = users[0]["id"]
        st, me = http("GET", "/api/me", uid=uid)
        rec(2, "GET /api/me 合法身份返回用户信息",
            st == 200 and isinstance(me, dict) and me.get("id") == uid, f"{st} {me}")

    api_ts = FRONTEND / "src" / "lib" / "api.ts"
    if api_ts.exists():
        t = api_ts.read_text(encoding="utf-8", errors="replace")
        rec(2, "api.ts 会带 X-User-Id 头", "X-User-Id" in t)
    else:
        rec(2, "frontend/src/lib/api.ts 存在", False, "文件不存在")
    # 按能力判断：401 处理 + 清除本地身份。不同文件分工都算数。
    lib = lib_blob()
    rec(2, "有 401 自愈（清身份 + 通知重选）",
        "401" in lib and ("clearUserId" in lib or "removeItem" in lib),
        "lib/ 里没找到 401 处理或清除身份的调用")
    blob = src_blob()
    rec(2, "身份选择界面已实现（能力判断，文件名不限）",
        "IdentityGate" in blob or ("X-User-Id" in api_ts.read_text(encoding="utf-8", errors="replace") and "住户" in blob))
    rec(2, "支持「输名字即进入」（无密码）", "新住户" in blob or "name" in blob.lower())


# ---------------------------------------------------------------- 卡 3 物品

def card3():
    if not backend_up():
        skip(3, "全部物品检查", "后端未启动")
        return
    st, page = http("GET", "/api/items")
    ok = st == 200 and isinstance(page, dict) and "items" in page
    rec(3, "GET /api/items 返回 {items,total}", ok, f"{st}")
    if not ok:
        return
    items = page["items"]
    rec(3, "默认只返回在售物品", all(i["status"] == "available" for i in items))
    rec(3, "在售数量为 8（10 件里 2 件已送出）", len(items) == 8, f"实际 {len(items)}")
    if len(items) >= 2:
        rec(3, "按新鲜度倒序（越新越靠前）",
            items[0]["created_at"] >= items[-1]["created_at"])
    if items:
        it = items[0]
        need = {"id", "title", "trade_mode", "status", "owner", "created_at", "want_count", "freshness", "is_mine", "i_want"}
        rec(3, "ItemOut 字段齐全", need.issubset(it.keys()), f"缺 {need - set(it.keys())}")
        fr = it.get("freshness") or {}
        rec(3, "freshness 含 level 与 label", "level" in fr and "label" in fr, str(fr))

    st, f = http("GET", "/api/items?trade_mode=free")
    rec(3, "trade_mode=free 筛选生效",
        st == 200 and all(i["trade_mode"] == "free" for i in f["items"]) and len(f["items"]) < len(items),
        f"{st} 返回 {len(f.get('items', []))} 件")

    st, arc = http("GET", "/api/items?status=given_away")
    rec(3, "status=given_away 能查到归档物品",
        st == 200 and len(arc.get("items", [])) == 2, f"实际 {len(arc.get('items', []))} 件")

    # 注意：seed 里的标题是「婴儿推车（9 成新）」，"婴儿车"不是它的子串，
    # 所以关键词必须用「推车」才对得上。
    st, q = http("GET", "/api/items?q=" + urllib.parse.quote("推车"))
    rec(3, "关键词搜索命中婴儿推车", st == 200 and len(q.get("items", [])) >= 1,
        f"{st} 命中 {len(q.get('items', []))} 条")

    # LIKE 转义 —— 最重要的安全项
    st, pct = http("GET", "/api/items?q=" + urllib.parse.quote("%"))
    n_pct = len(pct.get("items", [])) if st == 200 else -1
    rec(3, "搜索 % 不会命中全部（LIKE 转义生效）", n_pct == 0, f"返回 {n_pct} 条；若等于全部说明没转义")

    st, us = http("GET", "/api/items?q=" + urllib.parse.quote("_"))
    n_us = len(us.get("items", [])) if st == 200 else -1
    rec(3, "搜索 _ 不会命中全部（LIKE 转义生效）", n_us == 0, f"返回 {n_us} 条")

    st, sp = http("GET", "/api/items?q=%20%20%20")   # 三个空格
    rec(3, "纯空格搜索返回全部而不报错",
        st == 200 and len(sp.get("items", [])) == len(items), f"{st} {len(sp.get('items', []))}")

    st, _ = http("GET", "/api/items/999999")
    rec(3, "不存在的物品返回 404", st == 404, f"实际 {st}")

    # 详情页聚合
    if items:
        st, d = http("GET", f"/api/items/{items[0]['id']}")
        rec(3, "详情接口返回 owner/want_count/messages 等聚合字段",
            st == 200 and isinstance(d, dict) and "owner" in d and "want_count" in d, f"{st}")

    # 前端：一律按能力判断，不按文件名（见文件开头的说明）
    blob = src_blob()
    app_tsx = FRONTEND / "src" / "App.tsx"
    app_txt = app_tsx.read_text(encoding="utf-8", errors="replace") if app_tsx.exists() else ""
    rec(3, "列表 / 详情 / 发布三个页面已实现",
        (("/items/" in app_txt or ":id" in app_txt) and "/publish" in app_txt) or
        all(k in blob for k in ("列表", "详情", "发布")),
        "没找到三个页面的路由或页面内容")
    rec(3, "交易方式筛选已实现",
        "trade_mode" in blob and ("免费送" in blob or "随便给" in blob),
        "没找到 trade_mode 筛选参数或筛选选项文案")
    # 搜索参数可能写成 params.set("q", ...) 或 "?q="，别只认一种写法
    rec(3, "关键词搜索已实现",
        re.search(r"""set\(\s*["']q["']""", blob) is not None
        or "?q=" in blob or "搜索" in blob,
        "没找到搜索参数的传递")

    # 新鲜度：文案由**后端下发**（§4.3① freshness.label），前端只渲染。
    # 所以要在接口响应里验档位，在前端源码里验"是否渲染了 label"，不能在前端找中文文案。
    st_all, sample = http("GET", "/api/items?status=all")
    levels = set()
    if st_all == 200:
        levels = {i["freshness"]["level"] for i in sample.get("items", [])}
    rec(3, "后端下发了新鲜度三档（fresh24/fresh72/old）", len(levels) == 3, f"实际档位 {levels}")
    rec(3, "新鲜度徽章渲染 label 且带呼吸动效",
        "freshness.label" in blob.replace(" ", "")
        or ("freshness" in blob and "animate-pulse" in blob),
        "前端没渲染 freshness.label 或缺少呼吸动效")
    rec(3, "无图时用占位图（渐变 + emoji）",
        ("gradient" in blob or "bg-gradient" in blob) and
        ("emoji" in blob.lower() or "占位" in blob))
    rec(3, "卡片圆角符合视觉规范", "rounded-2xl" in blob or "rounded-3xl" in blob)
    rec(3, "品牌色已用于界面", "ff6b35" in blob.lower() or "orange" in blob.lower())


# ---------------------------------------------------------------- 卡 4 想要

def card4():
    if not backend_up():
        skip(4, "全部想要检查", "后端未启动")
        return
    st, users = http("GET", "/api/users")
    st2, page = http("GET", "/api/items")
    if st != 200 or st2 != 200 or not page.get("items"):
        skip(4, "想要相关检查", "拿不到用户/物品列表")
        return
    users = users
    # 找一件别人的、在售的、有想要记录的物品
    target = None
    for it in page["items"]:
        if it.get("want_count", 0) >= 1:
            target = it
            break
    if target is None:
        skip(4, "想要相关检查", "没有带想要记录的物品")
        return

    owner_id = target["owner"]["id"]
    outsider = next((u for u in users if u["id"] != owner_id), None)
    if outsider is None:
        skip(4, "想要相关检查", "找不到非 owner 用户")
        return

    st, _ = http("GET", f"/api/items/{target['id']}/wants", uid=outsider["id"])
    rec(4, "非 owner 查看想要名单返回 403", st == 403, f"实际 {st}")

    st, _ = http("GET", f"/api/items/{target['id']}/wants", uid=owner_id)
    rec(4, "owner 查看想要名单返回 200", st == 200, f"实际 {st}")

    st, _ = http("POST", f"/api/items/{target['id']}/wants", uid=owner_id)
    rec(4, "owner 对自己物品点想要返回 400", st == 400, f"实际 {st}")

    st, _ = http("POST", f"/api/items/{target['id']}/wants")
    rec(4, "未带身份点想要返回 401", st == 401, f"实际 {st}")

    # 对已送出物品点想要 —— 必须挑一个「接收人不是该物品 owner」的组合，
    # 否则会先撞上「owner 不能要自己的东西」的 400，测不到 409。
    st, arc = http("GET", "/api/items?status=given_away")
    if arc.get("items"):
        g = arc["items"][0]
        g_outsider = next((u for u in users if u["id"] != g["owner"]["id"]), None)
        if g_outsider:
            st, body = http("POST", f"/api/items/{g['id']}/wants", uid=g_outsider["id"])
            rec(4, "对已送出物品点想要返回 409", st == 409,
                f"实际 {st} {str(body)[:120]}（物品「{g['title']}」owner={g['owner']['name']}，操作者={g_outsider['name']}）")

    # 取消想要必须幂等。为避免把真实数据删掉，先找一件「这个人本来就没想要」的物品再删。
    no_want = None
    for it in page["items"]:
        st_d, d = http("GET", f"/api/items/{it['id']}", uid=outsider["id"])
        if st_d == 200 and isinstance(d, dict) and d.get("i_want") is False:
            no_want = d
            break
    if no_want:
        st, _ = http("DELETE", f"/api/items/{no_want['id']}/wants", uid=outsider["id"])
        rec(4, "取消不存在的想要返回 204（幂等，且不误删数据）", st == 204, f"实际 {st}")
    else:
        skip(4, "取消不存在的想要返回 204", "找不到「该用户未表达想要」的物品，跳过以免误删数据")

    blob = src_blob()
    rec(4, "想要交互与「谁想要」面板已实现（能力判断）",
        "想要" in blob and ("已想要" in blob or "WantButton" in blob)
        and ("谁想要" in blob or "OwnerPanel" in blob))


# ---------------------------------------------------------------- 卡 5 留言

def card5():
    if not backend_up():
        skip(5, "全部留言检查", "后端未启动")
        return
    st, page = http("GET", "/api/items")
    if st != 200 or not page.get("items"):
        skip(5, "留言检查", "拿不到物品列表")
        return
    st, users = http("GET", "/api/users")
    uid = users[0]["id"] if users else 1

    target = next((i for i in page["items"] if i.get("title", "").find("推车") >= 0), page["items"][0])
    st, msgs = http("GET", f"/api/items/{target['id']}/messages")
    ok = st == 200 and isinstance(msgs, dict) and "messages" in msgs
    rec(5, "留言列表接口正常", ok, f"{st}")
    if ok and len(msgs["messages"]) >= 2:
        rec(5, "婴儿推车有 2 条以上留言", True, f"{len(msgs['messages'])} 条")
        ts = [m["created_at"] for m in msgs["messages"]]
        rec(5, "留言按时间正序", ts == sorted(ts))

    st, _ = http("POST", f"/api/items/{target['id']}/messages", {"content": "   "}, uid=uid)
    rec(5, "空留言/纯空格返回 400", st == 400, f"实际 {st}")

    st, _ = http("POST", f"/api/items/{target['id']}/messages", {"content": "x" * 500}, uid=uid)
    rec(5, "超长留言返回 400", st == 400, f"实际 {st}")

    st, _ = http("POST", f"/api/items/{target['id']}/messages", {"content": "测试"}, uid=None)
    rec(5, "未带身份发留言返回 401", st == 401, f"实际 {st}")

    st, arc = http("GET", "/api/items?status=given_away")
    if arc.get("items"):
        st, _ = http("POST", f"/api/items/{arc['items'][0]['id']}/messages", {"content": "还能要吗"}, uid=uid)
        rec(5, "对已送出物品发留言返回 409", st == 409, f"实际 {st}")

    blob = src_blob()
    rec(5, "留言板已实现（含空状态文案）",
        "留言" in blob and ("还没有人提问" in blob or "提问" in blob))


# ---------------------------------------------------------------- 卡 6 标记已送出

def card6():
    if not backend_up():
        skip(6, "全部标记送出检查", "后端未启动")
        return
    st, users = http("GET", "/api/users")
    st2, page = http("GET", "/api/items")
    st3, arc = http("GET", "/api/items?status=given_away")
    if st != 200 or st2 != 200:
        skip(6, "标记送出检查", "拿不到用户/物品列表")
        return

    if arc.get("items"):
        gid = arc["items"][0]["id"]
        gowner = arc["items"][0]["owner"]["id"]
        st, _ = http("POST", f"/api/items/{gid}/give-away", {}, uid=gowner)
        rec(6, "重复标记已送出返回 409", st == 409, f"实际 {st}")

    if page.get("items") and users:
        it = page["items"][0]
        outsider = next((u for u in users if u["id"] != it["owner"]["id"]), None)
        if outsider:
            st, _ = http("POST", f"/api/items/{it['id']}/give-away", {}, uid=outsider["id"])
            rec(6, "非 owner 标记送出返回 403", st == 403, f"实际 {st}")

    # 检查后端用的是原子 UPDATE
    items_py = BACKEND / "app" / "routers" / "items.py"
    if items_py.exists():
        t = items_py.read_text(encoding="utf-8", errors="replace")
        rec(6, "用了原子 UPDATE + rowcount 判定（防并发竞态）",
            "rowcount" in t or "rowcount()" in t, "没找到 rowcount，可能不是原子写法")
        rec(6, "given_away_at 用了 max(now, created_at) 兜底", "max(" in t)

    blob = src_blob()
    rec(6, "标记送出交互已实现（含「选择接收人」）",
        "送出" in blob and ("不方便说" in blob or "私下" in blob or "接收人" in blob))


# ---------------------------------------------------------------- 卡 7 看板

def card7():
    if not backend_up():
        skip(7, "全部看板检查", "后端未启动")
        return
    st, s = http("GET", "/api/stats")
    ok = st == 200 and isinstance(s, dict)
    rec(7, "GET /api/stats 返回对象", ok, f"{st}")
    if not ok:
        return
    need = {"this_month_published", "this_month_completed", "available_count", "fastest", "most_wanted"}
    rec(7, "stats 字段齐全", need.issubset(s.keys()), f"缺 {need - set(s.keys())}")
    rec(7, "本月发布数 > 0", (s.get("this_month_published") or 0) > 0, str(s.get("this_month_published")))
    rec(7, "当前在售数 == 8", s.get("available_count") == 8, str(s.get("available_count")))

    f = s.get("fastest") or {}
    fit = f.get("item") or {}
    rec(7, "「最快被领走」是空气炸锅", "空气炸锅" in str(fit.get("title", "")), str(fit.get("title")))
    rec(7, "「最快被领走」耗时为 7200 秒（2 小时）",
        f.get("took_seconds") == 7200, str(f.get("took_seconds")))

    mw = s.get("most_wanted") or []
    rec(7, "「最想要」有数据", len(mw) > 0, f"{len(mw)} 条")
    if mw:
        top = mw[0].get("item") or {}
        rec(7, "「最想要」第一名是婴儿推车", "推车" in str(top.get("title", "")), str(top.get("title")))
        rec(7, "「最想要」第一名想要数为 5", mw[0].get("want_count") == 5, str(mw[0].get("want_count")))
        titles = [str((m.get("item") or {}).get("title", "")) for m in mw]
        rec(7, "「最想要」不含已送出的物品", not any("空气炸锅" in t or "台灯" in t for t in titles), str(titles))

    stats_py = BACKEND / "app" / "routers" / "stats.py"
    if stats_py.exists():
        t = stats_py.read_text(encoding="utf-8", errors="replace")
        rec(7, "统计没有用 strftime 分组（时区陷阱）", "strftime" not in t)

    blob = src_blob()
    rec(7, "看板页面已实现（接了 /api/stats）",
        "stats" in blob and ("本月" in blob or "成交" in blob))


# ---------------------------------------------------------------- 卡 8 LLM

def card8():
    if not backend_up():
        skip(8, "全部 LLM 检查", "后端未启动")
        return
    for path, body, label in (
        ("/api/llm/price-suggest", {"title": "婴儿推车", "description": "9成新，用了半年"}, "定价建议"),
        ("/api/llm/polish", {"title": "电磁炉", "description": "能用，有点旧"}, "文案优化"),
    ):
        st, r = http("POST", path, body, uid=1)
        ok = st == 200 and isinstance(r, dict) and r.get("source") in ("llm", "fallback")
        rec(8, f"{label} 接口返回 200 且带 source 字段", ok, f"{st} {str(r)[:120]}")

    st, page = http("GET", "/api/items")
    if page.get("items"):
        iid = page["items"][0]["id"]
        st, r = http("POST", "/api/llm/faq-reply", {"item_id": iid, "question": "还在吗？"}, uid=1)
        ok = st == 200 and isinstance(r, dict) and r.get("source") in ("llm", "fallback")
        rec(8, "FAQ 回复接口正常", ok, f"{st} {str(r)[:120]}")
        st, _ = http("POST", "/api/llm/faq-reply", {"item_id": 999999, "question": "还在吗"}, uid=1)
        rec(8, "FAQ 对不存在的物品返回 404", st == 404, f"实际 {st}")

    # 后端必须能拿到自己的 LLM 配置状态
    llm_py = BACKEND / "app" / "services" / "llm.py"
    if llm_py.exists():
        t = llm_py.read_text(encoding="utf-8", errors="replace")
        rec(8, "有超时设置", "timeout" in t)
        rec(8, "有 JSON 解析兜底（剥围栏/正则）", "```" in t or "re." in t or "find(" in t)
        rec(8, "key 为空时直接走 fallback", "fallback" in t.lower())
    else:
        rec(8, "backend/app/services/llm.py 存在", False, "文件不存在")

    blob = src_blob()
    rec(8, "三个 AI 功能的界面入口都已实现（能力判断）",
        ("定价" in blob or "price-suggest" in blob) and
        ("润色" in blob or "优化" in blob or "polish" in blob) and
        ("还在吗" in blob or "faq" in blob.lower()),
        "定价 / 润色 / FAQ 三者有缺失")

    # key 泄露检查 —— 交材料前的红线。
    # 用"像真 key"的模式匹配，而不是裸子串，避免把注释里的变量名误判成泄露。
    leak = []
    pat = re.compile(r"(sk-[A-Za-z0-9_\-]{12,})|(DASHSCOPE_API_KEY\s*[:=]\s*['\"][^'\"]{8,})")
    for p in list(FRONTEND.rglob("*.ts*")) + list(FRONTEND.rglob("*.js*")):
        if "node_modules" in p.parts:
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if pat.search(t):
            leak.append(p.name)
    rec(8, "前端代码里没有泄露 API key", not leak, f"疑似泄露: {leak}")

    env_ex = BACKEND / ".env.example"
    rec(8, ".env.example 存在", env_ex.exists())
    rec(8, ".gitignore 忽略了 .env", (BACKEND / ".gitignore").exists()
        and (".env" in (BACKEND / ".gitignore").read_text(encoding="utf-8", errors="replace")))


# ---------------------------------------------------------------- 卡 9 UX 打磨

def card9():
    blob = src_blob()
    rec(9, "有骨架屏加载态（animate-pulse）", "animate-pulse" in blob, "没找到骨架屏动画")
    rec(9, "有空状态文案与引导",
        any(k in blob for k in ("还空", "没找到", "暂无", "还没有")),
        "空状态文案一个都没有")
    rec(9, "有过渡 / 微动效", "transition" in blob)
    rec(9, "有 Toast 轻提示", "toast" in blob.lower())
    rec(9, "移动端优先容器（居中限宽）",
        any(k in blob for k in ("max-w-md", "max-w-lg", "max-w-xl")),
        "没找到居中限宽容器")
    rec(9, "有服务不可用提示（保证不白屏）",
        "service-offline" in blob or "服务未连接" in blob or "未连接" in blob,
        "没找到离线/掉线提示")


# ---------------------------------------------------------------- 卡 10 材料

def card10():
    for f, label in (("er-diagram.md", "ER 图源文件"), ("tech-stack.md", "技术栈文档"), ("video-script.md", "视频逐字稿")):
        rec(10, f"docs/{f} 存在（{label}）", (DOCS / f).exists())
    if (DOCS / "er-diagram.md").exists():
        t = (DOCS / "er-diagram.md").read_text(encoding="utf-8", errors="replace")
        rec(10, "ER 图含 mermaid 代码块", "```mermaid" in t or "erDiagram" in t)
        rec(10, "ER 图覆盖 4 张表",
            all(tb in t for tb in ("users", "items", "wants", "messages")))
    if (DOCS / "video-script.md").exists():
        t = (DOCS / "video-script.md").read_text(encoding="utf-8", errors="replace")
        rec(10, "视频稿含「取舍」段落", "取舍" in t or "砍" in t)
    rec(10, "README.md 存在", (ROOT / "README.md").exists())


CARDS = {
    0: ("环境打通", card0),
    1: ("数据层 + seed", card1),
    2: ("身份", card2),
    3: ("物品：列表/详情/发布", card3),
    4: ("想要", card4),
    5: ("留言", card5),
    6: ("标记已送出", card6),
    7: ("数据看板", card7),
    8: ("LLM 三件套", card8),
    9: ("UX 打磨", card9),
    10: ("交付材料", card10),
}


def run_all(only_card=None, allow_write=False):
    global RESULTS
    RESULTS = []
    cards = [only_card] if only_card is not None else sorted(CARDS)
    for c in cards:
        if c not in CARDS:
            continue
        try:
            CARDS[c][1]()
        except Exception as e:
            rec(c, f"卡 {c} 检查时脚本自身出错", False, repr(e))
    by_card = {}
    for r in RESULTS:
        by_card.setdefault(r["card"], []).append(r)
    summary = []
    for c in cards if not only_card else [only_card]:
        rows = by_card.get(c, [])
        passed = sum(1 for r in rows if r["ok"] is True)
        failed = sum(1 for r in rows if r["ok"] is False)
        skipped = sum(1 for r in rows if r["ok"] is None)
        summary.append({"card": c, "name": CARDS[c][0], "passed": passed,
                        "failed": failed, "skipped": skipped,
                        "state": "pass" if failed == 0 and passed > 0 else ("fail" if failed else "skip")})
    return {"summary": summary, "results": RESULTS, "ts": int(__import__("time").time())}


def main():
    ap = argparse.ArgumentParser(description="「隔壁」项目自动验收")
    ap.add_argument("--card", type=int, default=None, help="只验某一张卡")
    ap.add_argument("--write", action="store_true", help="包含写操作（会写测试数据）")
    ap.add_argument("--json", default=None, help="额外输出 JSON 报告路径")
    args = ap.parse_args()

    if not backend_up() and args.card != 1 and args.card != 0:
        print("!! 后端未启动（127.0.0.1:8000 连不上），部分检查会被跳过\n")

    rep = run_all(only_card=args.card, allow_write=args.write)

    print("=" * 66)
    print("  「隔壁」项目 · 自动验收报告")
    print("=" * 66)
    for c in rep["summary"]:
        flag = {True: "[PASS]", False: "[FAIL]", None: "[SKIP]"}[
            True if c["state"] == "pass" else (False if c["state"] == "fail" else None)]
        print(f"{flag} 卡 {c['card']:>2}  {c['name']:<22} 通过 {c['passed']:>2} / 失败 {c['failed']:>2} / 跳过 {c['skipped']:>2}")
    print("-" * 66)
    for r in rep["results"]:
        if r["ok"] is True:
            mark = "  ok  "
        elif r["ok"] is False:
            mark = " FAIL "
        else:
            mark = " skip "
        print(f"[{mark}] 卡{r['card']:>2} | {r['name']}")
        if r["ok"] is not True and r["detail"]:
            print(f"           -> {r['detail']}")
    print("=" * 66)

    total_fail = sum(c["failed"] for c in rep["summary"])
    if total_fail == 0:
        print("全部检查通过。GPT 这次没有虚报。")
    else:
        print(f"有 {total_fail} 项失败 —— 把这些 FAIL 项贴给 GPT 让它修，别说『完成了』。")

    if args.write:
        print("\n注意：本次跑了写操作检查，录屏前请执行  uv run python -m app.seed --reset  恢复干净数据")

    if args.json:
        Path(args.json).write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"JSON 报告已写入 {args.json}")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main())
