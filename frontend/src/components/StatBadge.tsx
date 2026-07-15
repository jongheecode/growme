import { ReactNode } from 'react';

interface StatBadgeProps {
  icon: ReactNode;
  value: string;
  label: string;
  tint: 'coral' | 'mint' | 'honey';
}

const SHADOW_BY_TINT: Record<StatBadgeProps['tint'], string> = {
  coral: 'shadow-[0_4px_14px_-6px_rgba(232,93,130,0.35)]',
  mint: 'shadow-[0_4px_14px_-6px_rgba(63,191,153,0.35)]',
  honey: 'shadow-[0_4px_14px_-6px_rgba(201,138,0,0.35)]',
};

const TEXT_BY_TINT: Record<StatBadgeProps['tint'], string> = {
  coral: 'text-coral-dark',
  mint: 'text-mint-dark',
  honey: 'text-honey-dark',
};

export default function StatBadge({ icon, value, label, tint }: StatBadgeProps) {
  return (
    <div
      className={`flex-1 rounded-2xl bg-white py-3 px-1.5 text-center flex flex-col items-center gap-1 ${SHADOW_BY_TINT[tint]}`}
    >
      <div className={TEXT_BY_TINT[tint]}>{icon}</div>
      <span className={`text-base font-display ${TEXT_BY_TINT[tint]}`}>{value}</span>
      <span className="text-[9.5px] text-ink-soft">{label}</span>
    </div>
  );
}
