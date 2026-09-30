import { useState } from "react";
import { ArrowRight, Building2, Check, LoaderCircle, UserRoundPlus, X } from "lucide-react";
import { api, jsonBody } from "../lib/api";
import type { User } from "../lib/types";
import { textLength } from "../lib/format";
import { useToast } from "./Toast";

interface IdentityGateProps {
  open: boolean;
  users: User[];
  currentUser: User | null;
  loadingUsers: boolean;
  canClose: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}

export function IdentityGate({ open, users, currentUser, loadingUsers, canClose, onClose, onAuthenticated }: IdentityGateProps) {
  const [name, setName] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"residents" | "new">("residents");
  const { toast } = useToast();

  if (!open) return null;

  const submitNew = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || textLength(cleanName) > 20) {
      toast("名字请填写 1–20 个字", "error");
      return;
    }
    setCreating(true);
    try {
      const user = await api<User>("/api/users", {
        method: "POST",
        body: jsonBody({ name: cleanName, room_no: roomNo.trim() || undefined }),
      });
      onAuthenticated(user);
    } catch (error) {
      toast(error instanceof Error ? error.message : "暂时无法创建住户", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-title"
        className="relative w-full max-w-md rounded-t-[28px] bg-[#faf7f2] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        {canClose && (
          <button type="button" onClick={onClose} aria-label="关闭身份切换" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-gray-500 transition hover:bg-gray-200/70">
            <X size={18} />
          </button>
        )}
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-orange-100 text-brand">
          <Building2 size={23} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">GE BI · NEIGHBOR EXCHANGE</p>
        <h1 id="identity-title" className="mt-2 text-2xl font-bold text-gray-900">{currentUser ? "切换住户" : "先认识一下"}</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">住在同一栋楼里，分享用不上的好东西。</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#eee8df] p-1">
          <button type="button" onClick={() => setMode("residents")} className={`min-h-10 rounded-lg text-sm font-semibold transition ${mode === "residents" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            选择住户
          </button>
          <button type="button" onClick={() => setMode("new")} className={`min-h-10 rounded-lg text-sm font-semibold transition ${mode === "new" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            我是新住户
          </button>
        </div>

        {mode === "residents" ? (
          <div className="mt-4 grid max-h-[min(44vh,360px)] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {loadingUsers ? (
              <div className="col-span-2 flex min-h-24 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={17} className="animate-spin" />正在加载住户…</div>
            ) : users.length ? users.map((user) => {
              const selected = currentUser?.id === user.id;
              return (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => onAuthenticated(user)}
                  className={`flex min-h-[68px] items-center gap-2.5 rounded-xl border px-3 text-left transition ${selected ? "border-brand bg-orange-50" : "border-black/[0.06] bg-white hover:border-orange-200 hover:bg-orange-50/60"}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f1e8dd] text-xl" aria-hidden="true">{user.avatar_emoji || "🏠"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">{user.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{user.room_no || "新邻居"}</span>
                  </span>
                  {selected ? <Check size={16} className="shrink-0 text-brand" /> : null}
                </button>
              );
            }) : (
              <div className="col-span-2 rounded-xl bg-white p-4 text-sm leading-6 text-gray-500">暂时还没有预置住户，可以切换到“我是新住户”创建。</div>
            )}
          </div>
        ) : (
          <form onSubmit={submitNew} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">怎么称呼你</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="例如：小林" className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">楼栋房号 <span className="font-normal text-gray-400">选填</span></span>
              <input value={roomNo} onChange={(event) => setRoomNo(event.target.value)} maxLength={20} placeholder="例如：2-1202" className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-orange-100" />
            </label>
            <button type="submit" disabled={creating || !name.trim()} className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-55">
              {creating ? <LoaderCircle size={17} className="animate-spin" /> : <UserRoundPlus size={17} />}
              加入邻里
              {!creating && <ArrowRight size={16} />}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-[11px] leading-5 text-gray-400">无需密码 · 只在楼里流转 · 自提更方便</p>
      </section>
    </div>
  );
}
