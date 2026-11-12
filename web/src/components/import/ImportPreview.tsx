"use client";

import Button from "@/components/ui/Button";
import { money, shortDate } from "@/lib/format";
import type { Category, ImportPreview as Preview } from "@/lib/api";
import s from "./import.module.scss";

type Props = {
  preview: Preview;
  categories: Category[];
  willImport: number;
  busy: boolean;
  onCategory: (rowId: string, categoryId: string) => void;
  onSkip: (rowId: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  ready: "ready",
  review: "needs a look",
  duplicate: "already imported",
  imported: "imported",
  skipped: "skipped",
};

export default function ImportPreview({
  preview,
  categories,
  willImport,
  busy,
  onCategory,
  onSkip,
  onCommit,
  onCancel,
}: Props) {
  const { batch, rows } = preview;
  const ready = rows.filter((r) => r.status === "ready").length;
  const review = rows.filter((r) => r.status === "review").length;

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>2 · Check what will land</h2>
        <span>{batch.filename}</span>
      </div>

      <div className={s.chips}>
        <span className={`${s.chip} ${s.ok}`}>{ready} ready</span>
        <span className={`${s.chip} ${s.warn}`}>{review} need review</span>
        <span className={`${s.chip} ${s.muted}`}>{batch.duplicate_count} already in the ledger</span>
        <span className={s.chip}>{rows.length} rows read</span>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Description</th>
              <th>Merchant</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.is_duplicate ? s.duplicate : undefined}>
                <td className={s.amount}>{row.line_no}</td>
                <td>{shortDate(row.occurred_at)}</td>
                <td>
                  <div className={s.desc} title={row.description}>
                    {row.description}
                  </div>
                </td>
                <td>{row.merchant}</td>
                <td>
                  <select
                    className={s.catSelect}
                    value={row.category_id ?? ""}
                    onChange={(e) => onCategory(row.id, e.target.value)}
                    disabled={row.is_duplicate}
                    aria-label={`Category for ${row.merchant}`}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={s.amount}>
                  {row.direction === "credit" ? "+" : "−"}
                  {money(row.amount)}
                </td>
                <td>
                  <span className={`${s.chip} ${row.status === "ready" ? s.ok : row.status === "review" ? s.warn : s.muted}`}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
                <td>
                  {!row.is_duplicate && (
                    <button type="button" className="small muted" onClick={() => onSkip(row.id)}>
                      skip
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {batch.warnings.length > 0 && (
        <ul className={s.warnings}>
          {batch.warnings.slice(0, 5).map((w) => (
            <li key={w}>{w}</li>
          ))}
          {batch.warnings.length > 5 && <li>…and {batch.warnings.length - 5} more</li>}
        </ul>
      )}

      <div className={s.foot}>
        <span className="small muted">
          {willImport} of {rows.length} rows will be added to the ledger
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onCommit} disabled={busy || willImport === 0}>
            {busy ? "Importing…" : `Import ${willImport} rows`}
          </Button>
        </span>
      </div>
    </div>
  );
}
