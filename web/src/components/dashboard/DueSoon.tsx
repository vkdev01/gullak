"use client";

import { money } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function DueSoon({ data }: { data: Dashboard }) {
  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Due this period</h2>
        <span>{data.committed ? `${money(data.committed)} committed` : ""}</span>
      </div>

      {data.due_soon.length === 0 ? (
        <p className={s.empty}>No recurring charges detected in this period.</p>
      ) : (
        <div className={s.due}>
          {data.due_soon.map((item) => (
            <div key={`${item.merchant}-${item.due}`} className={s.dueRow}>
              <span>
                {item.merchant} <em>· {item.cadence}</em>
              </span>
              <span>
                <b>{money(item.amount)}</b> <em>{item.due.slice(5)}</em>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
