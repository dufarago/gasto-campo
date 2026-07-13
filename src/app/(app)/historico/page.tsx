"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/sync";
import { useLocalExpenses } from "@/lib/useLocalExpenses";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/lib/types";

export default function HistoricoPage() {
  const { user } = useAuth();
  const scope =
    user?.role === "gestor" || user?.role === "financeiro" ? "all" : "mine";
  const { items } = useLocalExpenses(user?.id, scope);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[var(--ink)]">Histórico</h1>
          <p className="text-sm text-[var(--muted)]">
            Notas digitalizadas neste aparelho
            {user?.role === "gestor" || user?.role === "financeiro"
              ? " (visão geral local)"
              : ""}
            .
          </p>
        </div>
        {(user?.role === "tecnico" ||
          user?.role === "executivo" ||
          user?.role === "gestor") && (
          <Link href="/nova" className="btn-primary shrink-0">
            Nova despesa
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-6 text-[var(--muted)]">
          Nenhuma despesa ainda. Tire foto de uma nota para começar.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.localId}>
              <Link
                href={`/despesa/${item.localId}`}
                className="card flex items-center gap-3 p-3 transition hover:border-[var(--accent)]"
              >
                {item.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageDataUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--sand)] text-xs text-[var(--muted)]">
                    sem foto
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{formatCurrency(item.amount)}</strong>
                    <span className="rounded-full bg-[var(--sand)] px-2 py-0.5 text-xs">
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {CATEGORY_LABELS[item.category]} · NF {item.invoiceNumber || "—"} ·{" "}
                    {item.date}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {item.userName}
                    {item.region ? ` · ${item.region}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
