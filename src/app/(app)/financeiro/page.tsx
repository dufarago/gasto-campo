"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { formatCurrency, updateExpenseStatus } from "@/lib/sync";
import { useLocalExpenses } from "@/lib/useLocalExpenses";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/lib/types";

export default function FinanceiroPage() {
  const { user } = useAuth();
  const { items, reload } = useLocalExpenses(user?.id, "all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      items.filter((i) =>
        ["enviado", "aprovado", "rejeitado", "pendente_sync"].includes(i.status),
      ),
    [items],
  );

  async function setStatus(
    localId: string,
    status: "aprovado" | "rejeitado",
  ) {
    setBusyId(localId);
    const reason =
      status === "rejeitado"
        ? window.prompt("Motivo da rejeição (opcional):") ?? ""
        : undefined;
    await updateExpenseStatus(localId, status, reason);
    await reload();
    setBusyId(null);
  }

  function exportCsv() {
    const header = [
      "data",
      "responsavel",
      "perfil",
      "valor",
      "numero_nota",
      "categoria",
      "regiao",
      "status",
      "observacoes",
    ];
    const rows = queue.map((e) =>
      [
        e.date,
        e.userName,
        e.userRole,
        e.amount.toFixed(2),
        e.invoiceNumber,
        e.category,
        e.region,
        e.status,
        e.notes.replace(/"/g, '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gasto-campo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (user?.role !== "financeiro" && user?.role !== "gestor") {
    return (
      <div className="card p-6">
        Área restrita ao financeiro e gestores.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[var(--ink)]">Financeiro</h1>
          <p className="text-sm text-[var(--muted)]">
            Aprove, rejeite e exporte as despesas enviadas.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={exportCsv}>
          Exportar CSV
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="card p-6 text-[var(--muted)]">
          Nenhuma despesa na fila ainda.
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li key={item.localId} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {item.userName} · {CATEGORY_LABELS[item.category]} · NF{" "}
                    {item.invoiceNumber || "—"} · {item.date}
                  </p>
                  <p className="mt-1 text-xs">
                    Status: {STATUS_LABELS[item.status]}
                  </p>
                </div>
                {user.role === "financeiro" && item.status === "enviado" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.localId}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      onClick={() => void setStatus(item.localId, "aprovado")}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.localId}
                      className="rounded-lg border border-[var(--danger)] px-3 py-1.5 text-sm text-[var(--danger)] disabled:opacity-50"
                      onClick={() => void setStatus(item.localId, "rejeitado")}
                    >
                      Rejeitar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
