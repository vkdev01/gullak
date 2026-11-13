"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import RemoveAccount from "./RemoveAccount";
import { api, type Account } from "@/lib/api";
import { ACCOUNT_TYPE_LABEL } from "@/lib/flows";
import { money, parseRupees, shortDate, todayISO } from "@/lib/format";
import { ledgerHref } from "@/lib/links";
import s from "./money.module.scss";

type Action = "add" | "contribute" | "withdraw" | "value" | "edit" | null;

type Props = { account: Account; spendingAccounts: Account[]; onChanged: () => void };

function maturityText(iso: string): string {
  const days = Math.round((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `matured ${shortDate(iso)}`;
  if (days < 60) return `matures in ${days} days`;
  return `matures ${new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
}

export default function SavingsCard({ account, spendingAccounts, onChanged }: Props) {
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [other, setOther] = useState(spendingAccounts[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [details, setDetails] = useState({
    description: account.description ?? "",
    rate: account.interest_rate?.toString() ?? "",
    maturity: account.maturity_date ?? "",
    monthly: account.monthly_amount ? String(account.monthly_amount / 100) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const monthly = account.monthly_amount ?? 0;
  const paid = account.contributed_this_period ?? 0;
  const value = account.value ?? account.balance;

  function open(next: Action) {
    setAction(action === next ? null : next);
    setAmount("");
    setNote("");
    setError(null);
  }

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      setAction(null);
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (action === "edit") {
      return run(() =>
        api.updateAccount(account.id, {
          description: details.description.trim(),
          interest_rate: details.rate ? Number(details.rate) : null,
          maturity_date: details.maturity || null,
          monthly_amount: details.monthly ? parseRupees(details.monthly) : null,
        }),
      );
    }
    const paise = parseRupees(amount);
    if (!paise) return setError("Enter an amount above zero");
    if (action === "value") return run(() => api.updateAccount(account.id, { current_value: paise }));
    if (action === "contribute") {
      return run(() =>
        api.createTransaction({
          account_id: account.id,
          amount: paise,
          direction: "credit",
          occurred_at: date,
          merchant: `${ACCOUNT_TYPE_LABEL[account.type] ?? "Savings"} contribution`,
          note,
        }),
      );
    }
    if (!other) return setError("Pick the account the money comes from or goes to");
    const [from, to] = action === "add" ? [other, account.id] : [account.id, other];
    return run(() => api.transfer({ from_account_id: from, to_account_id: to, amount: paise, occurred_at: date, note }));
  }

  return (
    <article className={s.saving}>
      <header className={s.savingHead}>
        <div>
          <b>{account.name}</b>
          <span>
            {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
            {account.institution ? ` \u00b7 ${account.institution}` : ""}
            {account.interest_rate != null ? ` \u00b7 ${account.interest_rate}% a year` : ""}
            {account.maturity_date ? ` \u00b7 ${maturityText(account.maturity_date)}` : ""}
          </span>
        </div>
        <div className={s.savingValue}>
          <b className="num">{money(value)}</b>
          {account.gain != null ? (
            <span className={account.gain >= 0 ? s.up : s.down}>
              {account.gain >= 0 ? "+" : ""}
              {money(account.gain)} on {money(account.balance)} put in
            </span>
          ) : (
            <span>put in, net of withdrawals</span>
          )}
        </div>
      </header>

      {account.description && <p className={s.savingNote}>{account.description}</p>}

      {monthly > 0 && (
        <div className={s.instalment}>
          <div className={s.track}>
            <i style={{ width: `${Math.min((paid / monthly) * 100, 100)}%` }} />
          </div>
          <span>
            {money(paid)} of {money(monthly)} this period
            {paid < monthly ? ` \u00b7 ${money(monthly - paid)} still due` : " \u00b7 done"}
          </span>
        </div>
      )}

      {account.value_as_of && <p className={s.asOf}>Value updated {shortDate(account.value_as_of)}</p>}

      <div className={s.savingActions}>
        <button type="button" onClick={() => open("add")} aria-expanded={action === "add"}>
          Add money
        </button>
        <button type="button" onClick={() => open("contribute")} aria-expanded={action === "contribute"}>
          Record contribution
        </button>
        <button type="button" onClick={() => open("withdraw")} aria-expanded={action === "withdraw"}>
          Withdraw
        </button>
        <button type="button" onClick={() => open("value")} aria-expanded={action === "value"}>
          Update value
        </button>
        <button type="button" onClick={() => open("edit")} aria-expanded={action === "edit"}>
          Details
        </button>
        <Link href={ledgerHref({ account: account.id, when: "all" })}>Rows</Link>
      </div>
      <div className={s.savingRemove}>
        <RemoveAccount account={account} onDone={onChanged} />
      </div>

      {action && (
        <div className={s.actionPanel}>
          {action === "edit" ? (
            <>
              <label className={s.field}>
                <span>Interest / return (% a year)</span>
                <input value={details.rate} onChange={(e) => setDetails({ ...details, rate: e.target.value })} inputMode="decimal" />
              </label>
              <label className={s.field}>
                <span>Matures on</span>
                <input type="date" value={details.maturity} onChange={(e) => setDetails({ ...details, maturity: e.target.value })} />
              </label>
              <label className={s.field}>
                <span>Every period (₹)</span>
                <input value={details.monthly} onChange={(e) => setDetails({ ...details, monthly: e.target.value })} inputMode="decimal" />
              </label>
              <label className={`${s.field} ${s.wide}`}>
                <span>Description</span>
                <input value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className={s.field}>
                <span>{action === "value" ? "Worth today (₹)" : "Amount (₹)"}</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
              </label>
              {(action === "add" || action === "withdraw") && (
                <div className={s.field}>
                  <span>{action === "add" ? "From" : "Into"}</span>
                  <Select
                    size="sm"
                    value={other}
                    onChange={setOther}
                    aria-label={action === "add" ? "Take the money from" : "Put the money into"}
                    placeholder="Add a bank account first"
                    options={spendingAccounts.map((a) => ({ value: a.id, label: a.name }))}
                  />
                </div>
              )}
              {action !== "value" && (
                <>
                  <label className={s.field}>
                    <span>On</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                  <label className={`${s.field} ${s.wide}`}>
                    <span>Note</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={action === "contribute" ? "e.g. Oct payslip: employee + employer share" : "optional"}
                    />
                  </label>
                </>
              )}
            </>
          )}
          <p className={s.actionHelp}>
            {action === "add" && "Moves money from your bank: counted as saved, never as spending."}
            {action === "contribute" && "Money that never passed through your bank, like EPF from salary."}
            {action === "withdraw" && "Moves money back to your bank: not income, just your own money returning."}
            {action === "value" && "Market value for funds, stocks, NPS or gold. The gain is the value minus what you put in."}
            {action === "edit" && "Terms and purpose. The monthly amount drives \u201csavings still due\u201d on the dashboard."}
          </p>
          <div className={s.formFoot}>
            <Button size="sm" onClick={() => void submit()} disabled={busy}>
              {busy ? "Saving\u2026" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            {error && <span className={s.error}>{error}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
