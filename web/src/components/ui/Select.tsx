"use client";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import s from "./Select.module.scss";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  "aria-label"?: string;
  size?: "md" | "sm";
  variant?: "field" | "bare";
  disabled?: boolean;
  className?: string;
};

export function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className ?? s.chevron} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** A styled, keyboard-accessible single select (Headless UI Listbox). */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  size = "md",
  variant = "field",
  disabled,
  className,
  ...aria
}: Props) {
  const current = options.find((o) => o.value === value);
  const wrap = [s.field, size === "sm" ? s.sm : "", variant === "bare" ? s.bare : "", className ?? ""].join(" ");

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={wrap}>
        <ListboxButton className={s.trigger} aria-label={aria["aria-label"]}>
          <span className={`${s.value} ${current ? "" : s.placeholder}`}>{current?.label ?? placeholder}</span>
          <Chevron />
        </ListboxButton>
        <ListboxOptions anchor={{ to: "bottom start", gap: 4 }} transition className={s.options}>
          {options.map((o) => (
            <ListboxOption key={o.value} value={o.value} disabled={o.disabled} className={s.option}>
              <span>{o.label}</span>
              {o.hint && <em>{o.hint}</em>}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
