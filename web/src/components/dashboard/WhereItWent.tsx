"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Dashboard, type GroupRow } from "@/lib/api";
import { money } from "@/lib/format";
import { ledgerHref, spendLink } from "@/lib/links";
import s from "./dashboard.module.scss";

const SHOWN = 7;

export default function WhereItWent({ data }: { data: Dashboard }) {
  const [rows, setRows] = useState<GroupRow[] | null>(null);

  useEffect(() => {
    api
      .group("category", data.period_start, data.period_end)
      .then((r) => setRows([...r].sort((a, b) => b.total - a.total)))
      .catch(() => setRows([]));
  }, [data.period_start, data.period_end]);

  const total = rows?.reduce((sum, r) => sum + r.total, 0) ?? 0;
  const top = rows?.slice(0, SHOWN) ?? [];
  const rest = rows?.slice(SHOWN) ?? [];
  const restTotal = rest.reduce((sum, r) => sum + r.total, 0);
  const max = top[0]?.total ?? 1;
  const period = spendLink(data.period_start, data.period_end);

  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Where it went</h2>
        <Link href={ledgerHref(period)}>{money(total)} across {rows?.length ?? 0} categories →</Link>
      </div>

      {rows === null ? (
        <div className={s.skeletonRows} aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className={s.empty}>No spending in this period yet.</p>
      ) : (
        <ol className={s.where}>
          {top.map((row) => {
            const uncategorised = row.key === "uncategorised";
            const href = ledgerHref({ ...period, ...(uncategorised ? { view: "uncategorised" } : { category: row.key }) });
            return (
              <li key={row.key}>
                <Link href={href} title={`${row.count} ${row.count === 1 ? "row" : "rows"} behind ${row.label}`}>
                  <span className={s.whereLabel}>{row.label}</span>
                  <span className={s.whereBar} aria-hidden="true">
                    <i style={{ width: `${(row.total / max) * 100}%` }} className={uncategorised ? s.whereNone : undefined} />
                  </span>
                  <span className={s.whereShare}>{total ? Math.round((row.total / total) * 100) : 0}%</span>
                  <span className={`${s.whereAmount} num`}>{money(row.total)}</span>
                </Link>
              </li>
            );
          })}
          {rest.length > 0 && (
            <li className={s.whereRest}>
              <span>
                {rest.length} more {rest.length === 1 ? "category" : "categories"}
              </span>
              <span className="num">{money(restTotal)}</span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
