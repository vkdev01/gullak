"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import type { Category } from "@/lib/api";
import { Chevron } from "./Select";
import s from "./Select.module.scss";

type Props = {
  categories: Category[];
  value: string; // "" means none / all
  onChange: (id: string) => void;
  /** Offer "" as a choice, labelled e.g. "Uncategorised" or "All categories". */
  emptyLabel?: string;
  /** Let a whole group (a parent) be picked, e.g. "All of Transport" for a budget. */
  allowGroups?: boolean;
  kinds?: string[];
  disabledIds?: Set<string | null>;
  disabledHint?: string;
  placeholder?: string;
  "aria-label": string;
  size?: "md" | "sm";
  autoFocus?: boolean;
  disabled?: boolean;
  onClose?: () => void;
  className?: string;
};

type Row = { id: string; label: string; parent?: string; group?: boolean };

const matches = (text: string, q: string) => text.toLowerCase().includes(q);

/**
 * Type to filter, arrows to move, Enter to pick (Headless UI Combobox).
 * Results stay grouped under their parent, and a search for a parent ("food")
 * finds every category inside it.
 */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  emptyLabel,
  allowGroups = false,
  kinds,
  disabledIds,
  disabledHint = "has one",
  placeholder = "Search categories…",
  size = "md",
  autoFocus,
  disabled,
  onClose,
  className,
  ...aria
}: Props) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const parents = categories
      .filter((c) => !c.parent_id && (!kinds || kinds.includes(c.kind)))
      .sort((a, b) => a.name.localeCompare(b.name));
    return parents
      .map((p) => {
        const kids = categories.filter((c) => c.parent_id === p.id).sort((a, b) => a.name.localeCompare(b.name));
        const parentHit = !q || matches(p.name, q);
        const rows: Row[] = [];
        if (allowGroups && parentHit) rows.push({ id: p.id, label: `All of ${p.name}`, group: true });
        for (const k of kids) if (parentHit || matches(k.name, q)) rows.push({ id: k.id, label: k.name, parent: p.name });
        return { parent: p, rows };
      })
      .filter((g) => g.rows.length);
  }, [categories, kinds, allowGroups, query]);

  const display = (id: string) => {
    if (!id) return emptyLabel ?? "";
    const c = byId.get(id);
    if (!c) return "";
    return c.parent_id ? c.name : allowGroups ? `All of ${c.name}` : c.name;
  };

  const showEmpty = emptyLabel !== undefined && (!query || matches(emptyLabel, query.trim().toLowerCase()));
  const wrap = [s.field, size === "sm" ? s.sm : "", className ?? ""].join(" ");

  return (
    <Combobox
      value={value}
      onChange={(id: string | null) => onChange(id ?? "")}
      onClose={() => {
        setQuery("");
        onClose?.();
      }}
      immediate
      disabled={disabled}
    >
      <div className={wrap}>
        <ComboboxInput
          className={s.input}
          aria-label={aria["aria-label"]}
          placeholder={placeholder}
          displayValue={display}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus={autoFocus}
        />
        <ComboboxButton className={s.inputChevron} aria-label="Show categories">
          <Chevron />
        </ComboboxButton>
      </div>
      <ComboboxOptions anchor={{ to: "bottom start", gap: 4 }} transition className={s.options}>
        {showEmpty && (
          <ComboboxOption value="" className={s.option}>
            <span>{emptyLabel}</span>
          </ComboboxOption>
        )}
        {groups.map(({ parent, rows }) => (
          <div key={parent.id} role="presentation">
            <div className={s.group} role="presentation">
              {parent.name}
            </div>
            {rows.map((row) => {
              const disabled = disabledIds?.has(row.id) ?? false;
              return (
                <ComboboxOption
                  key={row.id}
                  value={row.id}
                  disabled={disabled}
                  className={`${s.option} ${row.group ? "" : s.indent}`}
                >
                  <span>{row.label}</span>
                  {disabled ? <em>{disabledHint}</em> : query && row.parent && <em>{row.parent}</em>}
                </ComboboxOption>
              );
            })}
          </div>
        ))}
        {!showEmpty && groups.length === 0 && <div className={s.empty}>No category matches “{query}”.</div>}
      </ComboboxOptions>
    </Combobox>
  );
}
