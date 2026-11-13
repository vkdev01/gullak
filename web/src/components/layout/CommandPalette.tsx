"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/api";
import { ledgerHref } from "@/lib/links";
import { navGroups } from "@/config/site";
import s from "./CommandPalette.module.scss";

type Command = { id: string; label: string; hint: string; run: () => void };

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const base: Command[] = [
      ...navGroups.flatMap((g) => g.items.map((item) => ({ id: item.href, label: item.label, hint: "Go to", run: go(item.href) }))),
      { id: "add", label: "Add a transaction", hint: "Action", run: go("/ledger/?add=1") },
      { id: "review", label: "Rows that need a look", hint: "Ledger", run: go(ledgerHref({ view: "review" })) },
      { id: "uncat", label: "Uncategorised rows", hint: "Ledger", run: go(ledgerHref({ view: "uncategorised" })) },
      { id: "income", label: "Money in this month", hint: "Ledger", run: go(ledgerHref({ direction: "credit" })) },
      {
        id: "signout",
        label: "Sign out",
        hint: "Account",
        run: () => {
          setToken(null);
          router.push("/login/");
        },
      },
    ];
    const q = query.trim().toLowerCase();
    const matches = q ? base.filter((c) => c.label.toLowerCase().includes(q)) : base;
    return q
      ? [...matches, { id: "search", label: `Search the ledger for “${query.trim()}”`, hint: "All time", run: go(ledgerHref({ q: query.trim(), when: "all" })) }]
      : matches;
  }, [query, router]);

  if (!open) return null;

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  return (
    <div className={s.scrim} onMouseDown={onClose}>
      <div
        className={s.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={s.input}
          value={query}
          placeholder="Jump to a page, or search the ledger…"
          aria-label="Command"
          aria-controls="palette-list"
          aria-activedescendant={commands[active] ? `cmd-${commands[active].id}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, commands.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(commands[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <ul id="palette-list" role="listbox" className={s.list}>
          {commands.map((cmd, i) => (
            <li
              key={cmd.id}
              id={`cmd-${cmd.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? s.active : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(cmd)}
            >
              <span>{cmd.label}</span>
              <em>{cmd.hint}</em>
            </li>
          ))}
        </ul>
        <div className={s.foot}>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
