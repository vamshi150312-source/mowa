import { useId } from "react";

/** App icon: gradient tile with a white "M" and a dot above it, like a figure with raised arms. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${gradient})`} />
      <path
        d="M13.5 33V18.5l10.5 10.5 10.5-10.5V33"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="13" r="3" fill="#fff" />
    </svg>
  );
}

/** Mark + "mova" wordmark. `size` scales both together. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={`inline-flex items-center ${lg ? "gap-3" : "gap-2"}`}>
      <LogoMark className={lg ? "h-12 w-12" : "h-8 w-8"} />
      <span
        className={`bg-gradient-to-r from-violet-600 via-pink-500 to-orange-500 bg-clip-text font-logo font-bold leading-none tracking-tight text-transparent ${
          lg ? "text-5xl" : "text-[28px]"
        }`}
      >
        mova
      </span>
    </span>
  );
}
