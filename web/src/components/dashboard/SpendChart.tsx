"use client";

import { money, shortDate, toISODate } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

const HEIGHT = 40;

/** Scale to the typical day, so one rent payment does not flatten the month. */
function scaleFor(amounts: number[]): number {
  const sorted = amounts.filter((a) => a > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  const max = sorted[sorted.length - 1];
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  return Math.max(Math.min(max, p90 * 2), 1);
}

export default function SpendChart({ data }: { data: Dashboard }) {
  const points = data.sparkline;
  if (points.length === 0) return null;

  const today = toISODate(new Date());
  const past = points.filter((p) => p.date <= today);
  const scale = scaleFor(past.map((p) => p.amount));
  const offScale = past.filter((p) => p.amount > scale);

  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Daily spend</h2>
        <span className="num">{money(data.spent)} this period</span>
      </div>

      <svg
        className={s.chart}
        viewBox={`0 0 ${points.length} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily spend, ${money(data.spent)} so far`}
      >
        <line x1="0" x2={points.length} y1={HEIGHT} y2={HEIGHT} className={s.chartBase} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          if (p.date > today || p.amount === 0) return null;
          const clipped = p.amount > scale;
          const h = clipped ? HEIGHT : Math.max((p.amount / scale) * (HEIGHT - 2), 0.6);
          return (
            <rect key={p.date} x={i + 0.15} width={0.7} y={HEIGHT - h} height={h} className={clipped ? s.barClipped : s.barDay}>
              <title>{`${shortDate(p.date)} · ${money(p.amount)}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className={s.axis}>
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points[Math.floor(points.length / 2)].date)}</span>
        <span>{shortDate(points[points.length - 1].date)}</span>
      </div>

      {offScale.length > 0 && (
        <p className={s.chartNote}>
          Off the scale:{" "}
          {offScale.map((p, i) => (
            <span key={p.date} className="num">
              {i > 0 && " · "}
              {shortDate(p.date)} {money(p.amount)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
