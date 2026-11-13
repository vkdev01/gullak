"use client";

import Link from "next/link";
import { addDays, money, shortDate, todayISO } from "@/lib/format";
import { ledgerHref } from "@/lib/links";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function DueSoon({ data }: { data: Dashboard }) {
  const yearAgo = addDays(todayISO(), -365);

  return (
    <div className={s.card} id="due">
      <div className={s.head}>
        <h2>Due this period</h2>
        <span>{data.committed ? `${money(data.committed)} committed` : ""}</span>
      </div>

      {data.due_soon.length === 0 ? (
        <p className={s.empty}>No recurring charges detected in this period.</p>
      ) : (
        <div className={s.due}>
          {data.due_soon.map((item) => (
            <Link
              key={`${item.merchant}-${item.due}`}
              href={ledgerHref({ q: item.merchant, from: yearAgo, to: todayISO() })}
              className={s.dueRow}
              title={`Past ${item.merchant} charges`}
            >
              <span>
                {item.merchant} <em>· {item.cadence}</em>
              </span>
              <span>
                <b>{money(item.amount)}</b> <em>{shortDate(item.due)}</em>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
