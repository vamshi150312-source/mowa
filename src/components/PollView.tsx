"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { compactNumber } from "@/lib/format";
import type { Poll } from "@/lib/types";
import { CheckIcon, PollIcon } from "./icons";

/** A post's poll: option buttons before you vote, live result bars after. Tap another option to change your vote. */
export function PollView({ postId, poll: initial, hideCounts }: { postId: string; poll: Poll; hideCounts: boolean }) {
  const [poll, setPoll] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(Promise.resolve());
  const total = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const voted = poll.myVote !== null;

  function vote(option: number) {
    if (option === poll.myVote) return;
    const before = poll;
    // Optimistic: move my vote, then replace with the server's totals.
    setPoll({
      ...poll,
      myVote: option,
      options: poll.options.map((o, i) => ({
        ...o,
        votes: o.votes + (i === option ? 1 : 0) - (i === poll.myVote ? 1 : 0),
      })),
    });
    setError(null);
    pending.current = pending.current.then(() =>
      api.votePoll(postId, option).then(setPoll, (e) => {
        setPoll(before);
        setError(e instanceof Error ? e.message : "Couldn't save your vote.");
      }),
    );
  }

  return (
    <section aria-label="Poll" className="mx-3 mt-3 rounded-2xl border border-neutral-200 p-3">
      <p className="mb-2.5 flex items-start gap-2 text-sm font-semibold">
        <PollIcon className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
        <span className="break-words">{poll.question}</span>
      </p>
      <ul className="space-y-1.5">
        {poll.options.map((option, i) => {
          const pct = total ? Math.round((option.votes / total) * 100) : 0;
          const mine = poll.myVote === i;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => vote(i)}
                aria-pressed={mine}
                className={`relative flex w-full items-center overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  voted
                    ? mine
                      ? "border-pink-300"
                      : "border-neutral-200"
                    : "border-neutral-300 font-semibold hover:border-pink-300 hover:bg-pink-50"
                }`}
              >
                {voted && (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 transition-[width] duration-500 ease-out ${
                      mine ? "bg-gradient-to-r from-violet-100 to-pink-100" : "bg-neutral-100"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className={`relative flex min-w-0 flex-1 items-center gap-1.5 ${mine ? "font-semibold" : ""}`}>
                  <span className="truncate">{option.text}</span>
                  {mine && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-pink-600" />}
                </span>
                {voted && <span className="relative ml-2 text-xs font-semibold text-neutral-600">{pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        {!voted
          ? "Vote to see the results"
          : `${hideCounts ? "" : `${compactNumber(total)} ${total === 1 ? "vote" : "votes"} · `}Tap another option to change your vote`}
      </p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </section>
  );
}
