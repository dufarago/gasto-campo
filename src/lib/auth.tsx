"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { clampSignupRole, type AppUser, type UserRole } from "./types";
import { createBrowserSupabase, isSupabaseConfigured } from "./supabase/client";

const LOCAL_USER_KEY = "gasto-campo-user";

const DEMO_USERS: Array<AppUser & { password: string }> = [
  {
    id: "demo-tecnico",
    email: "tecnico@demo.com",
    name: "Carlos Técnico",
    role: "tecnico",
    password: "demo123",
  },
  {
    id: "demo-executivo",
    email: "executivo@demo.com",
    name: "Ana Executiva",
    role: "executivo",
    password: "demo123",
  },
  {
    id: "demo-gestor",
    email: "gestor@demo.com",
    name: "Marcos Gestor",
    role: "gestor",
    password: "demo123",
  },
  {
    id: "demo-financeiro",
    email: "financeiro@demo.com",
    name: "Paula Financeiro",
    role: "financeiro",
    password: "demo123",
  },
];

export type RegisterResult =
  | { ok: true; needsEmailConfirm?: boolean }
  | { ok: false; error: string };

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  usingSupabase: boolean;
  demoUsers: Array<{ email: string; role: UserRole; name: string }>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  registerLocal: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<RegisterResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readLocalUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

async function loadProfile(
  userId: string,
): Promise<AppUser | null> {
  const supabase = createBrowserSupabase();
  if (!supabase) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,name,role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const usingSupabase = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function boot() {
      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session?.user && !cancelled) {
          const profile = await loadProfile(data.session.user.id);
          if (profile) setUser(profile);
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          void (async () => {
            if (cancelled) return;
            if (!session?.user) {
              setUser(null);
              return;
            }
            const profile = await loadProfile(session.user.id);
            if (profile && !cancelled) setUser(profile);
          })();
        });
        unsubscribe = () => subscription.unsubscribe();
      } else {
        setUser(readLocalUser());
      }
      if (!cancelled) setLoading(false);
    }

    void boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [usingSupabase]);

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();

      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) return "Supabase não configurado";
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: normalized,
            password,
          });
          if (error) {
            if (/email not confirmed/i.test(error.message)) {
              return "Confirme seu e-mail antes de entrar (veja a caixa de entrada).";
            }
            return error.message;
          }
          if (!data.user) return "Falha no login";

          const profile = await loadProfile(data.user.id);
          if (!profile) return "Perfil não encontrado. Contate o administrador.";
          setUser(profile);
          return null;
        } catch {
          return "Não foi possível conectar ao Supabase. Verifique a internet ou se o projeto ainda está ativo.";
        }
      }

      const demo = DEMO_USERS.find(
        (u) => u.email === normalized && u.password === password,
      );
      if (!demo) return "E-mail ou senha inválidos (use as contas demo)";

      const nextUser: AppUser = {
        id: demo.id,
        email: demo.email,
        name: demo.name,
        role: demo.role,
      };
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return null;
    },
    [usingSupabase],
  );

  const logout = useCallback(async () => {
    if (usingSupabase) {
      const supabase = createBrowserSupabase();
      await supabase?.auth.signOut();
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
  }, [usingSupabase]);

  const registerLocal = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }): Promise<RegisterResult> => {
      const safeRole = clampSignupRole(input.role);

      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) return { ok: false, error: "Supabase não configurado" };
        try {
          const { data, error } = await supabase.auth.signUp({
            email: input.email.trim().toLowerCase(),
            password: input.password,
            options: {
              data: { name: input.name.trim(), role: safeRole },
            },
          });
          if (error) return { ok: false, error: error.message };

          if (data.session?.user) {
            const profile = await loadProfile(data.session.user.id);
            if (profile) {
              setUser(profile);
              return { ok: true };
            }
          }

          return { ok: true, needsEmailConfirm: true };
        } catch {
          return {
            ok: false,
            error:
              "Não foi possível conectar ao Supabase. Verifique a internet ou se o projeto ainda está ativo.",
          };
        }
      }

      const nextUser: AppUser = {
        id: uuidv4(),
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: safeRole,
      };
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return { ok: true };
    },
    [usingSupabase],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      usingSupabase,
      demoUsers: DEMO_USERS.map(({ email, role, name }) => ({
        email,
        role,
        name,
      })),
      login,
      logout,
      registerLocal,
    }),
    [user, loading, usingSupabase, login, logout, registerLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
