"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/sync";
import { useLocalExpenses } from "@/lib/useLocalExpenses";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { items } = useLocalExpenses(user?.id, "all");
  const [status, setStatus] = useState<ExpenseStatus | "todos">("todos");
  const [category, setCategory] = useState<ExpenseCategory | "todas">("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (status !== "todos" && item.status !== status) return false;
      if (category !== "todas" && item.category !== category) return false;
      if (from && item.date < from) return false;
      if (to && item.date > to) return false;
      return item.status !== "rascunho";
    });
  }, [items, status, category, from, to]);

  const byPerson = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const item of filtered) {
      const current = map.get(item.userId) ?? {
        name: item.userName,
        total: 0,
        count: 0,
      };
      current.total += item.amount;
      current.count += 1;
      map.set(item.userId, current);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const grandTotal = filtered.reduce((sum, i) => sum + i.amount, 0);

  if (user?.role !== "gestor" && user?.role !== "financeiro") {
    return (
      <div className="card p-6">
        Dashboard disponível para gestores e financeiro.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl text-[var(--ink)]">Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Visão de gastos por pessoa, período e categoria.
        </p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Status</label>
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExpenseStatus | "todos")}
          >
            <option value="todos">Todos</option>
            {(Object.keys(STATUS_LABELS) as ExpenseStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select
            className="field"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ExpenseCategory | "todas")
            }
          >
            <option value="todas">Todas</option>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">De</label>
          <input
            className="field"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Até</label>
          <input
            className="field"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">Total filtrado</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--accent)]">
            {formatCurrency(grandTotal)}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {filtered.length} despesa(s)
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">Pessoas no filtro</p>
          <p className="mt-1 text-3xl font-semibold">{byPerson.length}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
          Gastos por pessoa
        </div>
        {byPerson.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">Sem dados no período.</p>
        ) : (
          <ul>
            {byPerson.map((person) => (
              <li
                key={person.name}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
              >
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {person.count} lançamento(s)
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(person.total)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
