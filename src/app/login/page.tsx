"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err =
      mode === "login"
        ? await login(email, password)
        : await registerLocal({ name, email, password, role });
    setBusy(false);
    if (err) {
      setError(err);
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
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
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
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar e entrar"}
        </button>

        <p className="text-xs text-[var(--muted)]">
          {usingSupabase
            ? "Conectado ao Supabase."
            : "Modo local (demo). Configure NEXT_PUBLIC_SUPABASE_URL para produção."}
        </p>
      </form>

      {!usingSupabase && (
        <div className="card p-4 text-sm">
          <p className="mb-2 font-medium">Contas demo (senha: demo123)</p>
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
