import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BarChart3, Clock3, Heart, PackageCheck, PackageOpen, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { StatsResponse } from "../lib/types";
import { formatDuration } from "../lib/format";
import { PageHeading } from "../components/PageHeading";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { useToast } from "../components/Toast";

export function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    api<StatsResponse>("/api/stats")
      .then((result) => { if (active) setStats(result); })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "数据暂时无法加载";
        setError(message);
        toast(message, "error");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [toast]);

  const isEmpty = stats && stats.this_month_published === 0 && stats.this_month_completed === 0 && stats.available_count === 0 && !stats.fastest && stats.most_wanted.length === 0;
  const metrics = stats ? [
    { label: "本月发布", value: stats.this_month_published, Icon: ArrowUpRight, tint: "bg-orange-50 text-brand" },
    { label: "本月成交", value: stats.this_month_completed, Icon: PackageCheck, tint: "bg-green-50 text-green-700" },
    { label: "当前在售", value: stats.available_count, Icon: PackageOpen, tint: "bg-amber-50 text-amber-700" },
  ] : [];

  return (
    <div>
      <PageHeading eyebrow="邻里循环记录" title="楼里的小成绩" description="每一件被看见、被接手的闲置，都算一次循环。" />

      {error && <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><span>{error}</span><button type="button" onClick={() => window.location.reload()} className="font-semibold underline underline-offset-2">重试</button></div>}

      <div className="grid grid-cols-3 gap-2.5">
        {loading ? [0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-white" />) : metrics.map(({ label, value, Icon, tint }) => (
          <article key={label} className="min-w-0 rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
            <span className={`grid size-8 place-items-center rounded-lg ${tint}`}><Icon size={16} /></span>
            <p className="mt-3 truncate text-[10px] font-medium text-gray-500">{label}</p>
            <p className="mt-0.5 text-3xl font-bold leading-9 tabular-nums text-gray-900">{isEmpty ? "—" : value.toLocaleString("zh-CN")}</p>
          </article>
        ))}
      </div>

      {isEmpty && !loading && (
        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-center text-sm text-gray-500">暂无数据，楼里的第一件闲置等你发布。</div>
      )}

      <section className="mt-4 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={18} /></span>
          <div><h2 className="text-sm font-bold text-gray-900">最快找到新家的闲置</h2><p className="mt-0.5 text-[11px] text-gray-500">从发布到送出，用时最短的一件</p></div>
        </div>
        {loading ? <div className="h-16 animate-pulse rounded-xl bg-gray-100" /> : stats?.fastest ? (
          <div className="flex items-center gap-3 rounded-xl bg-[#faf8f4] p-2.5">
            <div className="size-14 shrink-0 overflow-hidden rounded-lg"><PlaceholderImage item={stats.fastest.item} /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{stats.fastest.item.title}</p><p className="mt-1 text-xs text-gray-500">{stats.fastest.item.owner.name} 发布</p></div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1.5 text-xs font-bold tabular-nums text-amber-800 shadow-sm">{formatDuration(stats.fastest.took_seconds)}</span>
          </div>
        ) : <p className="rounded-xl bg-[#faf8f4] px-3 py-4 text-center text-sm text-gray-500">还没有成交记录，等待第一件被领走。</p>}
      </section>

      <section className="mt-4 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><Heart size={18} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-gray-900">邻居最想要</h2><p className="mt-0.5 text-[11px] text-gray-500">仅统计仍在流转中的物品</p></div>
          <Sparkles size={15} className="text-orange-300" />
        </div>
        {loading ? <div className="space-y-2"><div className="h-14 animate-pulse rounded-xl bg-gray-100" /><div className="h-14 animate-pulse rounded-xl bg-gray-100" /></div> : stats?.most_wanted.length ? (
          <div className="space-y-2">
            {stats.most_wanted.map(({ item, want_count }, index) => (
              <Link key={item.id} to={`/items/${item.id}`} className="flex min-h-[60px] items-center gap-3 rounded-xl bg-[#faf8f4] p-2 transition hover:bg-orange-50">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${index === 0 ? "bg-brand text-white" : "bg-white text-gray-500"}`}>{index + 1}</span>
                <div className="size-11 shrink-0 overflow-hidden rounded-lg"><PlaceholderImage item={item} /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-gray-500">{item.owner.name}</p></div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-rose-600"><Heart size={13} fill="currentColor" />{want_count}</span>
              </Link>
            ))}
          </div>
        ) : <p className="rounded-xl bg-[#faf8f4] px-3 py-4 text-center text-sm text-gray-500">暂无数据，等邻居们表达兴趣后就会出现。</p>}
      </section>

      <div className="mt-4 rounded-2xl bg-[#f2e8dd] px-4 py-3.5">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#725543]"><BarChart3 size={15} />小区里的每一次分享，都让资源多走一段路。</p>
      </div>
    </div>
  );
}
