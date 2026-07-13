"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/lib/auth";
import { saveExpense } from "@/lib/db";
import { compressReceiptImage, fileToDataUrl } from "@/lib/image";
import { extractExpenseFromImage, warmupOcr } from "@/lib/ocr";
import { queueForSync } from "@/lib/sync";
import {
  CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
} from "@/lib/types";

export default function NovaDespesaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrRaw, setOcrRaw] = useState("");
  const [ocrFilled, setOcrFilled] = useState<string[]>([]);
  const [ocrProgress, setOcrProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void warmupOcr();
  }, []);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setError(null);
    setOcrBusy(true);
    setOcrProgress("Preparando imagem…");
    setOcrFilled([]);
    setAmount("");
    setInvoiceNumber("");

    try {
      const compressed = await compressReceiptImage(file);
      const dataUrl = await fileToDataUrl(compressed);
      setImageFile(compressed);
      setPreview(dataUrl);

      setOcrProgress("Lendo com Google Vision…");
      const ocr = await extractExpenseFromImage(compressed);
      setOcrRaw(ocr.rawText);
      setOcrConfidence(ocr.confidence);

      const filled: string[] = [];
      if (ocr.amount != null) {
        setAmount(ocr.amount.toFixed(2).replace(".", ","));
        filled.push("valor");
      }
      if (ocr.invoiceNumber) {
        setInvoiceNumber(ocr.invoiceNumber);
        filled.push("número da nota");
      }
      if (ocr.date) {
        setDate(ocr.date);
        filled.push("data");
      }
      // Categoria e região: só preenchimento manual (OCR não altera)
      setOcrFilled(filled);
      if (ocr.provider === "google-vision") {
        setOcrProgress("Lido com Google Vision");
      } else {
        setOcrProgress("Lido offline (Tesseract)");
      }

      if (filled.length === 0) {
        setError(
          "Não consegui ler valor, NF ou data. Ajuste a foto (boa luz, nota reta) ou preencha manualmente.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível ler a nota. Preencha manualmente.",
      );
    } finally {
      setOcrBusy(false);
      setOcrProgress("");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);

    const parsedAmount = Number.parseFloat(
      amount.replace(/\./g, "").replace(",", "."),
    );
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor válido.");
      setBusy(false);
      return;
    }
    if (!category) {
      setError("Selecione a categoria.");
      setBusy(false);
      return;
    }
    if (!region.trim()) {
      setError("Informe a região / cliente.");
      setBusy(false);
      return;
    }

    const localId = uuidv4();
    const now = new Date().toISOString();
    const expense: Expense = {
      id: localId,
      localId,
      serverId: null,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      amount: parsedAmount,
      invoiceNumber: invoiceNumber.trim(),
      date,
      category,
      region: region.trim(),
      notes: notes.trim(),
      status: "pendente_sync",
      imageBlob: imageFile ?? undefined,
      imageDataUrl: preview ?? undefined,
      imagePath: null,
      ocrConfidence,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };

    try {
      await saveExpense(expense);
      await queueForSync(localId);
      router.push(`/despesa/${localId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setBusy(false);
    }
  }

  if (
    user?.role !== "tecnico" &&
    user?.role !== "executivo" &&
    user?.role !== "gestor"
  ) {
    return (
      <div className="card p-6">
        Seu perfil não cadastra despesas de campo. Use o dashboard ou o
        financeiro.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-3xl text-[var(--ink)]">Nova despesa</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          OCR preenche só <strong>valor</strong>, <strong>número da NF</strong>{" "}
          e <strong>data</strong>. Categoria e região você informa.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <div>
          <p className="label">1. Foto da nota</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={ocrBusy}
              onClick={() => cameraRef.current?.click()}
            >
              Tirar foto
            </button>
            <button
              type="button"
              disabled={ocrBusy}
              className="rounded-xl border border-[var(--border)] px-3 py-2 font-semibold hover:bg-[var(--sand)] disabled:opacity-50"
              onClick={() => galleryRef.current?.click()}
            >
              Galeria
            </button>
          </div>
          <input
            ref={cameraRef}
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          {ocrBusy && (
            <div className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-3 text-sm text-[var(--accent)]">
              {ocrProgress || "Lendo a nota automaticamente…"} Isso pode levar
              alguns segundos na primeira vez.
            </div>
          )}

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Pré-visualização da nota"
              className="mt-3 max-h-64 w-full rounded-xl object-contain bg-[var(--sand)]"
            />
          )}

          {!ocrBusy && ocrFilled.length > 0 && (
            <p className="mt-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]">
              Li automaticamente: {ocrFilled.join(", ")}.
              {ocrConfidence != null
                ? ` Confiança ~${(ocrConfidence * 100).toFixed(0)}%.`
                : ""}{" "}
              Confira os campos abaixo.
            </p>
          )}
        </div>

        <div>
          <p className="label mb-2">2. Confira o que o OCR leu</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Valor (R$)</label>
              <input
                className={`field ${ocrFilled.includes("valor") ? "ring-2 ring-[var(--accent)]" : ""}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div>
              <label className="label">Número da nota / NF</label>
              <input
                className={`field ${ocrFilled.includes("número da nota") ? "ring-2 ring-[var(--accent)]" : ""}`}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ex: 000123"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Data</label>
            <input
              className={`field ${ocrFilled.includes("data") ? "ring-2 ring-[var(--accent)]" : ""}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <p className="label mb-2">3. Você preenche</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Categoria</label>
              <select
                className="field"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExpenseCategory | "")
                }
                required
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="label">Região / cliente</label>
              <input
                className="field"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ex: Região Sul — Cliente X"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea
            className="field min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {ocrRaw && (
          <details className="text-xs text-[var(--muted)]">
            <summary className="cursor-pointer">Texto lido da nota</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--sand)] p-2">
              {ocrRaw}
            </pre>
          </details>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button
          className="btn-primary w-full"
          disabled={busy || ocrBusy || !preview}
          type="submit"
        >
          {busy ? "Salvando…" : "4. Salvar despesa"}
        </button>
      </form>
    </div>
  );
}
