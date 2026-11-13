"use client";

import { useEffect, useState } from "react";
import { api, type Category, type TransactionDetail } from "@/lib/api";
import { money, parseRupees } from "@/lib/format";
import { normaliseTags } from "@/lib/tags";
import Button from "@/components/ui/Button";
import CategoryPicker from "@/components/ui/CategoryPicker";
import Select from "@/components/ui/Select";
import s from "./ledger.module.scss";

type Props = {
  id: string;
  categories: Category[];
  onClose: () => void;
  onRecategorise: (id: string, categoryId: string) => void;
  onReviewed: (id: string) => void;
  onChanged: () => void;
  onDeleted: (deleted: number) => void;
};

const SOURCE_LABEL: Record<string, string> = {
  import: "imported from a statement",
  seed: "demo data",
  manual: "added by hand",
  rule: "categorised by a rule",
};

export default function TransactionDrawer({
  id,
  categories,
  onClose,
  onRecategorise,
  onReviewed,
  onChanged,
  onDeleted,
}: Props) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function load(row: TransactionDetail) {
    setDetail(row);
    setNote(row.note ?? "");
    setTagText((row.tags ?? []).join(" "));
    setMerchant(row.merchant);
    setAmount(String(row.amount / 100));
    setDate(row.occurred_at);
    setDirection(row.direction);
  }

  useEffect(() => {
    let live = true;
    api
      .transaction(id)
      .then((row) => live && load(row))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [id]);

  const tags = normaliseTags(tagText);
  const paise = parseRupees(amount);
  const locked = !!detail?.transfer_id; // one half of a transfer: amount, date and direction stay in step with the other
  const dirty =
    !!detail &&
    (note.trim() !== (detail.note ?? "") ||
      tags.join(" ") !== (detail.tags ?? []).join(" ") ||
      merchant.trim() !== detail.merchant ||
      (!locked && (paise !== detail.amount || date !== detail.occurred_at || direction !== detail.direction)));

  async function save() {
    if (!detail) return;
    if (!merchant.trim()) return setError("A name is needed, e.g. Swiggy or Rent");
    if (!locked && !paise) return setError("Enter an amount above zero");
    setBusy(true);
    try {
      const updated = await api.updateTransaction(detail.id, {
        note: note.trim(),
        tags,
        merchant: merchant.trim(),
        ...(locked ? {} : { amount: paise ?? undefined, occurred_at: date, direction }),
      });
      load({
        ...detail,
        note: updated.note,
        tags: updated.tags ?? [],
        merchant: updated.merchant,
        amount: updated.amount,
        occurred_at: updated.occurred_at,
        direction: updated.direction,
      });
      setSaved(true);
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setBusy(true);
    try {
      const { deleted } = await api.deleteTransaction(detail.id);
      onDeleted(deleted);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setConfirming(false);
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

              <div className={s.fieldWide}>
                <dt>
                  <label htmlFor="tx-merchant">Name</label>
                </dt>
                <dd>
                  <input
                    id="tx-merchant"
                    className={s.fieldSelect}
                    value={merchant}
                    maxLength={160}
                    onChange={(e) => {
                      setMerchant(e.target.value);
                      setSaved(false);
                    }}
                  />
                </dd>
              </div>

              <div>
                <dt>
                  <label htmlFor="tx-amount">Amount (₹)</label>
                </dt>
                <dd>
                  <input
                    id="tx-amount"
                    className={s.fieldSelect}
                    value={amount}
                    inputMode="decimal"
                    disabled={locked}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setSaved(false);
                    }}
                  />
                </dd>
              </div>

              <div>
                <dt>
                  <label htmlFor="tx-date">Date</label>
                </dt>
                <dd>
                  <input
                    id="tx-date"
                    type="date"
                    className={s.fieldSelect}
                    value={date}
                    disabled={locked}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSaved(false);
                    }}
                  />
                </dd>
              </div>

              <div>
                <dt>Direction</dt>
                <dd>
                  <Select
                    size="sm"
                    value={direction}
                    disabled={locked}
                    aria-label="Money in or out"
                    onChange={(v) => {
                      setDirection(v as "debit" | "credit");
                      setSaved(false);
                    }}
                    options={[
                      { value: "debit", label: "Money out" },
                      { value: "credit", label: "Money in" },
                    ]}
                  />
                </dd>
              </div>

              {locked && (
                <p className={`${s.drawerHint} ${s.fieldWide}`}>
                  This is one half of a transfer, so its amount, date and direction are fixed. Delete it to remove both halves.
                </p>
              )}

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
                  <Button size="sm" onClick={() => void save()} disabled={busy || !dirty}>
                    {busy ? "Saving…" : "Save changes"}
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

            <div className={s.danger}>
              {confirming ? (
                <>
                  <p>
                    Delete {incoming ? "+" : "−"}
                    {money(detail.amount)} · {detail.merchant}?{" "}
                    {detail.transfer_id
                      ? "Both halves of the transfer are removed."
                      : "Your balance and every total change back, and this cannot be undone."}
                  </p>
                  <div>
                    <Button size="sm" onClick={() => void remove()} disabled={busy}>
                      {busy ? "Deleting…" : "Yes, delete it"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      Keep it
                    </Button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={() => setConfirming(true)}>
                  Delete this entry
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
