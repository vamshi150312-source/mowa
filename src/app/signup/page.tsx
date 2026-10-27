"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, SubmitButton } from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
  type FieldErrors,
} from "@/lib/validation";

type Fields = "email" | "fullName" | "username" | "password";
const FIELDS: { name: Fields; label: string; type: string; autoComplete: string }[] = [
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
  { name: "username", label: "Username", type: "text", autoComplete: "username" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
];

export default function SignupPage() {
  const { signUp } = useAuth();
  const [values, setValues] = useState<Record<Fields, string>>({
    email: "",
    fullName: "",
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [touched, setTouched] = useState<Partial<Record<Fields, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (v = values): FieldErrors<Fields> => ({
    email: validateEmail(v.email),
    fullName: validateFullName(v.fullName),
    username: validateUsername(v.username),
    password: validatePassword(v.password),
  });

  function update(field: Fields, raw: string) {
    // Usernames are case-insensitive; normalise as the user types.
    const value = field === "username" ? raw.toLowerCase().replace(/\s/g, "") : raw;
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setTouched({ email: true, fullName: true, username: true, password: true });
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signUp({
        email: values.email.trim(),
        password: values.password,
        username: values.username,
        fullName: values.fullName.trim(),
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign up failed.");
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      footer={
        <>
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-sky-500">
            Log in
          </Link>
        </>
      }
    >
      <p className="-mt-4 mb-5 text-center font-semibold text-neutral-500">
        Sign up to see photos from your friends.
      </p>
      <form onSubmit={submit} noValidate className="space-y-2">
        {FIELDS.map((f) => (
          <Field
            key={f.name}
            label={f.label}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            autoCapitalize={f.name === "username" ? "none" : undefined}
            value={values[f.name]}
            error={touched[f.name] ? errors[f.name] : undefined}
            onChange={(e) => update(f.name, e.target.value)}
            onBlur={() => {
              setTouched((t) => ({ ...t, [f.name]: true }));
              setErrors(validate());
            }}
          />
        ))}
        <SubmitButton disabled={submitting}>{submitting ? "Signing up…" : "Sign up"}</SubmitButton>
        {formError && <p className="pt-2 text-center text-sm text-red-500">{formError}</p>}
      </form>
    </AuthCard>
  );
}
