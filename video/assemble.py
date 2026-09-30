#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把分段录屏 + 幻灯片 + 配音合成为最终成片。

画面布局（1920×1080，暖白底 #f7f3ec）：
    ┌──────────────────────────────┐
    │        内容区 y=40..880       │   应用画面 464×840 居中
    │   （App 竖直居中最宽 1840）    │   幻灯片 1840×840 通栏
    ├──────────────────────────────┤
    │   字幕 y≈900..1030（46px）     │
    └──────────────────────────────┘

每段视频严格对齐该段配音时长：
    素材比配音长 → 加速（压缩 AI 等待这类空转时间）
    素材比配音短 → 轻微降速；仍不够就定格补足
    每段尾部再加 1 秒停顿，与配音音轨里的段间静音一一对应

用法：uv run python video/assemble.py [--only S6] [--no-burn]
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
SEG = ROOT / "02-raw" / "seg"
SLIDES = ROOT / "02-raw" / "slides"
OUT = ROOT / "out"
WORK = ROOT / "work"
SUB = WORK / "sub"
FONT = "msyh.ttc"                       # 已拷到 video/ 下，相对路径可避开冒号转义

FFMPEG = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
FFPROBE = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links" / "ffprobe.exe"

CANVAS = "1920x1080"
BG = "0xf7f3ec"
# 左侧放应用画面（竖直），右侧放"当前环节"说明文字 —— 否则 1920 宽画布上
# 手机画面只占四分之一，两侧全空着，很难看。
APP_H = 900
APP_W = 498                             # 520×940 等比缩到高 900
APP_X, CONTENT_Y = 96, 40
PANEL_X = 680                           # 右栏文字起始 x
SLIDE_W, SLIDE_H, SLIDE_X = 1840, 840, 40
SLIDE_Y = 60

# 每段的右栏标题（对应旁白讲到的环节）
SEG_TITLE = {
    "S1":  ("01 / 开场",        "让闲置在沉没之前被看到"),
    "S2":  ("02 / 浏览与检索",   "越新的东西，越靠前"),
    "S3":  ("03 / 意向表达",     "点一下心形就是想要"),
    "S4":  ("04 / 公开留言",     "问题让所有邻居都看得见"),
    "S5":  ("05 / 物品发布",     "一分钟发布一件闲置"),
    "S6":  ("06 / 大模型能力",   "定价 · 文案 · 常见问题"),
    "S7":  ("07 / 成交与看板",   "送出即归档，数据自动汇总"),
    "S10": ("10 / 收尾",        "核心始终是让人看见"),
}

SLIDE_PLAN = {                          # 幻灯片段：按旁白顺序排
    "S8": ["S8a", "S8b", "S8c"],
    "S9": ["S9a", "S9b", "S9c"],
}


def run(cmd, **kw):
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", **kw)


def dur_of(p: Path) -> float:
    p2 = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
              "-of", "csv=p=0", p])
    try:
        return float(p2.stdout.strip())
    except Exception:
        return 0.0


def parse_srt(text):
    """返回 [(start_sec, end_sec, line)]"""
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [l for l in block.splitlines() if l.strip()]
        if len(lines) < 3:
            continue
        m = re.match(r"(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)", lines[1])
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        s = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        e = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        out.append((s, e, " ".join(lines[2:])))
    return out


def esc_filter_path(p: str) -> str:
    """ffmpeg 滤镜里的路径：转义反斜杠并把盘符冒号换成 \\:（这里全是相对路径，基本用不到）"""
    return p.replace("\\", "/").replace(":", r"\:")


def panel_chain(sid):
    """右栏：环节编号 + 一句话标题（全程常显，不做时间窗）。"""
    if sid not in SEG_TITLE:
        return ""
    kicker, title = SEG_TITLE[sid]
    kf = SUB / ("%s_kicker.txt" % sid)
    tf = SUB / ("%s_title.txt" % sid)
    kf.write_text(kicker, encoding="utf-8")
    tf.write_text(title, encoding="utf-8")
    return (
        "drawtext=fontfile={font}:textfile={kf}:fontcolor=0xff6b35:fontsize=30:"
        "x={x}:y=372,"
        "drawtext=fontfile={font}:textfile={tf}:fontcolor=0x1f2937:fontsize=52:"
        "x={x}:y=424"
    ).format(font=FONT, kf=esc_filter_path("work/sub/" + kf.name),
             tf=esc_filter_path("work/sub/" + tf.name), x=PANEL_X)


def drawtext_chain(lines, t_base, width=1920, y=930):
    """给一段生成 drawtext 链：每条字幕在各自时间窗内显示，底部居中。"""
    parts = []
    for i, (s, e, txt) in enumerate(lines):
        f = SUB / ("l%03d.txt" % i)
        f.write_text(txt, encoding="utf-8")
        a, b = max(0.0, s - t_base), max(0.1, e - t_base)
        parts.append(
            "drawtext=fontfile={font}:textfile={tf}:fontcolor=0x1f2937:fontsize=46:"
            "line_spacing=12:x=(w-text_w)/2:y={y}:"
            "enable='between(t,{a:.2f},{b:.2f})'".format(
                font=FONT, tf=esc_filter_path("work/sub/" + f.name),
                y=y, a=a, b=b)
        )
    return ",".join(parts)


def build_segment(sid, seg, srt_lines, gap, log):
    """产出一段 1920×1080 的视频（无音轨）。"""
    want = seg["dur"] + gap
    src = SEG / (sid + ".webm")
    tmp = WORK / (sid + ".mp4")

    subs = [(s - seg["start"], e - seg["start"], t)
            for (s, e, t) in srt_lines
            if seg["start"] - 0.01 <= s <= seg["start"] + seg["dur"] + 0.01]

    chain = drawtext_chain(subs, 0.0, y=1000)

    if sid in SLIDE_PLAN:
        # 幻灯片段：把 N 张图串成一串，每张慢速推镜
        names = SLIDE_PLAN[sid]
        n = len(names)
        each = want / n
        parts = []
        for k, nm in enumerate(names):
            p = SLIDES / (nm + ".png")
            if not p.exists():
                log.append("  缺少幻灯片 %s" % p.name)
                return None
            parts.append((p, each, nm))
        # 逐张生成小片再拼接
        lst = WORK / ("_list_%s.txt" % sid)
        pieces = []
        for k, (p, d, nm) in enumerate(parts):
            piece = WORK / ("%s_%d.mp4" % (sid, k))
            frames = max(1, int(round(d * 25)))
            vf = ("zoompan=z='min(zoom+0.00025,1.06)':d={fr}:"
                  "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps=25").format(
                fr=frames, w=SLIDE_W, h=SLIDE_H)
            r = run([FFMPEG, "-y", "-framerate", "25", "-loop", "1", "-t", "%.3f" % d,
                     "-i", p, "-vf", vf, "-frames:v", frames,
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                     "-pix_fmt", "yuv420p", piece])
            if not piece.exists():
                log.append("  幻灯片小片失败 %s: %s" % (nm, (r.stderr or "")[-200:]))
                return None
            pieces.append(piece)
        lst.write_text("".join("file '%s'\n" % q.name for q in pieces), encoding="utf-8")
        merged = WORK / ("%s_slides.mp4" % sid)
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst,
             "-c", "copy", merged], cwd=str(WORK))
        base = merged if merged.exists() else pieces[0]
        vf = ("scale={sw}:{sh},pad={cw}:{ch}:{cx}:{cy}:color={bg},{panel},{chain}"
              .format(sw=SLIDE_W, sh=SLIDE_H, cw=1920, ch=1080,
                      cx=SLIDE_X, cy=SLIDE_Y, bg=BG, panel="", chain=chain))
        r = run([FFMPEG, "-y", "-i", base, "-vf", vf,
                 "-t", "%.3f" % want, "-r", "25",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                 "-pix_fmt", "yuv420p", tmp])
        rep = "幻灯片 %d 张" % len(pieces)
    else:
        if not src.exists():
            log.append("  缺少录屏 %s" % src.name)
            return None
        have = dur_of(src)
        factor = have / want if want > 0 else 1.0
        if factor >= 1.0:                       # 素材更长 → 加速
            vf0 = "setpts=PTS/{f:.5f}".format(f=factor)
            note = "加速 %.2fx" % factor
        elif factor >= 0.85:                    # 略短 → 轻微降速
            vf0 = "setpts=PTS/{f:.5f}".format(f=factor)
            note = "降速 %.2fx" % factor
        else:                                   # 差太多 → 降到 0.85 再定格补足
            vf0 = "setpts=PTS/0.85"
            note = "降速 0.85x + 定格"
        extra = ""
        if factor < 0.85:
            pad_s = want - have / 0.85
            extra = ",tpad=stop_mode=clone:stop_duration=%.3f" % max(0.0, pad_s)
        vf = ("{v},scale={sw}:{sh},pad={cw}:{ch}:{cx}:{cy}:color={bg},{panel},{chain}{x}"
              .format(v=vf0, sw=APP_W, sh=APP_H, cw=1920, ch=1080,
                      cx=APP_X, cy=CONTENT_Y, bg=BG,
                      panel=panel_chain(sid), chain=chain, x=extra))
        r = run([FFMPEG, "-y", "-i", src, "-vf", vf,
                 "-t", "%.3f" % want, "-r", "25",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                 "-pix_fmt", "yuv420p", tmp])
        rep = "%s（素材 %.1fs → 目标 %.1fs）" % (note, have, want)

    if not tmp.exists():
        log.append("  合成失败 %s: %s" % (sid, (r.stderr or "")[-400:]))
        return None
    log.append("  %-4s %s" % (sid, rep))
    return tmp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument("--no-burn", action="store_true", help="不烧字幕")
    args = ap.parse_args()

    if not FFMPEG.exists():
        print("找不到 ffmpeg"); return 1
    # 关键：把工作目录切到 video/。
    # ffmpeg 滤镜里的 fontfile=msyh.ttc 和 textfile=work/sub/xxx.txt 都是相对路径，
    # 不切目录它们会相对"调用者的目录"去找，直接报 Cannot read file。
    os.chdir(ROOT)
    WORK.mkdir(parents=True, exist_ok=True)
    SUB.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    tl = json.loads((OUT / "timeline.json").read_text(encoding="utf-8"))
    gap = tl.get("gap", 1.0)
    segs = tl["segments"]
    srt_all = parse_srt((OUT / "subtitles.srt").read_text(encoding="utf-8"))

    print("=" * 70)
    print("  合成成片 · 画布 %s · %d 段 · 段间留白 %.1fs" % (CANVAS, len(segs), gap))
    print("=" * 70)

    log, pieces = [], []
    for seg in segs:
        sid = seg["sid"]
        if args.only and sid != args.only:
            p = WORK / (sid + ".mp4")
            if p.exists():
                pieces.append(p)
            continue
        subs = srt_all if args.no_burn else srt_all
        p = build_segment(sid, seg, subs, gap, log)
        if p:
            pieces.append(p)
    print("\n".join(log))

    if len(pieces) != len(segs):
        print("\n!! 只完成 %d/%d 段，先修上面的报错" % (len(pieces), len(segs)))
        return 1

    lst = WORK / "_concat_all.txt"
    lst.write_text("".join("file '%s'\n" % p.name for p in pieces), encoding="utf-8")
    visual = OUT / "demo-visual.mp4"
    r = run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst,
             "-c", "copy", visual], cwd=str(WORK))
    if not visual.exists():
        print("拼接失败:", (r.stderr or "")[-500:]); return 1
    vd = dur_of(visual)
    print("\n画面轨: %s  (%.2f 秒)" % (visual, vd))

    audio = OUT / "voiceover-full.mp3"
    ad = dur_of(audio)
    print("配音轨: %s  (%.2f 秒)" % (audio, ad))

    final = OUT / "gebi-demo.mp4"
    r = run([FFMPEG, "-y", "-i", visual, "-i", audio,
             "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
             "-shortest", "-movflags", "+faststart", final])
    if not final.exists():
        print("合并失败:", (r.stderr or "")[-600:]); return 1
    fd = dur_of(final)
    print("\n" + "=" * 70)
    print("  ✅ 成片: %s" % final)
    print("     时长 %.2f 秒（%d 分 %02d 秒）" % (fd, int(fd) // 60, int(fd) % 60))
    print("     大小 %.1f MB" % (final.stat().st_size / 1048576))
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
