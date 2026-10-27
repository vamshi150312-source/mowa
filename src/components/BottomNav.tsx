"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "./Avatar";
import { CreateIcon, HomeIcon, ReelsIcon, SearchIcon } from "./icons";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;

  const profileHref = `/u/${user.username}`;
  const items = [
    { href: "/", label: "Home", icon: HomeIcon, active: pathname === "/" },
    { href: "/search", label: "Search", icon: SearchIcon, active: pathname.startsWith("/search") },
    { href: "/create", label: "Create", icon: CreateIcon, active: pathname.startsWith("/create") },
    { href: "/reels", label: "Reels", icon: ReelsIcon, active: pathname.startsWith("/reels") },
  ];
  const profileActive = pathname === profileHref;
  // Reels is full-screen video, so the nav goes dark there.
  const dark = pathname.startsWith("/reels");

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur ${
        dark ? "border-neutral-800 bg-black text-white" : "border-neutral-200 bg-white/95"
      }`}
    >
      <ul className="mx-auto flex h-14 max-w-md items-center justify-around">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={href}>
            <Link
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="flex h-12 w-12 items-center justify-center rounded-lg transition-transform active:scale-90"
            >
              <Icon filled={active} />
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={profileHref}
            aria-label="Profile"
            aria-current={profileActive ? "page" : undefined}
            className="flex h-12 w-12 items-center justify-center transition-transform active:scale-90"
          >
            <span className={`rounded-full ${profileActive ? "ring-2 ring-neutral-900 ring-offset-1" : ""} ${dark ? "ring-offset-black" : ""}`}>
              <Avatar user={user} size="xs" />
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
