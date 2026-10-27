export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required.";
  if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
}

export function validateUsername(username: string): string | undefined {
  if (!username) return "Username is required.";
  if (username.length < 3 || username.length > 30) return "Username must be 3–30 characters.";
  if (!USERNAME_PATTERN.test(username))
    return "Use only lowercase letters, numbers, periods and underscores.";
}

export function validateFullName(name: string): string | undefined {
  if (!name.trim()) return "Full name is required.";
  if (name.trim().length > 60) return "Full name must be 60 characters or fewer.";
}
