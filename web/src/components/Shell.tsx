"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDemoMode } from "@/lib/api";
import s from "./Shell.module.scss";

const NAV = [
  { href: "/", label: "Ledger" },
  { href: "/accounts/", label: "Accounts" },
  { href: "/login/", label: "Sign in" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demo = isDemoMode();

  return (
    <>
      <header className={s.top}>
        <div className={s.inner}>
          <Link href="/" className={s.mark}>
            <i>G</i> gullak
          </Link>
          <nav className={s.nav}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href || (item.href === "/" && pathname === "/") ? s.on : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={s.right}>
            {demo && <span className={s.demo}>Demo · local</span>}
            <div className={s.avatar}>V</div>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
