"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { CallProvider } from "@/context/CallContext";
import { BottomNav } from "./BottomNav";
import { MindfulBreak } from "./MindfulBreak";
import { Spinner } from "./Spinner";

const PUBLIC_ROUTES = ["/login", "/signup"];

/** Mobile-first column with a persistent bottom nav; redirects based on auth state. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
  }, [user, loading, isPublic, router]);

  const ready = !loading && (isPublic ? !user : !!user);

  return (
    <CallProvider>
      <div className={`mx-auto min-h-dvh max-w-md bg-white sm:border-x sm:border-neutral-200 ${isPublic ? "" : "pb-16"}`}>
        {ready ? (
          children
        ) : (
          <div className="flex min-h-dvh items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>
      {ready && !isPublic && (
        <>
          <BottomNav />
          <MindfulBreak />
        </>
      )}
    </CallProvider>
  );
}
