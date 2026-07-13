"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "gestor") {
      router.replace("/dashboard");
    } else if (user.role === "financeiro") {
      router.replace("/financeiro");
    } else {
      router.replace("/historico");
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-[var(--muted)]">Carregando…</p>
    </main>
  );
}
