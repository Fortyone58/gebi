import { ArrowRight, PackageSearch, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-2xl border border-black/[0.04] bg-white p-3 shadow-sm animate-pulse" aria-hidden="true">
      <div className="h-28 w-28 shrink-0 rounded-xl bg-gray-200 sm:h-32 sm:w-32" />
      <div className="flex flex-1 flex-col gap-3 py-1">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-5 w-20 rounded-full bg-gray-200" />
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="mt-auto h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  kind: "all" | "search" | "archived" | "generic";
  query?: string;
  onClear?: () => void;
}

export function EmptyState({ kind, query = "", onClear }: EmptyStateProps) {
  const isSearch = kind === "search";
  const isArchived = kind === "archived";
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-[#f4e7da] text-brand">
        <PackageSearch size={28} strokeWidth={1.6} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">
        {isSearch ? `没找到「${query}」相关的闲置` : isArchived ? "还没有送出记录" : kind === "all" ? "这里还空空的" : "暂时没有内容"}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm leading-6 text-gray-500">
        {isSearch ? "换个词试试，楼里也许还有你需要的东西。" : isArchived ? "每件闲置都有自己的下一站。" : kind === "all" ? "把用不上的东西分享给住在附近的人。" : "稍后再来看看。"}
      </p>
      {isSearch && onClear ? (
        <button onClick={onClear} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
          清除筛选 <ArrowRight size={15} />
        </button>
      ) : kind === "all" ? (
        <Link to="/publish" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark">
          <Plus size={16} /> 去发布第一件闲置
        </Link>
      ) : null}
    </div>
  );
}
