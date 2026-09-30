import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApiError, api } from "./lib/api";
import { getUserId, setUserId } from "./lib/identity";
import type { User } from "./lib/types";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./components/Toast";
import { DashboardPage } from "./pages/DashboardPage";
import { DetailPage } from "./pages/DetailPage";
import { ListPage } from "./pages/ListPage";
import { PublishPage } from "./pages/PublishPage";

export default function App() {
  const [identityId, setIdentityId] = useState<string | null>(() => getUserId());
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [forceGate, setForceGate] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    const onIdentityLost = () => {
      setIdentityId(null);
      setUser(null);
      setForceGate(true);
      setSwitching(false);
    };
    window.addEventListener("identity-lost", onIdentityLost);

    const storedId = getUserId();
    api<User[]>("/api/users")
      .then((result) => {
        if (!active) return;
        setUsers(result);
        if (storedId) {
          const cached = result.find((entry) => String(entry.id) === storedId) || null;
          if (cached) setUser(cached);
          api<User>("/api/me").then((me) => { if (active) setUser(me); }).catch((error: unknown) => {
            if (!active || (error instanceof ApiError && error.status === 401)) return;
            if (cached) setUser(cached);
          });
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoadingUsers(false); });

    return () => {
      active = false;
      window.removeEventListener("identity-lost", onIdentityLost);
    };
  }, []);

  const onAuthenticated = (nextUser: User) => {
    setUserId(nextUser.id);
    setIdentityId(String(nextUser.id));
    setUser(nextUser);
    setForceGate(false);
    setSwitching(false);
    window.location.reload();
  };

  const gateOpen = !identityId || forceGate || switching;

  return (
    <ToastProvider>
      <Routes>
        <Route
          element={
            <AppShell
              user={user}
              users={users}
              loadingUsers={loadingUsers}
              gateOpen={gateOpen}
              canCloseGate={Boolean(identityId) && !forceGate}
              onOpenGate={() => setSwitching(true)}
              onCloseGate={() => setSwitching(false)}
              onAuthenticated={onAuthenticated}
            />
          }
        >
          <Route path="/" element={<ListPage />} />
          <Route path="/items/:id" element={<DetailPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
