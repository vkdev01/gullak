"use client";

import { useState } from "react";
import { api, type Account } from "@/lib/api";
import s from "./money.module.scss";

/** Remove an account: one made by mistake is deleted, one with history is archived (its rows stay). */
export default function RemoveAccount({ account, onDone }: { account: Account; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.removeAccount(account.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" className={s.removeBtn} onClick={() => setAsking(true)}>
        Remove
      </button>
    );
  }

  return (
    <span className={s.removeConfirm}>
      <span>Remove {account.name}? Accounts with history are archived, not erased.</span>
      <button type="button" onClick={() => void remove()} disabled={busy}>
        {busy ? "Removing…" : "Yes, remove"}
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        Keep
      </button>
      {error && <em className={s.error}>{error}</em>}
    </span>
  );
}
