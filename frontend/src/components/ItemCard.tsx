import { Heart, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { FreshnessBadge } from "./FreshnessBadge";
import { PlaceholderImage } from "./PlaceholderImage";
import { TradeModeTag } from "./TradeModeTag";

export function ItemCard({ item }: { item: Item }) {
  const count = item.want_count > 99 ? "99+" : String(item.want_count);

  return (
    <Link
      to={`/items/${item.id}`}
      className="group relative flex min-w-0 gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-[#f0ebe3] sm:h-32 sm:w-32">
        <PlaceholderImage item={item} />
        {item.status === "given_away" && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-gray-900/75 px-2 py-1 text-[10px] font-semibold text-white">已送出</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-5 text-gray-900 transition-colors group-hover:text-brand-dark">{item.title}</h2>
          <FreshnessBadge freshness={item.freshness} />
        </div>
        <div className="flex items-center gap-2">
          <TradeModeTag mode={item.trade_mode} />
          {item.trade_mode === "priced" && item.price !== null && (
            <span className="shrink-0 text-sm font-bold tabular-nums text-brand">¥{item.price.toLocaleString()}</span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-gray-500">{item.description || "邻居发布的闲置物品"}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-gray-500">
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={12} className="shrink-0" />{item.owner.room_no || "楼内自提"}</span>
          <span className="flex shrink-0 items-center gap-1 tabular-nums"><Heart size={13} className="text-rose-500" />{item.want_count === 0 ? "还没人想要" : count}</span>
        </div>
      </div>
    </Link>
  );
}
