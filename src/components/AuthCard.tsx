import type { InputHTMLAttributes, ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthCard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 py-10">
      <div className="w-full max-w-sm rounded-sm border border-neutral-200 bg-white px-8 py-10">
        <h1 aria-label="Mova" className="mb-8 flex justify-center">
          <Logo size="lg" />
        </h1>
        {children}
      </div>
      <div className="w-full max-w-sm rounded-sm border border-neutral-200 bg-white px-8 py-5 text-center text-sm">
        {footer}
      </div>
    </main>
  );
}

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        placeholder={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-sm border bg-neutral-50 px-2.5 py-2.5 text-sm outline-none transition-colors focus:border-neutral-400 ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 w-full rounded-lg bg-sky-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
