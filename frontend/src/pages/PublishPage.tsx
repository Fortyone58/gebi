import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, LoaderCircle, Sparkles } from "lucide-react";
import { ApiError, api, jsonBody } from "../lib/api";
import type { Item, PolishSuggestion, PriceSuggestion, TradeMode } from "../lib/types";
import { PageHeading } from "../components/PageHeading";
import { PriceSuggestDialog } from "../components/PriceSuggestDialog";
import { PolishDialog } from "../components/PolishDialog";
import { useToast } from "../components/Toast";
import { textLength, truncateText } from "../lib/format";

const tradeOptions: { mode: TradeMode; title: string; description: string }[] = [
  { mode: "free", title: "免费送", description: "希望它继续被用上" },
  { mode: "pay_what_you_want", title: "随便给", description: "邻居看着合适就好" },
  { mode: "priced", title: "标价转让", description: "按成色定个价" },
];

export function PublishPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<TradeMode>("free");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [priceDialog, setPriceDialog] = useState(false);
  const [polishDialog, setPolishDialog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = (): boolean => {
    if (!title.trim() || textLength(title.trim()) > 60) {
      setFormError("标题需填写 1–60 个字");
      return false;
    }
    if (textLength(description) > 1000) {
      setFormError("描述不能超过 1000 个字");
      return false;
    }
    if (mode === "priced") {
      const amount = Number(price);
      if (!price || !Number.isFinite(amount) || amount < 1 || amount > 999999) {
        setFormError("标价请填写 1–999999 元的整数");
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const item = await api<Item>("/api/items", {
        method: "POST",
        body: jsonBody({
          title: title.trim(),
          description: description.trim(),
          trade_mode: mode,
          price: mode === "priced" ? Math.round(Number(price)) : null,
        }),
      });
      toast("发布成功，楼里的邻居现在能看到了", "success");
      navigate(`/items/${item.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setFormError("身份已失效，请重新选择住户");
      else setFormError(error instanceof Error ? error.message : "发布失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const applyPrice = (suggestion: PriceSuggestion) => {
    setMode(suggestion.mode === "free" ? "free" : "priced");
    setPrice(suggestion.mode === "priced" ? String(Math.round((suggestion.min + suggestion.max) / 2)) : "");
    setPriceDialog(false);
    toast("定价建议已填入", "success");
  };

  const applyPolish = (suggestion: PolishSuggestion) => {
    setTitle(truncateText(suggestion.title, 60));
    setDescription(truncateText(suggestion.description, 1000));
    setPolishDialog(false);
    toast("文案已回填，可继续修改", "success");
  };

  return (
    <div>
      <PageHeading eyebrow="分享一件好物" title="发布闲置" description="让用不上的东西，在楼里继续发挥价值。" />

      <form onSubmit={publish} className="space-y-4">
        <section className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">物品信息</h2>
            <span className="text-[11px] text-gray-400">必填项以 * 标记</span>
          </div>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-600"><span>物品名称 <span className="text-brand">*</span></span><span className="font-normal tabular-nums text-gray-400">{textLength(title)}/60</span></span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：九成新折叠收纳桌" className="min-h-12 w-full rounded-xl border border-gray-200 px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-orange-100" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-600"><span>描述</span><span className="font-normal tabular-nums text-gray-400">{textLength(description)}/1000</span></span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="说说成色、尺寸和使用情况，描述越清楚，邻居越容易判断。" className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-orange-100" />
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setPolishDialog(true)} disabled={!title.trim()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50/70 px-3 text-xs font-semibold text-brand-dark transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={15} />优化文案</button>
            <button type="button" onClick={() => setPriceDialog(true)} disabled={!title.trim()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50/50 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={15} className="text-brand" />获取定价建议</button>
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">交易方式</h2>
            <p className="mt-1 text-xs text-gray-500">物品都在小区内交接，优先自提。</p>
          </div>
          <div className="space-y-2" role="radiogroup" aria-label="选择交易方式">
            {tradeOptions.map((option) => {
              const selected = mode === option.mode;
              return (
                <button key={option.mode} type="button" role="radio" aria-checked={selected} onClick={() => setMode(option.mode)} className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-3 text-left transition ${selected ? "border-orange-300 bg-orange-50/70" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-brand bg-brand text-white" : "border-gray-300 bg-white"}`}>{selected && <Check size={12} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900">{option.title}</span><span className="mt-0.5 block text-xs text-gray-500">{option.description}</span></span>
                </button>
              );
            })}
          </div>
          {mode === "priced" && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">转让价格（元）</span>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">¥</span>
                <input type="number" min="1" max="999999" step="1" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="输入整数金额" className="min-h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3.5 text-base tabular-nums text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-orange-100" />
              </div>
            </label>
          )}
        </section>

        {formError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900">{formError}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => navigate(-1)} className="grid min-h-12 w-12 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50" aria-label="返回"><ArrowLeft size={18} /></button>
          <button type="submit" disabled={submitting} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-65">
            {submitting ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}
            {submitting ? "正在发布…" : "发布到楼里"}
          </button>
        </div>
        <p className="px-2 text-center text-[11px] leading-5 text-gray-400">不需要上传照片，系统会为物品生成一张专属封面。</p>
      </form>

      {priceDialog && <PriceSuggestDialog title={title} description={description} onClose={() => setPriceDialog(false)} onApply={applyPrice} />}
      {polishDialog && <PolishDialog title={title} description={description} onClose={() => setPolishDialog(false)} onApply={applyPolish} />}
    </div>
  );
}
