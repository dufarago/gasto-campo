import { v4 as uuidv4 } from "uuid";
import {
  countPendingSync,
  getExpense,
  listExpenses,
  listExpensesByUser,
  listPendingSync,
  saveExpense,
} from "./db";
import { dataUrlToBlob } from "./image";
import { createBrowserSupabase, isSupabaseConfigured } from "./supabase/client";
import type { Expense } from "./types";

export async function queueForSync(localId: string): Promise<Expense | null> {
  const expense = await getExpense(localId);
  if (!expense) return null;

  const next: Expense = {
    ...expense,
    status: "pendente_sync",
    updatedAt: new Date().toISOString(),
  };
  await saveExpense(next);

  if (navigator.onLine) {
    await syncPendingExpenses();
    return (await getExpense(localId)) ?? next;
  }

  return next;
}

export async function syncPendingExpenses(): Promise<{
  synced: number;
  failed: number;
}> {
  const pending = (await listPendingSync()).filter(
    (e) => e.status === "pendente_sync",
  );

  let synced = 0;
  let failed = 0;

  for (const expense of pending) {
    try {
      await syncOneExpense(expense);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}

async function syncOneExpense(expense: Expense): Promise<void> {
  if (!isSupabaseConfigured()) {
    // Modo local: marca como enviado no dispositivo (visível no dashboard local)
    const next: Expense = {
      ...expense,
      status: "enviado",
      serverId: expense.serverId ?? uuidv4(),
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveExpense(next);
    return;
  }

  const supabase = createBrowserSupabase();
  if (!supabase) throw new Error("Supabase indisponível");

  let imagePath = expense.imagePath ?? null;

  if (!imagePath && (expense.imageBlob || expense.imageDataUrl)) {
    const blob =
      expense.imageBlob ??
      (expense.imageDataUrl
        ? await dataUrlToBlob(expense.imageDataUrl)
        : null);
    if (blob) {
      const path = `${expense.userId}/${expense.localId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      imagePath = path;
    }
  }

  const payload = {
    local_id: expense.localId,
    user_id: expense.userId,
    user_name: expense.userName,
    user_role: expense.userRole,
    amount: expense.amount,
    invoice_number: expense.invoiceNumber,
    expense_date: expense.date,
    category: expense.category,
    region: expense.region,
    notes: expense.notes,
    status: "enviado",
    image_path: imagePath,
    ocr_confidence: expense.ocrConfidence,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("expenses")
    .upsert(payload, { onConflict: "local_id" })
    .select("id")
    .single();

  if (error) throw error;

  const next: Expense = {
    ...expense,
    serverId: data.id,
    imagePath,
    status: "enviado",
    syncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveExpense(next);
}

export async function getPendingSyncCount(): Promise<number> {
  return countPendingSync();
}

export async function getAllLocalExpenses(): Promise<Expense[]> {
  return listExpenses();
}

type RemoteExpenseRow = {
  id: string;
  local_id: string;
  user_id: string;
  user_name: string;
  user_role: Expense["userRole"];
  amount: number | string;
  invoice_number: string;
  expense_date: string;
  category: Expense["category"];
  region: string;
  notes: string;
  status: Expense["status"];
  image_path: string | null;
  ocr_confidence: number | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

function mapRemoteExpense(row: RemoteExpenseRow): Expense {
  return {
    id: row.local_id,
    localId: row.local_id,
    serverId: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    amount: Number(row.amount),
    invoiceNumber: row.invoice_number ?? "",
    date: row.expense_date,
    category: row.category,
    region: row.region ?? "",
    notes: row.notes ?? "",
    status: row.status,
    imagePath: row.image_path,
    ocrConfidence: row.ocr_confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
    rejectionReason: row.rejection_reason,
  };
}

/** Busca despesas no Supabase e mescla com o IndexedDB local. */
export async function loadExpenses(options?: {
  userId?: string;
  scope?: "all" | "mine";
}): Promise<Expense[]> {
  const scope = options?.scope ?? "mine";
  const userId = options?.userId;

  const local =
    scope === "all" || !userId
      ? await listExpenses()
      : await listExpensesByUser(userId);

  if (!isSupabaseConfigured()) return local;

  const supabase = createBrowserSupabase();
  if (!supabase) return local;

  let query = supabase.from("expenses").select("*").order("updated_at", {
    ascending: false,
  });

  if (scope === "mine" && userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) return local;

  const remote = (data as RemoteExpenseRow[]).map(mapRemoteExpense);
  const byLocalId = new Map<string, Expense>();

  for (const item of remote) {
    byLocalId.set(item.localId, item);
  }
  for (const item of local) {
    const existing = byLocalId.get(item.localId);
    if (!existing) {
      byLocalId.set(item.localId, item);
      continue;
    }
    // Prefere a versão mais recente; mantém imagem local se existir
    const localNewer =
      new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime();
    byLocalId.set(item.localId, {
      ...(localNewer ? item : existing),
      imageDataUrl: item.imageDataUrl ?? existing.imageDataUrl,
      imageBlob: item.imageBlob ?? existing.imageBlob,
      status:
        item.status === "pendente_sync" || item.status === "rascunho"
          ? item.status
          : localNewer
            ? item.status
            : existing.status,
    });
  }

  return [...byLocalId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function updateExpenseStatus(
  localId: string,
  status: Expense["status"],
  rejectionReason?: string,
): Promise<void> {
  const expense = await getExpense(localId);
  const now = new Date().toISOString();

  if (expense) {
    const next: Expense = {
      ...expense,
      status,
      rejectionReason: rejectionReason ?? expense.rejectionReason,
      updatedAt: now,
    };
    await saveExpense(next);
  }

  if (isSupabaseConfigured()) {
    const supabase = createBrowserSupabase();
    const payload = {
      status,
      rejection_reason: rejectionReason ?? null,
      updated_at: now,
    };

    if (expense?.serverId) {
      await supabase?.from("expenses").update(payload).eq("id", expense.serverId);
    } else {
      await supabase?.from("expenses").update(payload).eq("local_id", localId);
    }
  }
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
