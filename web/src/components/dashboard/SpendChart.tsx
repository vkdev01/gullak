"use client";

import { money } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function SpendChart({ data }: { data: Dashboard }) {
  const points = data.sparkline;
  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.amount), 1);
  const width = 100;
  const height = 40;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coords = points.map((p, i) => `${(i * step).toFixed(2)},${(height - (p.amount / max) * (height - 4)).toFixed(2)}`);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Daily spend</h2>
        <span>{money(data.spent)} this period</span>
      </div>

      <svg className={s.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Daily spend">
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F6F5C" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1F6F5C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spendFill)" />
        <path d={line} fill="none" stroke="#1F6F5C" strokeWidth="0.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className={s.axis}>
        <span>{points[0].date.slice(5)}</span>
        <span>{points[Math.floor(points.length / 2)].date.slice(5)}</span>
        <span>{points[points.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}
