"use client";

import s from "./ledger.module.scss";

type Props = {
  page: number; // zero-based
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
};

/** Page numbers with ellipsis, so 40 pages never becomes 40 buttons. */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  const current = page + 1;
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>([1, pageCount, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, pageCount, pageSize, total, onPage }: Props) {
  if (total === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className={s.pagination}>
      <span className={s.pageInfo}>
        {from}–{to} of {total}
      </span>

      <div className={s.pages}>
        <button type="button" className={s.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>
          Prev
        </button>

        {pageWindow(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className={s.gap}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${s.pageBtn} ${p === page + 1 ? s.pageOn : ""}`}
              onClick={() => onPage(p - 1)}
              aria-current={p === page + 1 ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className={s.pageBtn}
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
