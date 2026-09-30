import { useEffect, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { ApiError, api } from "../lib/api";
import type { WantResponse } from "../lib/types";
import { useToast } from "./Toast";

interface WantButtonProps {
  itemId: number;
  initialWanted: boolean;
  initialCount: number;
  onChange: (wanted: boolean, count: number) => void;
  onConflict: () => void;
}

export function WantButton({ itemId, initialWanted, initialCount, onChange, onConflict }: WantButtonProps) {
  const [wanted, setWanted] = useState(initialWanted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setWanted(initialWanted);
    setCount(initialCount);
  }, [initialWanted, initialCount]);

  const toggle = async () => {
    if (busy) return;
    const before = { wanted, count };
    const nextWanted = !wanted;
    const nextCount = Math.max(0, count + (nextWanted ? 1 : -1));
    setWanted(nextWanted);
    setCount(nextCount);
    onChange(nextWanted, nextCount);
    setBusy(true);
    try {
      if (nextWanted) {
        const result = await api<WantResponse>(`/api/items/${itemId}/wants`, { method: "POST" });
        setCount(result.want_count);
        onChange(result.i_want, result.want_count);
      } else {
        await api<void>(`/api/items/${itemId}/wants`, { method: "DELETE" });
      }
    } catch (error) {
      setWanted(before.wanted);
      setCount(before.count);
      onChange(before.wanted, before.count);
      if (error instanceof ApiError && error.status === 409) {
        toast("手慢了，这件已经被送出", "error");
        onConflict();
      } else {
        toast(error instanceof Error ? error.message : "操作失败，请稍后重试", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={wanted}
      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition duration-200 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75 ${wanted ? "border border-rose-200 bg-rose-50 text-rose-700" : "bg-brand text-white shadow-sm shadow-orange-200 hover:bg-brand-dark"}`}
    >
      {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Heart size={17} className={wanted ? "fill-current animate-[heart-pop_220ms_ease-out]" : "transition-transform"} />}
      {wanted ? "已想要" : "我想要"}
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">{count > 99 ? "99+" : count}</span>
    </button>
  );
}
