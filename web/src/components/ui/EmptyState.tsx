import type { ReactNode } from "react";
import s from "./EmptyState.module.scss";

type Props = { title: string; children?: ReactNode; action?: ReactNode };

export default function EmptyState({ title, children, action }: Props) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
