"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, SubmitButton } from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { validateEmail, validatePassword, type FieldErrors } from "@/lib/validation";

type Fields = "email" | "password";

// The demo account the backend creates with the sample data (every sample account uses this password).
const DEMO_EMAIL = "demo@mova.dev";
const MOCK_PASSWORD = "password123";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [touched, setTouched] = useState<Partial<Record<Fields, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (v = values): FieldErrors<Fields> => ({
    email: validateEmail(v.email),
    password: validatePassword(v.password),
  });

  function update(field: Fields, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setTouched({ email: true, password: true });
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(values.email.trim(), values.password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-sky-500">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-2">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={touched.email ? errors.email : undefined}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => {
            setTouched((t) => ({ ...t, email: true }));
            setErrors(validate());
          }}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={touched.password ? errors.password : undefined}
          onChange={(e) => update("password", e.target.value)}
          onBlur={() => {
            setTouched((t) => ({ ...t, password: true }));
            setErrors(validate());
          }}
        />
        <SubmitButton disabled={submitting}>{submitting ? "Logging in…" : "Log in"}</SubmitButton>
        {formError && <p className="pt-2 text-center text-sm text-red-500">{formError}</p>}
      </form>

      <div className="mt-6 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
        <p className="font-semibold">Demo account</p>
        <p className="mt-1">
          {DEMO_EMAIL} / {MOCK_PASSWORD}
        </p>
        <button
          type="button"
          className="mt-2 font-semibold text-sky-500"
          onClick={() => {
            setValues({ email: DEMO_EMAIL, password: MOCK_PASSWORD });
            setErrors({});
          }}
        >
          Fill demo credentials
        </button>
      </div>
    </AuthCard>
  );
}
