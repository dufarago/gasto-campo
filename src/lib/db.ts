import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Expense } from "./types";

interface GastoCampoDB extends DBSchema {
  expenses: {
    key: string;
    value: Expense;
    indexes: {
      "by-user": string;
      "by-status": string;
      "by-updated": string;
    };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = "gasto-campo";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GastoCampoDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB só está disponível no cliente");
  }
  if (!dbPromise) {
    dbPromise = openDB<GastoCampoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("expenses", { keyPath: "localId" });
        store.createIndex("by-user", "userId");
        store.createIndex("by-status", "status");
        store.createIndex("by-updated", "updatedAt");
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function saveExpense(expense: Expense): Promise<void> {
  const db = await getDb();
  await db.put("expenses", expense);
}

export async function getExpense(localId: string): Promise<Expense | undefined> {
  const db = await getDb();
  return db.get("expenses", localId);
}

export async function deleteExpense(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete("expenses", localId);
}

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb();
  const all = await db.getAll("expenses");
  return all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function listExpensesByUser(userId: string): Promise<Expense[]> {
  const all = await listExpenses();
  return all.filter((e) => e.userId === userId);
}

export async function listPendingSync(): Promise<Expense[]> {
  const all = await listExpenses();
  return all.filter((e) => e.status === "pendente_sync" || e.status === "rascunho");
}

export async function countPendingSync(): Promise<number> {
  const pending = await listPendingSync();
  return pending.filter((e) => e.status === "pendente_sync").length;
}
