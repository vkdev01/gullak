"use client";

import { useState } from "react";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

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
        return (
          <div key={id} className={`${s.insight} ${insight.severity === "warn" ? s.warn : ""}`}>
            <div className={s.insightTitle}>{insight.title}</div>
            <button type="button" className={s.insightBtn} onClick={() => setOpen(open === id ? null : id)}>
              {open === id ? "hide" : "how this was calculated"}
            </button>
            {open === id && <pre className={s.facts}>{JSON.stringify(insight.fact_pack, null, 2)}</pre>}
          </div>
        );
      })}
    </div>
  );
}
