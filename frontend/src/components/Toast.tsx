import { createContext, useCallback, useContext, useState } from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const toast = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => {
      setMessages((current) => current.filter((message) => message.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4">
        {messages.map((message) => {
          const Icon = message.kind === "success" ? Check : message.kind === "error" ? CircleAlert : Info;
          return (
            <div
              key={message.id}
              className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-lg shadow-black/10 animate-[toast-in_180ms_ease-out]"
              role="status"
            >
              <Icon size={17} className={message.kind === "error" ? "text-amber-600" : message.kind === "success" ? "text-green-600" : "text-brand"} />
              <span className="flex-1">{message.text}</span>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => setMessages((current) => current.filter((entry) => entry.id !== message.id))}
                className="grid size-8 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
