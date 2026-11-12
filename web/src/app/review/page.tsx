"use client";

import { useCategories } from "@/hooks/useCategories";
import { useReview } from "@/hooks/useReview";
import ReviewQueue from "@/components/review/ReviewQueue";
import s from "./page.module.scss";

export default function ReviewPage() {
  const { leaves } = useCategories();
  const review = useReview();

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Review queue</h1>
        <p>
          Rows the importer could not categorise with confidence. Assign one category to many at once, or fix them
          one by one — every assignment clears the row from the queue.
        </p>
      </header>

      {review.error && <p className={s.error}>{review.error}</p>}

      {review.loading ? (
        <p className="small muted">Loading…</p>
      ) : (
        <ReviewQueue
          rows={review.rows}
          categories={leaves}
          selected={review.selected}
          busy={review.busy}
          onToggle={review.toggle}
          onToggleAll={review.toggleAll}
          onAssign={review.assign}
        />
      )}
    </main>
  );
}
