import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "../lib/api";
import type { Item, ItemListResponse, TradeMode } from "../lib/types";
import { EmptyState, SkeletonCard } from "../components/LoadingAndEmpty";
import { ItemCard } from "../components/ItemCard";
import { PageHeading } from "../components/PageHeading";
import { useToast } from "../components/Toast";

type Tab = "available" | "given_away" | "mine";
type ModeFilter = "all" | TradeMode;

const tabs: { value: Tab; label: string }[] = [
  { value: "available", label: "在售" },
  { value: "given_away", label: "已送出" },
  { value: "mine", label: "我的" },
];

const modes: { value: ModeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "free", label: "免费送" },
  { value: "pay_what_you_want", label: "随便给" },
  { value: "priced", label: "标价" },
];

export function ListPage() {
  const [tab, setTab] = useState<Tab>("available");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(Array.from(searchText.trim()).slice(0, 50).join("")), 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ status: tab === "mine" ? "all" : tab, sort: "fresh", limit: "100" });
    if (tab === "mine") params.set("owner", "me");
    if (mode !== "all") params.set("trade_mode", mode);
    if (query) params.set("q", query);
    return `/api/items?${params.toString()}`;
  }, [tab, mode, query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    api<ItemListResponse>(requestUrl)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "物品暂时无法加载";
        setLoadError(message);
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [requestUrl, refreshToken]);

  const filtered = query.length > 0 || mode !== "all";
  const emptyKind = tab === "given_away" && !filtered ? "archived" : filtered ? "search" : tab === "available" && total === 0 ? "all" : "generic";

  return (
    <div>
      <PageHeading eyebrow="邻里闲置流转" title="楼里正在流转" description="把好东西留给住在附近的人。" />

      <label className="relative mb-4 block">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜物品名称或描述"
          aria-label="搜索闲置物品"
          className="min-h-12 w-full rounded-2xl border border-black/[0.06] bg-white pl-10 pr-10 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
        />
        {searchText && <button type="button" onClick={() => setSearchText("")} aria-label="清空搜索" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-gray-100"><X size={16} /></button>}
      </label>

      <div className="mb-3 grid grid-cols-3 rounded-xl border border-black/[0.05] bg-[#eee9e1] p-1" role="tablist" aria-label="物品状态">
        {tabs.map((entry) => (
          <button key={entry.value} type="button" role="tab" aria-selected={tab === entry.value} onClick={() => setTab(entry.value)} className={`min-h-10 rounded-lg text-sm font-semibold transition ${tab === entry.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="交易方式筛选">
        {modes.map((entry) => (
          <button key={entry.value} type="button" onClick={() => setMode(entry.value)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition ${mode === entry.value ? "border-brand bg-orange-50 text-brand-dark" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-sm font-semibold text-gray-800">{tab === "available" ? "附近的好物" : tab === "given_away" ? "已经找到新家" : "我的发布"}</h2>
        {!loading && !loadError && <span className="text-xs tabular-nums text-gray-500">{total.toLocaleString("zh-CN")} 件</span>}
      </div>

      {loadError && !loading && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="shrink-0 rounded-lg px-2 py-1 font-semibold underline underline-offset-2">重试</button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          [0, 1, 2].map((key) => <SkeletonCard key={key} />)
        ) : items.length ? (
          items.map((item) => <ItemCard key={item.id} item={item} />)
        ) : loadError ? (
          <div className="rounded-2xl border border-black/[0.04] bg-white px-5 py-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">暂时无法加载闲置</h2>
            <p className="mt-1.5 text-sm text-gray-500">网络恢复后再试一次。</p>
            <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-4 min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white">重新加载</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/[0.04] bg-white shadow-sm">
            <EmptyState
              kind={emptyKind}
              query={query || (mode !== "all" ? modes.find((entry) => entry.value === mode)?.label || "" : "")}
              onClear={() => { setSearchText(""); setQuery(""); setMode("all"); toast("筛选已清除"); }}
            />
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-[11px] text-gray-400">同一小区 · 当面自提 · 邻里互助</p>
    </div>
  );
}
