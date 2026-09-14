"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getExpense } from "@/lib/db";
import { formatCurrency, getReceiptSignedUrl, loadExpenses } from "@/lib/sync";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Expense,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function DespesaDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let found = (await getExpense(params.id)) ?? null;

      if (!found && user) {
        const scope =
          user.role === "gestor" || user.role === "financeiro" ? "all" : "mine";
        const list = await loadExpenses({ userId: user.id, scope });
        found = list.find((e) => e.localId === params.id) ?? null;
      }

      if (cancelled) return;
      setExpense(found);

      if (!found) return;
      if (found.imageDataUrl) {
        setImageSrc(found.imageDataUrl);
        return;
      }
      const signed = await getReceiptSignedUrl(found.imagePath);
      if (!cancelled) setImageSrc(signed);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, user]);

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
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
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
