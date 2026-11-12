"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import type { Account } from "@/lib/api";
import s from "./import.module.scss";

type Props = {
  accounts: Account[];
  busy: boolean;
  onPreview: (accountId: string, csv: string, filename: string) => void;
};

const SAMPLE = `Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/11/2026,UPI/SWIGGY/4412/BANGALORE,412.00,,125000.00
02/11/2026,POS 4412 APOLLO PHARMACY,330.50,,124669.50
03/11/2026,UPI/BLINKIT/9981/GURGAON,1240.00,,123429.50
04/11/2026,NEFT CR ACME SOLUTIONS SALARY,,142000.00,265429.50
05/11/2026,UPI/UBER/7712/MUMBAI,268.00,,265161.50
06/11/2026,ACH DR NETFLIX,649.00,,264512.50
07/11/2026,IMPS/RAMESH KUMAR/9931,5000.00,,259512.50
08/11/2026,UPI/THIRD WAVE COFFEE/2210,320.00,,259192.50`;

export default function StatementForm({ accounts, busy, onPreview }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("statement.csv");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File) {
    setFilename(file.name);
    setCsv(await file.text());
  }

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>1 · Choose the file</h2>
        <span>CSV · nothing is imported yet</span>
      </div>

      <div className={s.row}>
        <div className={s.field}>
          <label htmlFor="import-account">Account</label>
          <select id="import-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className={s.field}>
          <label htmlFor="import-file">Statement file</label>
          <input
            id="import-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickFile(file);
            }}
          />
        </div>

        <Button onClick={() => onPreview(accountId, csv, filename)} disabled={!csv.trim() || busy || !accountId}>
          {busy ? "Reading…" : "Preview import"}
        </Button>
      </div>

      <div className={s.paste}>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setFilename("pasted.csv");
          }}
          placeholder="…or paste the CSV here"
          spellCheck={false}
          aria-label="Statement CSV"
        />
      </div>

      <p className={s.hint}>
        HDFC, ICICI, SBI, Axis and Kotak column layouts are detected automatically; anything else can be mapped by
        header name.{" "}
        <button type="button" className={s.hint} style={{ textDecoration: "underline" }} onClick={() => setCsv(SAMPLE)}>
          Load a sample
        </button>
      </p>
    </div>
  );
}
