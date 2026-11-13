"use client";

import { monthLabelFromKey, shortDate } from "@/lib/format";
import type { DateRange } from "@/hooks/useLedger";
import s from "./ledger.module.scss";

type Props = {
  month: string;
  allTime: boolean;
  range: DateRange | null;
  isCurrentMonth: boolean;
  onStep: (delta: number) => void;
  onThisMonth: () => void;
  onToggleAllTime: () => void;
  onClearRange: () => void;
};

function rangeLabel(range: DateRange) {
  return range.start === range.end ? shortDate(range.start) : `${shortDate(range.start)} – ${shortDate(range.end)}`;
}

export default function PeriodNav({
  month,
  allTime,
  range,
  isCurrentMonth,
  onStep,
  onThisMonth,
  onToggleAllTime,
  onClearRange,
}: Props) {
  return (
    <div className={s.periodNav}>
      <div className={s.stepper}>
        <button type="button" onClick={() => onStep(-1)} aria-label="Previous month" className={s.stepBtn}>
          ‹
        </button>
        <span className={s.stepLabel}>
          {range ? rangeLabel(range) : allTime ? "All time" : monthLabelFromKey(month)}
        </span>
        <button
          type="button"
          onClick={() => onStep(1)}
          aria-label="Next month"
          className={s.stepBtn}
          disabled={isCurrentMonth}
        >
          ›
        </button>
      </div>

      {range && (
        <button type="button" className={`${s.jump} ${s.jumpOn}`} onClick={onClearRange} aria-label="Clear date range">
          Linked dates ×
        </button>
      )}

      {!isCurrentMonth && !allTime && !range && (
        <button type="button" className={s.jump} onClick={onThisMonth}>
          This month
        </button>
      )}

      <button type="button" className={`${s.jump} ${allTime ? s.jumpOn : ""}`} onClick={onToggleAllTime}>
        All time
      </button>
    </div>
  );
}
