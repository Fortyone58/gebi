import { useState } from "react";
import { Check, LoaderCircle, PackageCheck, X } from "lucide-react";
import { ApiError, api, jsonBody } from "../lib/api";
import type { Item, WantUser } from "../lib/types";
import { useToast } from "./Toast";

export function GiveAwayDialog({ item, wantUsers, onClose, onCompleted }: { item: Item; wantUsers: WantUser[]; onClose: () => void; onCompleted: (item: Item) => void }) {
  const [toUserId, setToUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<Item>(`/api/items/${item.id}/give-away`, {
        method: "POST",
        body: jsonBody(toUserId ? { to_user_id: Number(toUserId) } : {}),
      });
      onCompleted(result);
      toast("已记录成交，恭喜闲置找到新家", "success");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) toast("这件物品已经标记为送出", "error");
      else toast(error instanceof Error ? error.message : "暂时无法标记送出", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="give-away-title" className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-green-50 text-green-700"><PackageCheck size={20} /></span>
            <h2 id="give-away-title" className="mt-3 text-xl font-bold text-gray-900">物品找到新家了？</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">记录一下，让楼里的邻居知道它已送出。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="grid size-10 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100"><X size={18} /></button>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold text-gray-600">送给哪位邻居？</span>
          <select value={toUserId} onChange={(event) => setToUserId(event.target.value)} className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-orange-100">
            <option value="">不方便说 / 私下谈成</option>
            {wantUsers.map((user) => <option key={user.id} value={user.id}>{user.name}{user.room_no ? ` · ${user.room_no}` : ""}</option>)}
          </select>
        </label>
        <div className="mt-3 rounded-xl bg-[#faf7f2] px-3.5 py-3">
          <p className="text-xs text-gray-500">本次记录</p>
          <p className="mt-1 truncate text-sm font-semibold text-gray-900">{item.title}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-12 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">再等等</button>
          <button type="button" onClick={complete} disabled={busy} className="inline-flex min-h-12 flex-[1.35] items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60">
            {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
            确认已送出
          </button>
        </div>
      </section>
    </div>
  );
}
