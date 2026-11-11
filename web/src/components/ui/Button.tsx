import type { ButtonHTMLAttributes } from "react";
import s from "./Button.module.scss";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
  block?: boolean;
};

export default function Button({ variant = "primary", size = "md", block, className = "", ...rest }: Props) {
  const classes = [s.btn, variant === "ghost" && s.ghost, size === "sm" && s.sm, block && s.block, className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...rest} />;
}
