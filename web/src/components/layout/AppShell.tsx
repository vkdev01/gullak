"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react";
import { api, isDemoMode, setToken } from "@/lib/api";
import { navGroups, site } from "@/config/site";
import CommandPalette from "./CommandPalette";
import s from "./AppShell.module.scss";

const trim = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);

type Me = { name: string; email: string } | null;

function AccountMenu({ me, compact = false }: { me: Me; compact?: boolean }) {
  const router = useRouter();

  return (
    <Menu as="div" className={compact ? s.accountCompact : s.account}>
      <MenuButton className={s.accountBtn} aria-label={compact ? "Account" : undefined}>
        <span className={s.avatar} aria-hidden="true">
          {(me?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        {!compact && (
          <span className={s.accountText}>
            <b>{me?.name ?? "Account"}</b>
            <em>{isDemoMode() ? "Demo · this browser" : me?.email}</em>
          </span>
        )}
      </MenuButton>
      <MenuItems anchor={compact ? "bottom end" : "top start"} transition className={s.menu}>
        <MenuItem>
          <Link href="/accounts/">Accounts &amp; net worth</Link>
        </MenuItem>
        <MenuItem>
          <Link href="/budgets/">Salary day &amp; budgets</Link>
        </MenuItem>
        <MenuSeparator className={s.menuRule} />
        <MenuItem>
          <button
            type="button"
            onClick={() => {
              setToken(null);
              router.push("/login/");
            }}
          >
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = trim(usePathname() ?? "/");
  const [palette, setPalette] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const signedOut = pathname === "/login";

  useEffect(() => {
    if (signedOut) return;
    api.me().then(setMe).catch(() => setMe(null));
  }, [signedOut]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (signedOut) return <>{children}</>;

  const links = navGroups.flatMap((g) => g.items);

  return (
    <div className={s.shell}>
      <aside className={s.rail}>
        <Link href="/" className={s.mark}>
          <i>G</i> {site.name}
        </Link>
        <button type="button" className={s.jumpBtn} onClick={() => setPalette(true)}>
          <span>Jump to…</span>
          <kbd>⌘K</kbd>
        </button>
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
        <AccountMenu me={me} />
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
        <AccountMenu me={me} compact />
      </header>

      <div className={s.content}>{children}</div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
