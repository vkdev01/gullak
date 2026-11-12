"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function GoalsRail({ data }: { data: Dashboard }) {
  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Goals</h2>
        <Link href="/goals/">All goals →</Link>
      </div>

      {data.goals.length === 0 ? (
        <p className={s.empty}>
          No goals yet. A goal turns “I should save” into a number with a date.
        </p>
      ) : (
        <div className={s.goals}>
          {data.goals.slice(0, 3).map((goal) => (
            <div key={goal.id} className={s.goal}>
              <div className={s.goalTop}>
                <b>{goal.name}</b>
                <span>
                  {money(goal.contributed)} / {money(goal.target)}
                </span>
              </div>
              <div className={s.bar}>
                <i style={{ width: `${Math.min(goal.progress_pct, 100)}%` }} />
              </div>
              <div className={s.goalFoot}>
                {goal.progress_pct}%
                {goal.projected_finish
                  ? ` · finishes ${new Date(`${goal.projected_finish}T00:00:00`).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
