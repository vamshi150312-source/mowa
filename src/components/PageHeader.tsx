"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BackIcon } from "./icons";

export function PageHeader({ title, back = false, action }: { title: ReactNode; back?: boolean; action?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 grid h-12 grid-cols-[5rem_1fr_5rem] items-center border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="flex justify-start pl-2">
        {back && (
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-1">
            <BackIcon />
          </button>
        )}
      </div>
      <h1 className="truncate text-center text-base font-semibold">{title}</h1>
      <div className="flex justify-end pr-4">{action}</div>
    </header>
  );
}
