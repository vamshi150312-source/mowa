"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { LeafIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/Switch";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { prepareImage } from "@/lib/image";
import { DAILY_LIMIT_CHOICES, dayKey, formatMinutes, updateMindful, useMindful } from "@/lib/mindful";
import { validateFullName, validatePassword, validateUsername } from "@/lib/validation";

const MAX_BIO = 150;

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null; // AppShell redirects to /login
  return (
    <main className="pb-10">
      <PageHeader title="Settings" back />
      <EditProfile />
      <Mindful />
      <ChangePassword />
      <Account />
      <p className="px-4 pt-6 text-center text-xs text-neutral-400">
        Your data is stored in PostgreSQL by Mova&apos;s Spring Boot backend.
      </p>
    </main>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-neutral-200 px-4 py-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabeledInput({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

function Status({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (success) return <p className="text-sm text-green-600">{success}</p>;
  return null;
}

const buttonClass =
  "rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50";

function EditProfile() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user!.fullName);
  const [username, setUsername] = useState(user!.username);
  const [bio, setBio] = useState(user!.bio);
  // undefined = keep current photo, null = remove it, Blob = new photo
  const [avatar, setAvatar] = useState<Blob | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!(avatar instanceof Blob)) return setAvatarPreview(null);
    const url = URL.createObjectURL(avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const shownAvatar = avatar === null ? "" : (avatarPreview ?? user!.avatarUrl);
  const dirty =
    fullName !== user!.fullName || username !== user!.username || bio !== user!.bio || avatar !== undefined;

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image for your profile photo.");
    try {
      setAvatar(await prepareImage(file, 320));
      setError(null);
    } catch {
      setError("Couldn't read that image.");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const invalid = validateFullName(fullName) ?? validateUsername(username);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const previousUsername = user!.username;
      const profile = await updateProfile({ fullName: fullName.trim(), username, bio: bio.trim(), avatar });
      setAvatar(undefined);
      setSuccess("Profile saved.");
      // The old /u/<username> URL no longer exists, so show the profile at its new address.
      if (profile.username !== previousUsername) router.replace(`/u/${profile.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Edit profile">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-3">
          <Avatar user={{ username: username || user!.username, avatarUrl: shownAvatar }} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{username || user!.username}</p>
            <div className="mt-1 flex gap-3 text-sm font-semibold">
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sky-500">
                Change photo
              </button>
              {shownAvatar && (
                <button type="button" onClick={() => setAvatar(null)} className="text-red-500">
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <LabeledInput label="Name" value={fullName} maxLength={60} onChange={(e) => setFullName(e.target.value)} />
        <LabeledInput
          label="Username"
          value={username}
          autoCapitalize="none"
          maxLength={30}
          hint="Lowercase letters, numbers, periods and underscores."
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Bio</span>
          <textarea
            value={bio}
            rows={3}
            maxLength={MAX_BIO}
            onChange={(e) => setBio(e.target.value)}
            className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <span className="block text-right text-xs text-neutral-400">
            {bio.length}/{MAX_BIO}
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={!dirty || saving} className={buttonClass}>
            {saving ? "Saving…" : "Save"}
          </button>
          <Status error={error} success={success} />
        </div>
      </form>
    </Section>
  );
}

/** Wellbeing settings and this device's screen time for the last 7 days. */
function Mindful() {
  const { hideCounts, dailyLimitMinutes, usage } = useMindful();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { key: dayKey(date), label: date.toLocaleDateString("en", { weekday: "narrow" }), seconds: usage[dayKey(date)] ?? 0 };
  });
  const today = days[6].seconds;
  const average = days.reduce((sum, d) => sum + d.seconds, 0) / 7;
  const tallest = Math.max(...days.map((d) => d.seconds), 60);

  return (
    <Section title="Mindful mode" icon={<LeafIcon className="h-5 w-5 text-emerald-600" />}>
      <p className="-mt-2 mb-4 text-sm text-neutral-500">
        Use Mova on your terms. These settings and your screen time stay on this device.
      </p>

      <div className="rounded-xl bg-neutral-50 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-neutral-500">Today</p>
            <p className="text-2xl font-bold">{formatMinutes(today)}</p>
          </div>
          <p className="text-right text-xs text-neutral-500">
            7-day average
            <span className="block text-sm font-semibold text-neutral-800">{formatMinutes(average)}</span>
          </p>
        </div>
        <div className="mt-4 flex h-24 items-end gap-2" role="img" aria-label="Time on Mova over the last 7 days">
          {days.map((d, i) => (
            <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                title={`${d.key}: ${formatMinutes(d.seconds)}`}
                className={`w-full rounded-md ${
                  i === 6 ? "bg-gradient-to-t from-violet-500 via-pink-500 to-orange-400" : "bg-neutral-300"
                }`}
                style={{ height: `${Math.max(4, (d.seconds / tallest) * 100)}%` }}
              />
              <span className={`text-[11px] ${i === 6 ? "font-semibold" : "text-neutral-500"}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Daily break reminder</span>
          <span className="block text-xs text-neutral-500">Offers a short breather once you reach your limit.</span>
        </span>
        <select
          value={dailyLimitMinutes}
          onChange={(e) => updateMindful({ dailyLimitMinutes: Number(e.target.value), snoozedUntil: 0 })}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none"
        >
          {DAILY_LIMIT_CHOICES.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "Off" : m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ` ${m % 60} min` : ""}`}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={hideCounts}
        onClick={() => updateMindful({ hideCounts: !hideCounts })}
        className="mt-4 flex w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Hide counts</span>
          <span className="block text-xs text-neutral-500">
            Hide reaction, comment and vote numbers so posts are about the post, not the score.
          </span>
        </span>
        <Switch on={hideCounts} />
      </button>
    </Section>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    if (!current) return setError("Enter your current password.");
    const invalid = validatePassword(next);
    if (invalid) return setError(invalid);
    if (next !== confirm) return setError("New passwords don't match.");
    setSaving(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Change password">
      <form onSubmit={save} className="space-y-3">
        <LabeledInput label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <LabeledInput label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />
        <LabeledInput label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !current || !next || !confirm} className={buttonClass}>
            {saving ? "Updating…" : "Change password"}
          </button>
          <Status error={error} success={success} />
        </div>
      </form>
    </Section>
  );
}

function Account() {
  const { user, signOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <Section title="Account">
      <button
        type="button"
        onClick={signOut}
        className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-semibold hover:bg-neutral-200"
      >
        Log out
      </button>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
        >
          Delete account
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm">
            This permanently deletes your profile, posts, comments, likes and follows. It can&apos;t be undone.
            Type <span className="font-semibold">{user!.username}</span> to confirm.
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="none"
            aria-label="Type your username to confirm"
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={typed !== user!.username || busy}
              className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
              className="flex-1 rounded-lg bg-white py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </Section>
  );
}
