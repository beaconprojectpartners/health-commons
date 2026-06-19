import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type RoleView = "patient" | "specialist" | "researcher";

type Ctx = { role: RoleView; setRole: (r: RoleView) => void };
const RoleViewCtx = createContext<Ctx>({ role: "patient", setRole: () => {} });

const STORAGE_KEY = "dxc.role-view";

export const RoleViewProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [role, setRoleState] = useState<RoleView>(() => {
    if (typeof window === "undefined") return "patient";
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("role") as RoleView | null;
    if (fromUrl && ["patient", "specialist", "researcher"].includes(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY) as RoleView | null;
    return stored ?? "patient";
  });

  // keep ?role= in URL in sync with state
  useEffect(() => {
    const params = new URLSearchParams(search);
    const current = params.get("role");
    if (current !== role) {
      params.set("role", role);
      navigate({ pathname, search: `?${params.toString()}` }, { replace: true });
    }
  }, [role, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // apply data attribute on <html> for CSS theming
  useEffect(() => {
    document.documentElement.dataset.roleView = role;
    window.localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  return (
    <RoleViewCtx.Provider value={{ role, setRole: setRoleState }}>
      {children}
    </RoleViewCtx.Provider>
  );
};

export const useRoleView = () => useContext(RoleViewCtx);

export const roleMeta: Record<RoleView, { label: string; color: string; dot: string }> = {
  patient:    { label: "Patient",    color: "hsl(var(--role-accent))", dot: "hsl(172 50% 36%)" },
  specialist: { label: "Specialist", color: "hsl(var(--role-accent))", dot: "hsl(250 60% 55%)" },
  researcher: { label: "Researcher", color: "hsl(var(--role-accent))", dot: "hsl(32 90% 48%)" },
};