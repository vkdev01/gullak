"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccounts } from "@/hooks/useAccounts";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

const DISMISSED = "gullak.ui.setupDismissed";

/** The first-run path from an empty ledger to a plan. Disappears once every step is done. */
export default function SetupChecklist({ data }: { data: Dashboard }) {
  const { accounts, loading } = useAccounts();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISSED) === "1");
  }, []);

  const steps = [
    { done: accounts.length > 0, label: "Add an account", href: "/accounts/", hint: "Bank, card or cash" },
    { done: data.spent > 0 || data.income > 0, label: "Bring in this month", href: "/import/", hint: "Import a CSV statement" },
    { done: data.budgets.length > 0, label: "Set a budget", href: "/budgets/", hint: "One category is enough to start" },
    { done: data.goals.length > 0, label: "Name a goal", href: "/goals/", hint: "A number with a date" },
  ];
  const doneCount = steps.filter((st) => st.done).length;

  if (loading || dismissed || doneCount === steps.length) return null;

  return (
    <section className={s.setup} aria-label="Set up your month">
      <div className={s.setupHead}>
        <div>
          <h2>Set up your month</h2>
          <span>
            {doneCount} of {steps.length} done
          </span>
        </div>
        <button
          type="button"
          className={s.setupDismiss}
          onClick={() => {
            window.localStorage.setItem(DISMISSED, "1");
            setDismissed(true);
          }}
        >
          Hide
        </button>
      </div>
      <ol className={s.setupSteps}>
        {steps.map((step) => (
          <li key={step.label} className={step.done ? s.stepDone : undefined}>
            <Link href={step.href}>
              <i aria-hidden="true">{step.done ? "✓" : ""}</i>
              <span>
                <b>{step.label}</b>
                <em>{step.done ? "Done" : step.hint}</em>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
