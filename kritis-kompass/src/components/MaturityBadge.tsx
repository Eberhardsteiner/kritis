import { getMaturityColorTokens } from '../lib/maturityColor';

interface MaturityBadgeProps {
  score: number;
  label: string;
  size?: 'md' | 'lg';
}

export function MaturityBadge({ score, label, size = 'md' }: MaturityBadgeProps) {
  const tokens = getMaturityColorTokens(score);
  const sizing =
    size === 'lg'
      ? 'px-5 py-2 text-sm tracking-wider'
      : 'px-3 py-1 text-xs tracking-wide';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase ${tokens.bgClass} ${tokens.fgClass} ${sizing}`}
    >
      {label}
    </span>
  );
}
