"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { SyncBanner } from "@/components/SyncBanner";
import { useAuth } from "@/lib/auth";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted)]">Carregando…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <AppNav />
      <SyncBanner />
      <div className="mx-auto max-w-5xl px-4 py-5">{children}</div>
    </div>
  );
}
