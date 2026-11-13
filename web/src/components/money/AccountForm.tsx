"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { api, type Account } from "@/lib/api";
import { ACCOUNT_TYPE_LABEL, INVESTMENT_TYPES, SPENDING_TYPES, isInvestment } from "@/lib/flows";
import { parseRupees } from "@/lib/format";
import s from "./money.module.scss";

const HINTS: Record<string, string> = {
  fd: "Lump sum locked for a term. Add the rate and maturity date.",
  rd: "A fixed amount every month. Set the monthly amount so missed instalments show as due.",
  ppf: "15-year account; up to \u20b91.5 lakh a year. Set a monthly amount if you contribute regularly.",
  epf: "Comes out of salary before it reaches the bank. Record each contribution from the payslip.",
  nps: "Pension account. Update the value from the CRA statement now and then.",
  mutual_fund: "SIPs or lump sums. Set the SIP amount, and update the value from your app.",
  stocks: "Demat holdings. Record money moved in, and update the market value.",
  gold: "Physical, digital or sovereign gold bonds.",
  other_investment: "Anything else you are setting aside.",
};

type Props = { kind: "spending" | "investment"; onCreated: (account: Account) => void };

export default function AccountForm({ kind, onCreated }: Props) {
  const types = kind === "investment" ? INVESTMENT_TYPES : SPENDING_TYPES;
  const [type, setType] = useState<string>(types[0]);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [opening, setOpening] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("");
  const [maturity, setMaturity] = useState("");
  const [monthly, setMonthly] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const investment = isInvestment(type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the account a name");
    setBusy(true);
    try {
      const made = await api.createAccount({
        name: name.trim(),
        type,
        institution: institution.trim(),
        opening_balance: opening ? parseRupees(opening) ?? 0 : 0,
        description: description.trim(),
        interest_rate: investment && rate ? Number(rate) : null,
        maturity_date: investment && maturity ? maturity : null,
        monthly_amount: investment && monthly ? parseRupees(monthly) : null,
      });
      onCreated(made);
      setName("");
      setInstitution("");
      setOpening("");
      setDescription("");
      setRate("");
      setMaturity("");
      setMonthly("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <h2>{kind === "investment" ? "Add a savings or investment account" : "Add an account"}</h2>
      <div className={s.formGrid}>
        <div className={s.field}>
          <span>Type</span>
          <Select
            value={type}
            onChange={setType}
            aria-label="Account type"
            options={types.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }))}
          />
        </div>
        <label className={s.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={investment ? "SBI RD \u2014 car fund" : "HDFC Savings"} />
        </label>
        <label className={s.field}>
          <span>Bank or provider</span>
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="optional" />
        </label>
        <label className={s.field}>
          <span>{investment ? "Already in it (\u20b9)" : "Balance today (\u20b9)"}</span>
          <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        {investment && (
          <>
            <label className={s.field}>
              <span>Interest / return (% a year)</span>
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="e.g. 7.1" />
            </label>
            <label className={s.field}>
              <span>Matures on</span>
              <input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} />
            </label>
            <label className={s.field}>
              <span>Every period (₹)</span>
              <input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" placeholder="RD / SIP amount" />
            </label>
          </>
        )}
        <label className={`${s.field} ${s.wide}`}>
          <span>Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={investment ? "What is it for? e.g. down payment for a car in 2028" : "optional"}
          />
        </label>
      </div>
      {investment && HINTS[type] && <p className={s.hint}>{HINTS[type]}</p>}
      <div className={s.formFoot}>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Saving\u2026" : "Add account"}
        </Button>
        {error && <span className={s.error}>{error}</span>}
      </div>
    </form>
  );
}
