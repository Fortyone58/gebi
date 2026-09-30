import { useEffect, useState } from "react";
import { BarChart3, Building2, House, Plus } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { User } from "../lib/types";
import { IdentityGate } from "./IdentityGate";
import { IdentitySwitcher } from "./IdentitySwitcher";

const navigation = [
  { to: "/", label: "闲置", Icon: House, end: true },
  { to: "/publish", label: "发布", Icon: Plus, end: true },
  { to: "/dashboard", label: "看板", Icon: BarChart3, end: true },
];

interface AppShellProps {
  user: User | null;
  users: User[];
  loadingUsers: boolean;
  gateOpen: boolean;
  canCloseGate: boolean;
  onOpenGate: () => void;
  onCloseGate: () => void;
  onAuthenticated: (user: User) => void;
}

export function AppShell(props: AppShellProps) {
  const [offline, setOffline] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("service-offline", onOffline);
    window.addEventListener("service-online", onOnline);
    return () => {
      window.removeEventListener("service-offline", onOffline);
      window.removeEventListener("service-online", onOnline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#ece9e3] text-gray-900 sm:py-4" style={{ fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden border-x border-black/[0.04] bg-[#faf7f2] shadow-[0_12px_50px_rgba(59,44,29,0.06)] sm:min-h-[calc(100vh-2rem)] sm:rounded-3xl sm:border sm:border-black/[0.06]">
        <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-[#faf7f2]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <NavLink to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="隔壁首页">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm shadow-orange-200"><Building2 size={20} /></span>
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold leading-5 tracking-normal text-gray-900">隔壁</span>
                <span className="mt-0.5 block truncate text-[10px] leading-3 text-gray-500">让闲置在沉没之前被看到</span>
              </span>
            </NavLink>
            <IdentitySwitcher user={props.user} onClick={props.onOpenGate} />
          </div>
          {offline && (
            <div role="status" className="mt-3 flex min-h-9 items-center gap-2 rounded-xl bg-amber-100 px-3 text-xs font-medium text-amber-900">
              <span className="size-1.5 rounded-full bg-amber-600" />
              服务未连接，请先启动后端
            </div>
          )}
        </header>

        <main key={location.pathname} className="flex-1 px-4 pb-6 pt-5">
          <Outlet context={{ currentUser: props.user, users: props.users }} />
        </main>

        <nav aria-label="主要导航" className="sticky bottom-0 z-30 mt-auto border-t border-black/[0.06] bg-white/95 px-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {navigation.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors ${isActive ? "text-brand" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
              >
                {({ isActive }) => <><Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} /><span>{label}</span></>}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
      <IdentityGate
        open={props.gateOpen}
        users={props.users}
        currentUser={props.user}
        loadingUsers={props.loadingUsers}
        canClose={props.canCloseGate}
        onClose={props.onCloseGate}
        onAuthenticated={props.onAuthenticated}
      />
    </div>
  );
}
