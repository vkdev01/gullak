import s from "./StatCard.module.scss";

type Props = { label: string; value: string; foot?: string; negative?: boolean };

export default function StatCard({ label, value, foot, negative }: Props) {
  return (
    <div className={s.stat}>
      <div className={s.label}>{label}</div>
      <div className={[s.value, negative && s.negative].filter(Boolean).join(" ")}>{value}</div>
      {foot && <div className={s.foot}>{foot}</div>}
    </div>
  );
}
