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
          {data.goals.slice(0, 3).map((goal) => {
            const pct = Math.min(goal.progress_pct, 100);
            return (
              <div key={goal.id} className={s.goal}>
                <svg className={s.goalRing} viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9155" className={s.goalTrack} />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    className={s.goalArc}
                    strokeDasharray={`${pct} ${100 - pct}`}
                    strokeDashoffset="25"
                  />
                  <text x="18" y="20.5" textAnchor="middle" className={s.goalPct}>
                    {Math.round(goal.progress_pct)}%
                  </text>
                </svg>
                <div className={s.goalText}>
                  <b>{goal.name}</b>
                  <span className="num">
                    {money(goal.contributed)} of {money(goal.target)}
                  </span>
                  {goal.projected_finish && (
                    <em>
                      finishes{" "}
                      {new Date(`${goal.projected_finish}T00:00:00`).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </em>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
