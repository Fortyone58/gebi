import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, MessageCircle, PackageCheck } from "lucide-react";
import { api } from "../lib/api";
import type { Item, User, WantUser } from "../lib/types";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { FaqPanel } from "../components/FaqPanel";
import { GiveAwayDialog } from "../components/GiveAwayDialog";
import { MessageBoard } from "../components/MessageBoard";
import { OwnerPanel } from "../components/OwnerPanel";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { TradeModeTag } from "../components/TradeModeTag";
import { WantButton } from "../components/WantButton";

interface AppOutletContext {
  currentUser: User | null;
  users: User[];
}

export function DetailPage() {
  const { id: rawId } = useParams();
  const itemId = Number(rawId);
  const { currentUser, users } = useOutletContext<AppOutletContext>();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [giveAwayUsers, setGiveAwayUsers] = useState<WantUser[] | null>(null);

  const loadItem = useCallback(async () => {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      setError("物品不存在");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api<Item>(`/api/items/${itemId}`);
      setItem(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "物品暂时无法加载");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { void loadItem(); }, [loadItem]);

  if (loading) {
    return <div className="space-y-4" aria-label="正在加载物品">
      <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
      <div className="h-8 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-white" />
    </div>;
  }

  if (!item || error) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center px-5 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-orange-50 text-brand"><PackageCheck size={25} /></div>
        <h1 className="mt-4 text-lg font-bold text-gray-900">这件物品暂时看不到</h1>
        <p className="mt-1 max-w-xs text-sm leading-6 text-gray-500">{error || "请返回列表再试一次。"}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void loadItem()} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700">重试</button>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><ArrowLeft size={16} />回到列表</Link>
        </div>
      </div>
    );
  }

  const recipient = item.given_to_user_id ? users.find((user) => user.id === item.given_to_user_id) : null;
  const sentAt = item.given_away_at ? new Date(item.given_away_at * 1000).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : null;
  const onWantChange = (wanted: boolean, count: number) => setItem((current) => current ? { ...current, i_want: wanted, want_count: count } : current);
  const onGiveAwayComplete = (updated: Item) => {
    setItem(updated);
    setGiveAwayUsers(null);
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-gray-500 transition hover:text-gray-900"><ArrowLeft size={16} />返回闲置列表</Link>

      <article className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-sm">
        <div className="relative h-60 sm:h-72">
          <PlaceholderImage item={item} />
          {item.status === "given_away" && <div className="absolute inset-0 grid place-items-center bg-gray-900/20"><span className="rotate-[-8deg] rounded-lg border-2 border-white/90 bg-gray-950/70 px-5 py-2 text-xl font-extrabold tracking-[0.06em] text-white shadow-lg">已送出</span></div>}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <FreshnessBadge freshness={item.freshness} />
            <TradeModeTag mode={item.trade_mode} />
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-[23px] font-bold leading-8 text-gray-900">{item.title}</h1>
            {item.trade_mode === "priced" && item.price !== null && <span className="shrink-0 whitespace-nowrap text-xl font-extrabold tabular-nums text-brand">¥{item.price.toLocaleString("zh-CN")}</span>}
          </div>
          {item.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{item.description}</p> : <p className="mt-3 text-sm leading-6 text-gray-500">发布者还没有补充描述。</p>}

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#faf8f4] p-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-lg shadow-sm" aria-hidden="true">{item.owner.avatar_emoji || "🏠"}</span>
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-gray-800">{item.owner.name}</p><p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-gray-500"><MapPin size={10} />{item.owner.room_no || "楼内邻居"}</p></div>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-gray-500"><CalendarDays size={14} />{item.status === "given_away" && sentAt ? `${sentAt} 已送出` : item.freshness.label}</div>
          </div>

          {item.status === "given_away" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs leading-5 text-green-800">
              <PackageCheck size={16} className="shrink-0" />
              <span className="min-w-0">{recipient ? `已送给 ${recipient.name}${recipient.room_no ? ` · ${recipient.room_no}` : ""}` : "这件物品已经送出，谢谢关注。"}</span>
            </div>
          )}

          {item.status === "available" && !item.is_mine && (
            <div className="mt-4 flex gap-2">
              <WantButton itemId={item.id} initialWanted={item.i_want} initialCount={item.want_count} onChange={onWantChange} onConflict={() => { void loadItem(); }} />
              <a href="#messages" className="grid min-h-12 w-12 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-brand" aria-label="查看邻里留言"><MessageCircle size={18} /></a>
            </div>
          )}
        </div>
      </article>

      {item.is_mine && <OwnerPanel item={item} residents={users} onGiveAway={(wantUsers) => setGiveAwayUsers(wantUsers)} />}
      <FaqPanel item={item} />
      <div id="messages"><MessageBoard itemId={item.id} archived={item.status === "given_away"} currentUser={currentUser} /></div>
      <div className="pb-1 text-center text-[10px] text-gray-400">给好物一个新邻居，少一点闲置，多一点循环</div>

      {giveAwayUsers && <GiveAwayDialog item={item} wantUsers={giveAwayUsers} onClose={() => setGiveAwayUsers(null)} onCompleted={onGiveAwayComplete} />}
    </div>
  );
}
