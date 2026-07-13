"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";

const links = [
  { href: "/historico", label: "Histórico", roles: ["tecnico", "executivo", "gestor", "financeiro"] },
  { href: "/nova", label: "Nova", roles: ["tecnico", "executivo"] },
  { href: "/dashboard", label: "Dashboard", roles: ["gestor", "financeiro"] },
  { href: "/financeiro", label: "Financeiro", roles: ["financeiro", "gestor"] },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const visible = links.filter((l) =>
    (l.roles as readonly string[]).includes(user.role),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/historico" className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/daan-servicos.png?v=t2"
            alt="Daan Serviços"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            unoptimized
            priority
          />
          <Image
            src="/brand/daan-imagem.png?v=t2"
            alt="Daan Imagem"
            width={40}
            height={40}
            className="hidden h-10 w-10 object-contain sm:block"
            unoptimized
          />
          <div className="min-w-0 hidden sm:block">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              Despesas
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {user.name} · {ROLE_LABELS[user.role]}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--sand)]"
          >
            Sair
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
        {visible.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--sand)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
