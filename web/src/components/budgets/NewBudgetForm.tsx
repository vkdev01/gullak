"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { api, type BudgetStatus, type BudgetSuggestion, type Category } from "@/lib/api";
import { money, parseRupees } from "@/lib/format";
import s from "./budgets.module.scss";

type Props = {
  categories: Category[];
  budgets: BudgetStatus[];
  averageFor: (categoryId: string | null) => BudgetSuggestion | null;
  onCreate: (input: { category_id: string | null; amount: number; rollover: boolean; fixed: boolean }) => Promise<void>;
  onCategoryCreated: (category: Category) => Promise<void> | void;
};

const NEW = "__new__";

export default function NewBudgetForm({ categories, budgets, averageFor, onCreate, onCategoryCreated }: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const budgeted = useMemo(() => new Set(budgets.map((b) => b.category_id)), [budgets]);
  const groups = useMemo(() => categories.filter((c) => !c.parent_id && c.kind === "expense"), [categories]);
  const average = categoryId && categoryId !== NEW ? averageFor(categoryId) : null;

  async function createCategory() {
    if (!newName.trim() || !newParent) return;
    setBusy(true);
    try {
      const made = await api.createCategory({ name: newName.trim(), parent_id: newParent });
      await onCategoryCreated(made);
      setCategoryId(made.id);
      setNewName("");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const paise = parseRupees(amount);
    if (!categoryId || categoryId === NEW) return setError("Pick a category");
    if (!paise) return setError("Enter an amount above zero");
    setBusy(true);
    try {
      await onCreate({ category_id: categoryId, amount: paise, rollover, fixed });
      setCategoryId("");
      setAmount("");
      setRollover(false);
      setFixed(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.formHead}>
        <h2>Add a category budget</h2>
        <p>
          Budget a whole group (all of Transport) or one category inside it (just Fuel). A group budget counts every
          category under it.
        </p>
      </div>

      <div className={s.formRow}>
        <label className={s.inline}>
          <span>Category</span>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setError(null);
            }}
          >
            <option value="">Choose…</option>
            {groups.map((group) => (
              <optgroup key={group.id} label={group.name}>
                <option value={group.id} disabled={budgeted.has(group.id)}>
                  All of {group.name}
                  {budgeted.has(group.id) ? " (budgeted)" : ""}
                </option>
                {categories
                  .filter((c) => c.parent_id === group.id)
                  .map((c) => (
                    <option key={c.id} value={c.id} disabled={budgeted.has(c.id)}>
                      {c.name}
                      {budgeted.has(c.id) ? " (budgeted)" : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
            <option value={NEW}>+ New category…</option>
          </select>
        </label>

        <label className={s.inline}>
          <span>Per period (₹)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="4,000" />
        </label>

        <label className={s.check}>
          <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
          Carry unspent forward
        </label>

        <label className={s.check}>
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
          Fixed bill
        </label>

        <Button type="submit" disabled={busy || !categoryId || categoryId === NEW}>
          {busy ? "Saving…" : "Add budget"}
        </Button>
      </div>

      {average && (
        <p className={s.hint}>
          You spent about <b className="num">{money(average.average)}</b> a period here over the last{" "}
          {average.periods === 1 ? "period" : `${average.periods} periods`}.{" "}
          <button type="button" className={s.link} onClick={() => setAmount(String(Math.ceil(average.average / 100)))}>
            Use it
          </button>
        </p>
      )}

      {categoryId === NEW && (
        <div className={s.newCategory}>
          <label className={s.inline}>
            <span>New category</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bike EMI" autoFocus />
          </label>
          <label className={s.inline}>
            <span>Under</span>
            <select value={newParent} onChange={(e) => setNewParent(e.target.value)}>
              <option value="">Choose a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="ghost" onClick={() => void createCategory()} disabled={busy || !newName.trim() || !newParent}>
            Create category
          </Button>
        </div>
      )}

      <p className={s.hint}>
        <b>Fixed bill</b> (rent, EMIs, school fees): paid once a period, so it shows due, paid or over instead of a pace.{" "}
        <b>Carry unspent forward:</b> money left at the end of a period is added to the next one; overspending is taken
        out of it.
      </p>

      {error && <p className={s.error}>{error}</p>}
    </form>
  );
}
