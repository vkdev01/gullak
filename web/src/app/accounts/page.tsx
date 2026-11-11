"use client";

import { useEffect, useState } from "react";
import { api, type Account } from "@/lib/api";
import { money } from "@/lib/format";
import s from "./page.module.scss";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    api.accounts().then(setAccounts).catch(() => {});
  }, []);

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <main className={s.page}>
      <h2 className={s.h}>Accounts</h2>
      <p className={s.sub}>Balances are computed from the opening balance plus every transaction.</p>

      <div className={s.card}>
        <div className={s.rowTotal}>
          <b>Net across accounts</b>
          <span className="num">{money(total)}</span>
        </div>
        {accounts.map((a) => (
          <div key={a.id} className={s.row}>
            <div className={s.mk}>{a.name.slice(0, 1).toUpperCase()}</div>
            <div className={s.grow}>
              <b>{a.name}</b>
              <div className={s.meta}>
                {a.type.replace("_", " ")}
                {a.masked_number ? ` · ${a.masked_number}` : ""}
              </div>
            </div>
            <span className="num">{money(a.balance)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
