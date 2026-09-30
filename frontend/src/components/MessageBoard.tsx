import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { ApiError, api, jsonBody } from "../lib/api";
import type { Message, MessageListResponse, User } from "../lib/types";
import { relativeTime, textLength } from "../lib/format";
import { useToast } from "./Toast";

export function MessageBoard({ itemId, archived, currentUser }: { itemId: number; archived: boolean; currentUser: User | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const tailRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    api<MessageListResponse>(`/api/items/${itemId}/messages`)
      .then((result) => { if (active) setMessages(result.messages); })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "留言暂时无法加载"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [itemId, refreshToken]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = content.trim();
    if (!clean || textLength(clean) > 200 || sending || archived) return;
    if (!currentUser) {
      toast("请先选择住户身份", "error");
      return;
    }
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      item_id: itemId,
      user: currentUser,
      content: clean,
      created_at: Math.floor(Date.now() / 1000),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setContent("");
    setSending(true);
    try {
      const result = await api<Message>(`/api/items/${itemId}/messages`, {
        method: "POST",
        body: jsonBody({ content: clean }),
      });
      const saved = { ...result, user: result.user || currentUser, pending: false };
      setMessages((current) => current.map((message) => message.id === tempId ? saved : message));
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      if (error instanceof ApiError && error.status === 409) toast("这件物品已经送出，留言暂时关闭", "error");
      else toast(error instanceof Error ? error.message : "发送失败，请稍后重试", "error");
      setContent(clean);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900"><MessageCircle size={18} className="text-brand" />邻里留言</h2>
        <span className="text-xs tabular-nums text-gray-400">{messages.length} 条</span>
      </div>
      {loading ? (
        <div className="space-y-3 py-2">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl bg-amber-50 px-3 py-4 text-center">
          <p className="text-sm text-amber-900">留言暂时无法加载</p>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-1 text-xs font-semibold text-amber-900 underline underline-offset-2">重新加载</button>
        </div>
      ) : messages.length ? (
        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {messages.map((message) => (
            <article key={message.id} className="flex gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2e9df] text-base" aria-hidden="true">{message.user.avatar_emoji || "🏠"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-gray-800">{message.user.name}</span>
                  {message.user.room_no && <span className="truncate text-[10px] text-gray-400">{message.user.room_no}</span>}
                  <span className="ml-auto shrink-0 text-[10px] text-gray-400">{message.pending ? "发送中" : relativeTime(message.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{message.content}</p>
              </div>
            </article>
          ))}
          <div ref={tailRef} />
        </div>
      ) : (
        <p className="rounded-xl bg-[#faf8f4] px-3 py-4 text-center text-sm text-gray-500">还没有人提问，来问第一个。</p>
      )}

      {archived ? (
        <div className="mt-4 rounded-xl bg-gray-100 px-3 py-2.5 text-center text-xs font-medium text-gray-500">物品已送出，留言已关闭</div>
      ) : (
        <form onSubmit={send} className="mt-4 border-t border-gray-100 pt-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`message-${itemId}`} className="sr-only">留言内容</label>
              <textarea
                id={`message-${itemId}`}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={2}
                placeholder="和邻居打个招呼…"
                className="block min-h-[76px] w-full resize-none rounded-xl border border-gray-200 bg-[#fcfbf9] px-3 py-2.5 text-sm leading-5 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button type="submit" disabled={sending || !content.trim()} aria-label="发送留言" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
              {sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          <div className="mt-1 text-right text-[10px] tabular-nums text-gray-400">{textLength(content)}/200</div>
        </form>
      )}
    </section>
  );
}
