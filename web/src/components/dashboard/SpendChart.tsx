"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { money, shortDate, toISODate } from "@/lib/format";
import { ledgerHref, spendLink } from "@/lib/links";
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
  const router = useRouter();
  const points = data.sparkline;
  if (points.length === 0) return null;

  const dayHref = (date: string) => ledgerHref(spendLink(date, date));

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
            <g key={p.date} className={s.barHit} onClick={() => router.push(dayHref(p.date))}>
              <rect x={i} width={1} y={0} height={HEIGHT} className={s.barHitArea} />
              <rect x={i + 0.15} width={0.7} y={HEIGHT - h} height={h} className={clipped ? s.barClipped : s.barDay} />
              <title>{`${shortDate(p.date)} · ${money(p.amount)} — click for the rows`}</title>
            </g>
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
            <span key={p.date}>
              {i > 0 && " · "}
              <Link href={dayHref(p.date)} className="num">
                {shortDate(p.date)} {money(p.amount)}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
