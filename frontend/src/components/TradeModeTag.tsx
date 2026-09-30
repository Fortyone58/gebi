import { Tag } from "lucide-react";
import type { TradeMode } from "../lib/types";

const labels: Record<TradeMode, string> = {
  free: "免费送",
  pay_what_you_want: "随便给",
  priced: "标价转让",
};

export function TradeModeTag({ mode }: { mode: TradeMode }) {
  const style = mode === "free"
    ? "bg-green-50 text-green-700"
    : mode === "pay_what_you_want"
      ? "bg-amber-50 text-amber-800"
      : "bg-orange-50 text-orange-800";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      <Tag size={12} />
      {labels[mode]}
    </span>
  );
}

export function tradeModeLabel(mode: TradeMode): string {
  return labels[mode];
}
