import { useEffect, useState } from "react";
import { Check, ChevronRight, LoaderCircle, PackageCheck, UsersRound } from "lucide-react";
import { api } from "../lib/api";
import type { Item, User, WantUser } from "../lib/types";
import { useToast } from "./Toast";

export function OwnerPanel({ item, residents, onGiveAway }: { item: Item; residents: User[]; onGiveAway: (users: WantUser[]) => void }) {
  const [wantUsers, setWantUsers] = useState<WantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    api<WantUser[]>(`/api/items/${item.id}/wants`)
      .then((result) => { if (active) setWantUsers(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "想要名单暂时无法加载"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.id, item.want_count]);

  const archive = () => {
    if (item.status === "given_away") return;
    if (loading) {
      toast("想要名单加载中，请稍等", "info");
      return;
    }
    onGiveAway(wantUsers.map((user) => {
      const resident = residents.find((entry) => entry.id === user.id);
      return {
        ...user,
        room_no: resident?.room_no ?? null,
        avatar_emoji: user.avatar_emoji ?? resident?.avatar_emoji ?? null,
      };
    }));
  };

  return (
    <section className="rounded-2xl border border-orange-100 bg-[#fffaf5] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand"><UsersRound size={15} />发布者面板</p>
          <h2 className="mt-1 text-base font-bold text-gray-900">谁想要这件物品</h2>
        </div>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold tabular-nums text-brand-dark">{item.want_count > 99 ? "99+" : item.want_count} 人</span>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-xs text-gray-500"><LoaderCircle size={15} className="animate-spin" />正在加载…</div>
      ) : error ? (
        <p className="mt-3 rounded-xl bg-white px-3 py-3 text-xs text-gray-500">{error}</p>
      ) : wantUsers.length ? (
        <div className="mt-3 divide-y divide-gray-100 rounded-xl bg-white px-3">
          {wantUsers.map((user) => {
            const resident = residents.find((entry) => entry.id === user.id);
            return (
            <div key={user.id} className="flex min-h-12 items-center gap-2.5 py-2">
              <span className="grid size-8 place-items-center rounded-full bg-[#f2e9df] text-base" aria-hidden="true">{user.avatar_emoji || resident?.avatar_emoji || "🏠"}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{user.name}</span>
              <span className="text-xs text-gray-500">{user.room_no ?? resident?.room_no ?? "邻居"}</span>
            </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-gray-500">还没人想要，分享给邻居看看吧。</p>
      )}

      {item.status === "available" ? (
        <button type="button" onClick={archive} disabled={loading} className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-orange-200 bg-white px-3.5 text-sm font-semibold text-gray-800 transition hover:border-brand hover:bg-orange-50 disabled:opacity-60">
          <span className="inline-flex items-center gap-2"><PackageCheck size={17} className="text-brand" />标记为已送出</span><ChevronRight size={16} className="text-gray-400" />
        </button>
      ) : (
        <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-green-50 px-3.5 text-sm font-semibold text-green-800"><Check size={17} />已送出记录</div>
      )}
    </section>
  );
}
