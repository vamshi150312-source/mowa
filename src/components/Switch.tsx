/** Visual on/off switch. Put it inside a button with role="switch" and aria-checked. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-pink-500" : "bg-neutral-300"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </span>
  );
}
