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
import type { AppUser, UserRole } from "./types";
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
  }) => Promise<string | null>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const usingSupabase = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) {
          setLoading(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session?.user && !cancelled) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id,email,name,role")
            .eq("id", data.session.user.id)
            .maybeSingle();

          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              name: profile.name,
              role: profile.role as UserRole,
            });
          }
        }
      } else {
        setUser(readLocalUser());
      }
      if (!cancelled) setLoading(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [usingSupabase]);

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();

      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) return "Supabase não configurado";
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (error) return error.message;
        if (!data.user) return "Falha no login";

        const { data: profile } = await supabase
          .from("profiles")
          .select("id,email,name,role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile) return "Perfil não encontrado";
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role as UserRole,
        });
        return null;
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
    }) => {
      if (usingSupabase) {
        const supabase = createBrowserSupabase();
        if (!supabase) return "Supabase não configurado";
        const { error } = await supabase.auth.signUp({
          email: input.email.trim().toLowerCase(),
          password: input.password,
          options: {
            data: { name: input.name, role: input.role },
          },
        });
        if (error) return error.message;
        return null;
      }

      const nextUser: AppUser = {
        id: uuidv4(),
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: input.role,
      };
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return null;
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
