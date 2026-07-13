"use client";

import { useCallback, useEffect, useState } from "react";
import type { Expense } from "./types";
import { loadExpenses } from "./sync";

export function useLocalExpenses(userId?: string, scope: "all" | "mine" = "mine") {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadExpenses({ userId, scope });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [userId, scope]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const data = await loadExpenses({ userId, scope });
          if (!cancelled) setItems(data);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId, scope]);

  return { items, loading, reload };
}
