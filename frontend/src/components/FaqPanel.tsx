import { useState } from "react";
import { CornerDownRight, LoaderCircle, MessageCircleQuestion, Send, Sparkles } from "lucide-react";
import { api, jsonBody } from "../lib/api";
import type { FaqReply, Item } from "../lib/types";
import { useToast } from "./Toast";

const quickQuestions = ["还在吗？", "能小刀吗？", "可以自提吗？", "几成新？"];

export function FaqPanel({ item }: { item: Item }) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<FaqReply | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const ask = async (value: string) => {
    const clean = value.trim();
    if (!clean || loading) return;
    setQuestion(clean);
    setReply(null);
    setLoading(true);
    try {
      const result = await api<FaqReply>("/api/llm/faq-reply", {
        method: "POST",
        body: jsonBody({ item_id: item.id, question: clean }),
      });
      setReply(result);
    } catch (error) {
      toast(error instanceof Error ? error.message : "暂时无法生成回复", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-brand"><MessageCircleQuestion size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-gray-900">问问这件闲置</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">根据物品信息给出简短回复</p>
        </div>
        <Sparkles size={15} className="text-orange-300" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickQuestions.map((entry) => (
          <button key={entry} type="button" onClick={() => ask(entry)} disabled={loading} className="min-h-9 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-brand-dark disabled:opacity-50">{entry}</button>
        ))}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className="mt-3 flex items-center gap-2">
        <label htmlFor={`faq-${item.id}`} className="sr-only">输入一个问题</label>
        <input id={`faq-${item.id}`} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="或者自己问一个问题" className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
        <button type="submit" disabled={loading || !question.trim()} aria-label="发送问题" className="grid size-11 shrink-0 place-items-center rounded-xl bg-gray-900 text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>

      {loading && <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#faf8f4] px-3 py-2.5 text-xs text-gray-500"><LoaderCircle size={14} className="animate-spin text-brand" />正在整理回复…</div>}
      {reply && !loading && (
        <div className="mt-3 rounded-xl bg-[#faf8f4] px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500"><CornerDownRight size={13} />邻里建议</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">{reply.reply}</p>
          {reply.source === "fallback" && <p className="mt-1.5 text-[10px] text-gray-400">AI 服务暂时不可用，已给出通用建议</p>}
        </div>
      )}
    </section>
  );
}
