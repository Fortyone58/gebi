import type { Freshness } from "../lib/types";

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const style = freshness.level === "fresh24"
    ? "bg-green-100 text-green-800"
    : freshness.level === "fresh72"
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-600";
  const dot = freshness.level === "fresh24"
    ? "bg-green-500 animate-pulse"
    : freshness.level === "fresh72"
      ? "bg-amber-500"
      : "bg-gray-400";

  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${style}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {freshness.label}
    </span>
  );
}
