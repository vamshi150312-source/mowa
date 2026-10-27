/** `light` is for dark backgrounds such as Reels. */
export function Spinner({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 ${
        light ? "border-white/30 border-t-white" : "border-neutral-300 border-t-neutral-800"
      } ${className}`}
    />
  );
}
