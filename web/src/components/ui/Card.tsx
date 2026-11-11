import type { HTMLAttributes } from "react";
import s from "./Card.module.scss";

type Props = HTMLAttributes<HTMLDivElement> & { padded?: boolean };

export default function Card({ padded = true, className = "", ...rest }: Props) {
  return <div className={[s.card, padded && s.padded, className].filter(Boolean).join(" ")} {...rest} />;
}
