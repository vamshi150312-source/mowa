"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";

/** /profile -> the signed-in user's profile page. */
export default function MyProfileRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(`/u/${user.username}`);
  }, [user, router]);
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner />
    </div>
  );
}
