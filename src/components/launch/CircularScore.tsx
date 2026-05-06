import { scoreColor } from '@/lib/launch/utils';

interface Props { value: number; label: string; size?: number; emphasize?: boolean; }

export function CircularScore({ value, label, size = 120, emphasize }: Props) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, value));
  const dash = (safe / 100) * c;
  const colors = scoreColor(safe);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${safe} out of 100`}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={10} className="fill-none stroke-border" />
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={10} strokeLinecap="round"
            className={`fill-none ${colors.ring} transition-all duration-700`}
            strokeDasharray={`${dash} ${c - dash}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-semibold ${colors.text} ${emphasize ? 'text-3xl' : 'text-2xl'}`}>{safe}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="text-sm font-medium text-foreground">{label}</div>
    </div>
  );
}
