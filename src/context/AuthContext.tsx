"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Profile, ProfileUpdate, SignUpInput } from "@/lib/types";

type AuthState = {
  user: Profile | null;
  /** True until the persisted session has been restored. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<Profile>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getCurrentUser()
      .then((u) => active && setUser(u))
      .finally(() => active && setLoading(false));
    const unsubscribe = api.onAuthChange((u) => active && setUser(u));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Same object until the user or loading state changes, so consumers don't re-render needlessly.
  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    signIn: async (email, password) => setUser(await api.signIn(email, password)),
    signUp: async (input) => setUser(await api.signUp(input)),
    signOut: async () => {
      await api.signOut();
      setUser(null);
    },
    updateProfile: async (update) => {
      const profile = await api.updateProfile(update);
      setUser(profile);
      return profile;
    },
    deleteAccount: async () => {
      await api.deleteAccount();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
