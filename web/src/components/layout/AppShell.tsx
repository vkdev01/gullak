"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, isDemoMode, setToken } from "@/lib/api";
import { navGroups, site } from "@/config/site";
import s from "./AppShell.module.scss";

const trim = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);

function AccountMenu() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={s.account} ref={ref}>
      <button
        type="button"
        className={s.accountBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.avatar} aria-hidden="true">
          {(me?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className={s.accountText}>
          <b>{me?.name ?? "Account"}</b>
          <em>{isDemoMode() ? "Demo · this browser" : me?.email}</em>
        </span>
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setToken(null);
              router.push("/login/");
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = trim(usePathname() ?? "/");

  if (pathname === "/login") return <>{children}</>;

  const links = navGroups.flatMap((g) => g.items);

  return (
    <div className={s.shell}>
      <aside className={s.rail}>
        <Link href="/" className={s.mark}>
          <i>G</i> {site.name}
        </Link>
        <nav className={s.nav} aria-label="Main">
          {navGroups.map((group) => (
            <div key={group.label} className={s.group}>
              <span className={s.groupLabel}>{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={trim(item.href) === pathname ? "page" : undefined}
                  className={trim(item.href) === pathname ? s.on : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <AccountMenu />
      </aside>

      <header className={s.top}>
        <Link href="/" className={s.mark}>
          <i>G</i> {site.name}
        </Link>
        <nav className={s.topNav} aria-label="Main">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className={trim(item.href) === pathname ? s.on : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className={s.content}>{children}</div>
    </div>
  );
}
