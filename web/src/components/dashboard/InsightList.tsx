"use client";

import { useState } from "react";
import Link from "next/link";
import { ledgerHref, spendLink } from "@/lib/links";
import type { Dashboard, Insight } from "@/lib/api";
import s from "./dashboard.module.scss";

function rowsFor(insight: Insight, data: Dashboard): string | null {
  const facts = insight.fact_pack as { category_id?: string; merchant?: string };
  const period = spendLink(data.period_start, data.period_end);
  if (insight.kind === "month_delta" && facts.category_id) {
    return facts.category_id === "none" || facts.category_id === "uncategorised"
      ? ledgerHref({ ...period, view: "uncategorised" })
      : ledgerHref({ ...period, category: facts.category_id });
  }
  if (facts.merchant) return ledgerHref({ ...period, q: facts.merchant });
  return null;
}

export default function InsightList({ data }: { data: Dashboard }) {
  const [open, setOpen] = useState<string | null>(null);

  if (data.insights.length === 0) {
    return (
      <div className={s.card}>
        <div className={s.head}>
          <h2>What moved</h2>
        </div>
        <p className={s.empty}>
          Nothing worth flagging yet. Insights appear once there is a month of history to compare against.
        </p>
      </div>
    );
  }

  return (
    <div className={s.insights}>
      {data.insights.slice(0, 3).map((insight, i) => {
        const id = `${insight.kind}-${i}`;
        const href = rowsFor(insight, data);
        return (
          <div key={id} className={`${s.insight} ${insight.severity === "warn" ? s.warn : ""}`}>
            <div className={s.insightTitle}>{insight.title}</div>
            <div className={s.insightActions}>
              {href && (
                <Link href={href} className={s.insightBtn}>
                  show the rows
                </Link>
              )}
              <button type="button" className={s.insightBtn} onClick={() => setOpen(open === id ? null : id)}>
                {open === id ? "hide" : "how this was calculated"}
              </button>
            </div>
            {open === id && <pre className={s.facts}>{JSON.stringify(insight.fact_pack, null, 2)}</pre>}
          </div>
        );
      })}
    </div>
  );
}
