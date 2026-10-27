import type { ReactNode } from "react";

/** Ring around an avatar: brand gradient when there are unseen stories, grey once all are seen. */
export function StoryRing({ seen, children }: { seen: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full p-[2.5px] ${
        seen ? "bg-neutral-300" : "bg-gradient-to-tr from-orange-400 via-pink-500 to-violet-600"
      }`}
    >
      <span className="inline-flex rounded-full bg-white p-[2px]">{children}</span>
    </span>
  );
}
