"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDemoMode } from "@/lib/api";
import { navItems, site } from "@/config/site";
import s from "./AppShell.module.scss";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demo = isDemoMode();

  return (
    <>
      <header className={s.top}>
        <div className={s.inner}>
          <Link href="/" className={s.mark}>
            <i>G</i> {site.name.toLowerCase()}
          </Link>
          <nav className={s.nav}>
            {navItems.map((item) => (
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
