"use client";

import { useEffect, useState } from "react";
import { api, type Category, type TransactionDetail } from "@/lib/api";
import { money } from "@/lib/format";
import { normaliseTags } from "@/lib/tags";
import Button from "@/components/ui/Button";
import CategoryPicker from "@/components/ui/CategoryPicker";
import s from "./ledger.module.scss";

type Props = {
  id: string;
  categories: Category[];
  onClose: () => void;
  onRecategorise: (id: string, categoryId: string) => void;
  onReviewed: (id: string) => void;
  onChanged: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  import: "imported from a statement",
  seed: "demo data",
  manual: "added by hand",
  rule: "categorised by a rule",
};

export default function TransactionDrawer({ id, categories, onClose, onRecategorise, onReviewed, onChanged }: Props) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .transaction(id)
      .then((row) => {
        if (!live) return;
        setDetail(row);
        setNote(row.note ?? "");
        setTagText((row.tags ?? []).join(" "));
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [id]);

  const tags = normaliseTags(tagText);
  const dirty = !!detail && (note.trim() !== (detail.note ?? "") || tags.join(" ") !== (detail.tags ?? []).join(" "));

  async function saveContext() {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await api.updateTransaction(detail.id, { note: note.trim(), tags });
      setDetail({ ...detail, note: updated.note, tags: updated.tags ?? [] });
      setTagText((updated.tags ?? []).join(" "));
      setSaved(true);
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // an open picker handles (and prevents) its own Escape
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const incoming = detail?.direction === "credit";

  async function markReviewed() {
    if (!detail) return;
    setBusy(true);
    try {
      await api.bulkCategorise([detail.id], detail.category_id ?? "");
      onReviewed(detail.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />

      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label="Transaction details">
        <div className={s.drawerHead}>
          <span className={s.drawerKicker}>Transaction</span>
          <button type="button" className={s.drawerClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <p className={s.drawerError}>{error}</p>}

        {!detail && !error && <p className="small muted">Loading…</p>}

        {detail && (
          <>
            <div className={s.drawerTop}>
              <div className={`${s.drawerTile} ${detail.category_name ? s.cGreen : s.cNone}`} aria-hidden="true">
                {detail.merchant.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2 className={s.drawerMerchant}>{detail.merchant}</h2>
                <span className={s.drawerDate}>
                  {new Date(`${detail.occurred_at}T00:00:00`).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className={`${s.drawerAmount} ${incoming ? s.incoming : ""}`}>
              {incoming ? "+" : "−"}
              {money(detail.amount)}
            </div>

            <div className={s.drawerChips}>
              <span className={s.drawerChip}>{SOURCE_LABEL[detail.source] ?? detail.source}</span>
              {detail.confidence > 0 && (
                <span className={s.drawerChip}>{Math.round(detail.confidence * 100)}% confident</span>
              )}
              {detail.needs_review && <span className={`${s.drawerChip} ${s.drawerChipWarn}`}>needs review</span>}
              {detail.transfer_id && <span className={s.drawerChip}>transfer</span>}
            </div>

            <dl className={s.fields}>
              <div>
                <dt>Category</dt>
                <dd>
                  <CategoryPicker
                    categories={categories}
                    value={detail.category_id ?? ""}
                    emptyLabel="Uncategorised"
                    size="sm"
                    aria-label="Category"
                    onChange={(id) => {
                      onRecategorise(detail.id, id);
                      setDetail({ ...detail, category_id: id || null });
                    }}
                  />
                </dd>
              </div>

              <div>
                <dt>Parent</dt>
                <dd>{detail.category_parent ?? "—"}</dd>
              </div>

              <div>
                <dt>Account</dt>
                <dd>{detail.account_name ?? "—"}</dd>
              </div>

              <div>
                <dt>Direction</dt>
                <dd>{incoming ? "Money in" : "Money out"}</dd>
              </div>

              <div className={s.fieldWide}>
                <dt>
                  <label htmlFor="tx-note">Description</label>
                </dt>
                <dd>
                  <textarea
                    id="tx-note"
                    className={s.noteInput}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="What was this for? e.g. full tank before the Goa drive"
                    rows={2}
                    maxLength={2000}
                  />
                </dd>
              </div>

              <div className={s.fieldWide}>
                <dt>
                  <label htmlFor="tx-tags">Tags</label>
                </dt>
                <dd>
                  <input
                    id="tx-tags"
                    className={s.fieldSelect}
                    value={tagText}
                    onChange={(e) => {
                      setTagText(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="car trip family — separate with spaces"
                  />
                  {tags.length > 0 && (
                    <span className={s.tagPreview}>
                      {tags.map((t) => (
                        <i key={t}>#{t}</i>
                      ))}
                    </span>
                  )}
                </dd>
              </div>

              <div className={s.fieldWide}>
                <div className={s.saveRow}>
                  <Button size="sm" onClick={() => void saveContext()} disabled={busy || !dirty}>
                    {busy ? "Saving…" : "Save description & tags"}
                  </Button>
                  {saved && !dirty && <span className={s.savedNote}>Saved</span>}
                </div>
              </div>

              {detail.import_filename && (
                <div className={s.fieldWide}>
                  <dt>Came from</dt>
                  <dd className={s.mono}>{detail.import_filename}</dd>
                </div>
              )}

              {detail.dedupe_hash && (
                <div className={s.fieldWide}>
                  <dt>Dedupe key</dt>
                  <dd className={s.mono}>{detail.dedupe_hash}</dd>
                </div>
              )}

              {detail.transfer_id && (
                <div className={s.fieldWide}>
                  <dt>Transfer</dt>
                  <dd className={s.mono}>{detail.transfer_id} · excluded from spend</dd>
                </div>
              )}

              {detail.created_at && (
                <div className={s.fieldWide}>
                  <dt>Added</dt>
                  <dd className={s.mono}>{detail.created_at.replace("T", " ").slice(0, 16)}</dd>
                </div>
              )}
            </dl>

            {detail.needs_review && !detail.category_id && (
              <p className={s.drawerHint}>Give this row a category and it leaves the review queue.</p>
            )}

            <div className={s.drawerFoot}>
              {detail.needs_review && (
                <Button size="sm" onClick={markReviewed} disabled={busy || !detail.category_id}>
                  Mark as reviewed
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
