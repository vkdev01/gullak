"use client";

import { monthLabelFromKey } from "@/lib/format";
import s from "./ledger.module.scss";

type Props = {
  month: string;
  allTime: boolean;
  isCurrentMonth: boolean;
  onStep: (delta: number) => void;
  onThisMonth: () => void;
  onToggleAllTime: () => void;
};

export default function PeriodNav({ month, allTime, isCurrentMonth, onStep, onThisMonth, onToggleAllTime }: Props) {
  return (
    <div className={s.periodNav}>
      <div className={s.stepper}>
        <button type="button" onClick={() => onStep(-1)} aria-label="Previous month" className={s.stepBtn}>
          ‹
        </button>
        <span className={s.stepLabel}>{allTime ? "All time" : monthLabelFromKey(month)}</span>
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

      {!isCurrentMonth && !allTime && (
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
