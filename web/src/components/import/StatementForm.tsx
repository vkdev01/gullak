"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
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
  const [chosenAccount, setAccountId] = useState("");
  // Accounts arrive after mount, so default to the first one rather than freezing an empty choice.
  const accountId = chosenAccount || accounts[0]?.id || "";
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function pickFile(file: File) {
    setFilename(file.name);
    setCsv(await file.text());
    setPasting(false);
  }

  const rows = csv.trim() ? csv.trim().split(/\r?\n/).length - 1 : 0;

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>1 · Choose the statement</h2>
        <span>CSV only for now</span>
      </div>

      <div className={s.row}>
        <div className={s.field}>
          <span className={s.fieldLabel}>Account</span>
          <Select
            value={accountId}
            onChange={setAccountId}
            aria-label="Account the statement belongs to"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Add an account first"
          />
        </div>

        <Button
          onClick={() => onPreview(accountId, csv, filename || "pasted.csv")}
          disabled={!csv.trim() || busy || !accountId}
        >
          {busy ? "Reading…" : "Preview import"}
        </Button>
      </div>

      <label
        className={`${s.drop} ${dragging ? s.dragging : ""} ${csv && !pasting ? s.loaded : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void pickFile(file);
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Statement file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pickFile(file);
          }}
        />
        {csv && !pasting ? (
          <>
            <b>{filename}</b>
            <span>{rows} rows read · drop another file to replace it</span>
          </>
        ) : (
          <>
            <b>Drop a CSV statement here, or click to choose one</b>
            <span>HDFC, ICICI, SBI, Axis and Kotak layouts are detected automatically</span>
          </>
        )}
      </label>

      {pasting ? (
        <div className={s.paste}>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setFilename("pasted.csv");
            }}
            placeholder="Paste the CSV, header row first"
            spellCheck={false}
            aria-label="Statement CSV"
            autoFocus
          />
        </div>
      ) : (
        <button type="button" className={s.pasteToggle} onClick={() => setPasting(true)}>
          Paste CSV text instead
        </button>
      )}

      <p className={s.hint}>
        Other banks are mapped by header name.{" "}
        <button
          type="button"
          className={s.linkBtn}
          onClick={() => {
            setCsv(SAMPLE);
            setFilename("sample-hdfc.csv");
            setPasting(false);
          }}
        >
          Load a sample statement
        </button>
      </p>
    </div>
  );
}
