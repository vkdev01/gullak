import type { InputHTMLAttributes } from "react";
import s from "./Field.module.scss";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Field({ label, id, className = "", ...rest }: Props) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={s.field}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} className={className} {...rest} />
    </div>
  );
}
