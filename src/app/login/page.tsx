"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  ROLE_LABELS,
  SIGNUP_ROLES,
  type UserRole,
} from "@/lib/types";

export default function LoginPage() {
  const { user, loading, login, registerLocal, usingSupabase, demoUsers } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("tecnico");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "login") {
      const err = await login(email, password);
      setBusy(false);
      if (err) {
        setError(err);
        return;
      }
      router.replace("/");
      return;
    }

    const result = await registerLocal({ name, email, password, role });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirm) {
      setInfo(
        "Conta criada. Confirme o e-mail (se exigido) e depois entre com Entrar.",
      );
      setMode("login");
      return;
    }
    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-4 sm:justify-start sm:gap-6">
          <Image
            src="/brand/daan-servicos.png?v=t2"
            alt="Daan Serviços"
            width={120}
            height={120}
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            unoptimized
            priority
          />
          <Image
            src="/brand/daan-imagem.png?v=t2"
            alt="Daan Imagem"
            width={120}
            height={120}
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            unoptimized
            priority
          />
        </div>

        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
            Grupo Daan
          </p>
          <h1 className="mt-2 text-4xl text-[var(--ink)]">Despesas de campo</h1>
          <p className="mt-2 text-[var(--muted)]">
            Capture notas, leia valor e número automaticamente, salve offline e
            sincronize quando houver sinal.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "login" ? "bg-[var(--accent-soft)] font-semibold" : ""
            }`}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "register" ? "bg-[var(--accent-soft)] font-semibold" : ""
            }`}
            onClick={() => setMode("register")}
          >
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <>
            <div>
              <label className="label">Nome</label>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Perfil</label>
              <select
                className="field"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {SIGNUP_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Gestor e Financeiro são promovidos pelo administrador.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="label">E-mail</label>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Senha</label>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]">
            {info}
          </p>
        )}

        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar e entrar"}
        </button>

        <p className="text-xs text-[var(--muted)]" suppressHydrationWarning>
          {!mounted
            ? "\u00a0"
            : usingSupabase
              ? "Beta conectado ao Supabase."
              : "Modo local (dev). Configure Supabase para o beta — ver docs/BETA_SETUP.md."}
        </p>
      </form>

      {mounted && !usingSupabase && (
        <div className="card p-4 text-sm">
          <p className="mb-2 font-medium">Contas demo (somente desenvolvimento)</p>
          <ul className="space-y-1 text-[var(--muted)]">
            {demoUsers.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  className="text-left hover:text-[var(--accent)]"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword("demo123");
                    setMode("login");
                  }}
                >
                  {u.name} — {u.email} ({ROLE_LABELS[u.role]})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
