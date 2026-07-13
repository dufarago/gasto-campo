"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getExpense } from "@/lib/db";
import { formatCurrency } from "@/lib/sync";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Expense,
} from "@/lib/types";

export default function DespesaDetailPage() {
  const params = useParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | null>(null);

  useEffect(() => {
    void getExpense(params.id).then((e) => setExpense(e ?? null));
  }, [params.id]);

  if (!expense) {
    return (
      <div className="card p-6">
        Despesa não encontrada.{" "}
        <Link href="/historico" className="text-[var(--accent)] underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/historico" className="text-sm text-[var(--accent)]">
        ← Histórico
      </Link>
      <h1 className="text-3xl text-[var(--ink)]">
        {formatCurrency(expense.amount)}
      </h1>
      <div className="card space-y-3 p-5 text-sm">
        {expense.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expense.imageDataUrl}
            alt="Nota"
            className="max-h-80 w-full rounded-xl object-contain bg-[var(--sand)]"
          />
        )}
        <Row label="Status" value={STATUS_LABELS[expense.status]} />
        <Row label="NF / Nota" value={expense.invoiceNumber || "—"} />
        <Row label="Data" value={expense.date} />
        <Row label="Categoria" value={CATEGORY_LABELS[expense.category]} />
        <Row label="Responsável" value={expense.userName} />
        <Row label="Região" value={expense.region || "—"} />
        <Row label="Observações" value={expense.notes || "—"} />
        {expense.ocrConfidence != null && (
          <Row
            label="Confiança OCR"
            value={`${(expense.ocrConfidence * 100).toFixed(0)}%`}
          />
        )}
        {expense.rejectionReason && (
          <Row label="Motivo rejeição" value={expense.rejectionReason} />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2 last:border-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
