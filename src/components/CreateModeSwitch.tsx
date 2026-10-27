"use client";

import { useRouter } from "next/navigation";

/** "Post | Story" switch shown as the Create page's title. */
export function CreateModeSwitch({ mode }: { mode: "post" | "story" }) {
  const router = useRouter();
  return (
    <span role="tablist" aria-label="What to create" className="inline-flex rounded-full bg-neutral-100 p-0.5 text-xs font-semibold">
      {(["post", "story"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => router.replace(m === "story" ? "/create?mode=story" : "/create")}
          className={`rounded-full px-3.5 py-1 capitalize transition-colors ${
            mode === m ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {m}
        </button>
      ))}
    </span>
  );
}
