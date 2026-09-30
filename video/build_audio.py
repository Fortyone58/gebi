#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
「隔壁」讲解视频 —— 配音生成 + 时间轴 + 字幕

做三件事：
  1. 用 edge-tts 把 10 段旁白生成 01-*.mp3 ... 10-*.mp3
  2. 用 ffprobe 量出每段真实时长，算出累计时间轴（不是估算）
  3. 按真实时长生成 SRT 字幕，并把 10 段用 1 秒静音拼成一条完整音轨

用法：
    uv run --with edge-tts python video/build_audio.py            # 默认音色
    uv run --with edge-tts python video/build_audio.py --voice zh-CN-XiaoxiaoNeural
    uv run --with edge-tts python video/build_audio.py --rate +5%

注意：不要用 `uv tool run edge-tts` 一段一段调 CLI —— 每段都要新起一个进程，
10 段会慢到超时；而且在线的微软接口连续请求会限流（生成 0 字节文件）。
所以这里直接在进程内 import edge_tts，并带退避重试。
"""

import argparse
import asyncio
import json
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("!! 缺少 edge_tts。请用：uv run --with edge-tts python video/build_audio.py")
    sys.exit(2)

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / "01-audio"
OUT = ROOT / "out"

UV = Path.home() / ".local" / "bin" / "uv.exe"
FFMPEG = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
FFPROBE = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links" / "ffprobe.exe"

# 10 段旁白正文。刻意不含引号/括号/书名号，数字全部写中文读法，避开 TTS 念歪。
SEGMENTS = [
    ("S1", "开场", 72,
     "业主群里的东西沉得太快。真正需要的人还没看到，消息就被刷走了。"
     "我做了一个叫隔壁的小工具，专门给同一栋楼的邻居用。"
     "它的目标只有一个，让闲置物品在沉没之前被看到。"),

    ("S2", "列表页：新鲜度 / 筛选 / 搜索", 103,
     "打开首页，看到的是正在流转的闲置。每张卡片上都标着新鲜度，"
     "一天以内显示刚上架，三天以内显示新上架，再久就显示已经上架多少天。"
     "所以我不用去翻聊天记录，越新的东西越靠前。"
     "上面可以按交易方式筛选，比如只看免费送的，也可以直接搜关键词。"),

    ("S3", "详情页：点想要", 86,
     "点进一件物品，能看到完整描述、发布者是谁、住在哪一栋，还有多少人想要。"
     "如果我也想要，点一下这个心形按钮就行，发布者那边立刻能看到多了一个人。"
     "已经点过的状态会保留，再点一次就是取消，不会重复计数。"),

    ("S4", "详情页：提问与留言", 68,
     "想了解细节，不用去私聊打扰对方。这里有几个常见问题，点一下就能得到回答。"
     "也可以直接在留言板里提问，问题所有邻居都能看到，避免同一个人被反复问同样的事。"),

    ("S5", "发布页", 75,
     "如果我自己也有闲置，从这里发布。填名称、描述，选一种交易方式，"
     "免费送、随便给或者标价转让。"
     "这里不需要上传照片，系统会按物品名称自动生成一张封面。发布之后会直接跳到详情页。"),

    ("S6", "AI 三件套", 232,
     "接下来是和大模型结合的三件事。第一件，定价建议。输入名称和描述，"
     "它给我一个参考区间和理由，比如这件建议三十到八十块，因为它用了一年、成色偏旧。"
     "它只是建议，最终价格我决定。第二件，文案优化。我写的描述通常很随意，"
     "它会帮我整理成更清楚、更吸引人的转让文案，我可以采用，也可以放弃。"
     "第三件，常见问题回复。我把这件物品的真实状态、价格、成色都放进了提示词，"
     "所以问它还在吗，它能准确回答还在的。这就是一次最小化的检索增强生成，"
     "先从数据库取出相关记录，再交给模型组织成回答。"
     "如果模型服务临时不可用，它会自动换成规则回复，不会卡住主流程。"),

    ("S7", "标记送出 + 数据看板", 100,
     "一件东西送出去之后，发布者把它标记为已送出，它进入归档状态。"
     "归档的物品还能查看，但不能再操作，历史记录都保留着。"
     "最后是数据看板，这里能看到本月发布和成交的数量、当前在售的数量，"
     "还有被最快领走的那一件，和最多人想要的那一件。"),

    ("S8", "架构与数据库设计", 232,
     "技术上，前端用 React 加 Vite 和 TypeScript，后端用 Python 的 FastAPI 框架，"
     "数据库是 SQLite，通过 SQLAlchemy 访问。"
     "前端的请求统一经过 Vite 代理转发到后端，两边完全解耦。"
     "数据库按业务拆成四张表，住户、物品、想要关系和留言。"
     "物品表上还固化了四条数据库级约束。第一，只有标价物品能有价格，标价就必须填价格。"
     "第二，物品状态和送出时间必须同时成立。第三，送出时间不能早于发布时间。"
     "第四，只有已送出的物品才能指定接收人。"
     "把这些规则放在数据库层，即使请求绕过前端校验，数据也不会自相矛盾。"),

    ("S9", "功能取舍与技术决策", 235,
     "最后说说时间有限时我做了哪些取舍。第一，不做登录密码，熟人小区的场景，"
     "输入名字就能进入，省下的时间全放在主流程上。"
     "第二，不做图片上传，用按名称生成的封面代替，识别物品够用了。"
     "第三，不做分页，也不做编辑、删除和撤销送出，让物品只能从在售走向已送出，减少分支。"
     "第四，实时推送先不做。技术上还有三个决定。成交记录我折叠进了物品表，"
     "因为一件物品最多送出一次，拆开只会多一次关联查询。"
     "后端统一用同步接口，避免模型调用阻塞事件循环。"
     "前端不引组件库和请求缓存框架，卡片和表单都用 Tailwind 和 React 手写，"
     "依赖少，出了问题更容易定位。"),

    ("S10", "收尾", 63,
     "做产品不只是加功能，更要判断哪些事值得做。"
     "后面可以接真实登录、成交流水和消息推送，"
     "但核心始终是那件事，让邻居之间的闲置，在被忘掉之前被看到。"),
]

GAP = 1.0   # 段间静音，让画面动作有呼吸


def count_chars(s: str) -> int:
    return len(re.findall(r'[\u4e00-\u9fff0-9A-Za-z]', s))


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", **kw)


def probe_duration(path: Path) -> float:
    p = run([str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(path)])
    try:
        return float(p.stdout.strip())
    except Exception:
        return 0.0


def fmt(t: float) -> str:
    t = max(0.0, t)
    return "%d:%02d" % (int(t) // 60, int(t) % 60)


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def split_for_srt(text: str, max_len: int = 20):
    """
    切成适合字幕的行。

    ⚠️ 别直接按逗号切 —— 会把句子切得极碎，出现只剩 "TypeScript，" 这种尴尬行。
    正确做法：先按句末标点（。！？；）切成句子，再贪心打包到 max_len；
    只有单个句子本身就超长时，才退而在逗号处拆。
    """
    sentences = [s.strip() for s in re.split(r'(?<=[。！？；])', text) if s.strip()]
    lines, cur = [], ""
    for s in sentences:
        if len(s) > max_len:
            if cur:
                lines.append(cur); cur = ""
            for ch in re.split(r'(?<=[，、])', s):
                ch = ch.strip()
                if not ch:
                    continue
                if len(cur) + len(ch) <= max_len:
                    cur += ch
                else:
                    if cur:
                        lines.append(cur)
                    cur = ch
        elif len(cur) + len(s) <= max_len:
            cur += s
        else:
            if cur:
                lines.append(cur)
            cur = s
    if cur:
        lines.append(cur)
    return lines or [text[:max_len]]


def synth(text: str, path: Path, voice: str, rate: str) -> bool:
    """在进程内合成一段；在线接口会限流，返回 0 字节文件，所以退避重试 4 次。"""
    for attempt in range(4):
        path.unlink(missing_ok=True)
        try:
            asyncio.run(edge_tts.Communicate(text, voice, rate=rate).save(str(path)))
        except Exception as e:
            print("      · %s" % str(e)[:110])
        if path.exists() and path.stat().st_size > 2000:
            return True
        wait = 1.5 * (attempt + 1)
        if attempt < 3:
            print("      · 第 %d 次失败，退避 %.1fs" % (attempt + 1, wait))
            time.sleep(wait)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="zh-CN-YunyangNeural",
                    help="edge-tts 音色，默认 Yunyang（专业播报）")
    ap.add_argument("--rate", default="+0%", help="语速，如 +5%% / -5%%")
    ap.add_argument("--no-tts", action="store_true", help="跳过生成，只用已有音频重算时间轴/字幕")
    ap.add_argument("--force", action="store_true", help="即使音频已存在也重新生成")
    args = ap.parse_args()

    if not FFMPEG.exists():
        print("!! 找不到 ffmpeg:", FFMPEG); return 1
    AUDIO.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in AUDIO.glob("_*"):
        old.unlink()

    print("=" * 68)
    print("  「隔壁」配音生成 · 音色 %s · 语速 %s" % (args.voice, args.rate))
    print("=" * 68)

    rows = []
    for i, (sid, name, _declared, text) in enumerate(SEGMENTS, 1):
        mp3 = AUDIO / ("%02d-%s.mp3" % (i, sid))
        n = count_chars(text)
        if not args.no_tts:
            if mp3.exists() and mp3.stat().st_size > 2000 and not args.force:
                print("  [跳过] %-4s %-24s 已存在且有效" % (sid, name))
            else:
                ok = synth(text, mp3, args.voice, args.rate)
                if not ok:
                    print("  [FAIL] %-4s %-24s 重试 4 次仍未成功（多为在线接口限流，稍后重跑会自动续）"
                          % (sid, name))
                    rows.append({"sid": sid, "name": name, "chars": n, "dur": 0.0, "ok": False})
                    continue
                time.sleep(0.5)      # 段间留间隔，降低被限流的概率
        dur = probe_duration(mp3)
        good_seg = dur > 0
        rows.append({"sid": sid, "name": name, "chars": n, "dur": dur,
                     "rate": (n / dur) if dur else 0, "ok": good_seg,
                     "file": mp3.name})
        print("  [%s] %-4s %-24s %4d 字  %6.2f 秒  %.2f 字/秒  %s"
              % ("ok" if good_seg else "FAIL", sid, name, n, dur,
                 (n / dur) if dur else 0, mp3.name))

    good = [r for r in rows if r["ok"]]
    if not good:
        print("\n没有任何音频生成成功。先用 --list-voices 确认音色名，或检查网络。")
        return 1

    # 累计时间轴
    cur = 0.0
    for r in rows:
        r["start"] = cur
        r["end"] = cur + r["dur"]
        cur += r["dur"] + GAP
    total = cur - GAP

    print("-" * 68)
    print("%-5s %-24s %6s %8s   %-15s" % ("段", "内容", "字数", "时长", "时间轴"))
    print("-" * 68)
    for r in rows:
        print("%-5s %-24s %6d %8.2f   %s → %s"
              % (r["sid"], r["name"], r["chars"], r["dur"], fmt(r["start"]), fmt(r["end"])))
    print("-" * 68)
    n_chars = sum(r["chars"] for r in rows)
    print("总字数 %d｜净配音 %s｜含段间留白成片约 %s" % (n_chars, fmt(total), fmt(total)))
    if total > 300:
        print("⚠️ 超过 5 分钟 %.1f 秒 —— 用 --rate=+8%% 重出，或删减 S9。" % (total - 300))
    else:
        print("✅ 在 5 分钟以内，余量 %.1f 秒" % (300 - total))

    # 合并成一条完整音轨
    gap = AUDIO / "_gap.mp3"
    run([str(FFMPEG), "-y", "-f", "lavfi", "-t", str(GAP),
         "-i", "anullsrc=r=24000:cl=mono", "-q:a", "9", str(gap)])
    lst = AUDIO / "_concat.txt"
    with lst.open("w", encoding="utf-8") as f:
        for i, r in enumerate([x for x in rows if x["ok"]]):
            if i:
                f.write("file '%s'\n" % gap.name)
            f.write("file '%s'\n" % r["file"])
    merged = OUT / "voiceover-full.mp3"
    p = run([str(FFMPEG), "-y", "-f", "concat", "-safe", "0",
             "-i", str(lst), "-c", "copy", str(merged)], cwd=str(AUDIO))
    if merged.exists():
        print("\n完整音轨: %s  (%.2f 秒)" % (merged, probe_duration(merged)))
    lst.unlink(missing_ok=True)
    gap.unlink(missing_ok=True)

    # 生成 SRT
    srt_lines, idx = [], 0
    for r in rows:
        if not r["ok"]:
            continue
        src = next(s for s in SEGMENTS if s[0] == r["sid"])
        lines = split_for_srt(src[3])
        total_chars = sum(len(x) for x in lines) or 1
        t = r["start"]
        for ln in lines:
            if idx:
                srt_lines.append("")
            share = r["dur"] * (len(ln) / total_chars)
            idx += 1
            srt_lines.append(str(idx))
            srt_lines.append("%s --> %s" % (srt_time(t), srt_time(t + share - 0.05)))
            srt_lines.append(ln)
            t += share
    srt = OUT / "subtitles.srt"
    srt.write_text("\n".join(srt_lines) + "\n", encoding="utf-8")
    print("字幕文件: %s  (%d 条)" % (srt, idx))

    # 存一份 JSON，供后续录屏/合成脚本使用
    plan = OUT / "timeline.json"
    plan.write_text(json.dumps({"voice": args.voice, "rate": args.rate,
                                "gap": GAP, "total": total, "segments": rows},
                               ensure_ascii=False, indent=2), encoding="utf-8")
    print("时间轴:   %s" % plan)
    return 0


if __name__ == "__main__":
    sys.exit(main())
