"use client";

import { useCallback, useEffect, useState } from "react";
import { getPendingSyncCount, syncPendingExpenses } from "@/lib/sync";

export function SyncBanner() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPending(await getPendingSyncCount());
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) {
      setMessage("Sem internet — as notas ficam salvas no aparelho.");
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const result = await syncPendingExpenses();
      await refresh();
      if (result.synced > 0) {
        setMessage(`${result.synced} despesa(s) enviada(s).`);
      } else if (result.failed > 0) {
        setMessage("Falha parcial no envio. Tente de novo.");
      }
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void refresh();
    }, 0);
    const onOnline = () => {
      setOnline(true);
      void runSync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = window.setInterval(() => void refresh(), 8000);
    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [refresh, runSync]);

  if (!pending && online && !message) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p>
          {!online && "Você está offline. "}
          {pending > 0
            ? `${pending} pendente(s) de envio.`
            : message ?? "Tudo sincronizado."}
          {message && pending === 0 ? ` ${message}` : null}
        </p>
        {pending > 0 && (
          <button
            type="button"
            disabled={syncing || !online}
            onClick={() => void runSync()}
            className="rounded-md bg-amber-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {syncing ? "Enviando…" : "Enviar agora"}
          </button>
        )}
      </div>
    </div>
  );
}
