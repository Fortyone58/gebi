import type { CSSProperties } from "react";
import type { Item } from "../lib/types";

const palettes = [
  ["#f7c8a8", "#f5e6d7"],
  ["#cfe4d5", "#e6eddc"],
  ["#d8e3ee", "#edf0ef"],
  ["#edcfbf", "#f5e8dc"],
  ["#e7d8c4", "#f4eddf"],
  ["#d4e4e3", "#edf1e9"],
];

function hashTitle(title: string): number {
  let hash = 2166136261;
  for (let index = 0; index < title.length; index += 1) {
    hash ^= title.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function categoryEmoji(title: string): string {
  if (/书|杂志|绘本|笔记/.test(title)) return "📚";
  if (/婴|童|玩具|推车/.test(title)) return "🧸";
  if (/锅|电器|灯|风扇|吹风|咖啡|烤箱/.test(title)) return "🏠";
  if (/衣|鞋|包|帽/.test(title)) return "🧺";
  if (/桌|椅|柜|架|床/.test(title)) return "🪑";
  return "📦";
}

export function PlaceholderImage({ item, className = "" }: { item: Pick<Item, "title" | "image_url">; className?: string }) {
  if (item.image_url) {
    return (
      <img
        src={item.image_url}
        alt={item.title}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const palette = palettes[hashTitle(item.title) % palettes.length];
  const style: CSSProperties = { background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` };

  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden ${className}`} style={style} aria-label={`${item.title} 占位图`}>
      <span className="absolute -right-7 -top-9 size-32 rounded-full border border-white/30" />
      <span className="absolute -bottom-12 -left-7 size-36 rounded-full border border-white/30" />
      <span className="relative drop-shadow-sm text-5xl" aria-hidden="true">{categoryEmoji(item.title)}</span>
    </div>
  );
}
