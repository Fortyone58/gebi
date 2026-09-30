import { useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { api, jsonBody } from "../lib/api";
import type { PolishSuggestion } from "../lib/types";
import { useToast } from "./Toast";

export function PolishDialog({ title, description, onClose, onApply }: { title: string; description: string; onClose: () => void; onApply: (suggestion: PolishSuggestion) => void }) {
  const [result, setResult] = useState<PolishSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const polish = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      const response = await api<PolishSuggestion>("/api/llm/polish", {
        method: "POST",
        body: jsonBody({ title: title.trim(), description: description.trim() }),
      });
      setResult(response);
    } catch (error) {
      toast(error instanceof Error ? error.message : "暂时无法优化文案", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="polish-title" className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-orange-50 text-brand"><Sparkles size={20} /></span>
            <h2 id="polish-title" className="mt-3 text-xl font-bold text-gray-900">把描述说得更清楚</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">保留真实信息，用邻居之间自然的语气表达。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="grid size-10 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100"><X size={18} /></button>
        </div>
        {!result ? (
          <div className="mt-4 rounded-xl bg-[#faf7f2] px-3.5 py-3">
            <p className="text-xs font-medium text-gray-500">当前标题</p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-900">{title}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 rounded-2xl border border-orange-100 bg-[#fffaf5] p-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400">优化后的标题</p>
              <p className="mt-1 text-sm font-bold leading-5 text-gray-900">{result.title}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400">转让描述</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{result.description}</p>
            </div>
            {result.source === "fallback" && <p className="text-[11px] text-gray-400">AI 服务暂时不可用，已给出通用建议</p>}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="min-h-12 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">取消</button>
          {result ? (
            <button type="button" onClick={() => onApply(result)} className="min-h-12 flex-[1.25] rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-dark">采用并回填</button>
          ) : (
            <button type="button" onClick={polish} disabled={loading || !title.trim()} className="inline-flex min-h-12 flex-[1.25] items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60">
              {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "正在润色…" : "优化文案"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
