import { ChevronDown, UserRound } from "lucide-react";
import type { User } from "../lib/types";

export function IdentitySwitcher({ user, onClick }: { user: User | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 max-w-[150px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 transition hover:border-orange-200 hover:bg-orange-50/50" aria-label="切换住户身份">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-100 text-sm" aria-hidden="true">{user?.avatar_emoji || <UserRound size={15} className="text-brand" />}</span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-semibold leading-4 text-gray-800">{user?.name || "选择住户"}</span>
        {user?.room_no && <span className="block truncate text-[10px] leading-3 text-gray-500">{user.room_no}</span>}
      </span>
      <ChevronDown size={14} className="shrink-0 text-gray-400" />
    </button>
  );
}
