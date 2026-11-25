import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { RiskLevel } from '../../types/forensics';
import { cn } from '../../lib/utils';

export function RiskStatusLabel({
  level,
  score,
  className,
}: {
  level: RiskLevel;
  score?: number;
  className?: string;
}) {
  const config =
    level === 'HIGH RISK'
      ? {
          icon: ShieldAlert,
          textColor: 'text-red-600 dark:text-red-400',
          label: 'High Risk',
        }
      : level === 'MEDIUM RISK'
        ? {
            icon: AlertTriangle,
            textColor: 'text-amber-600 dark:text-amber-400',
            label: 'Medium Risk',
          }
        : {
            icon: CheckCircle2,
            textColor: 'text-emerald-600 dark:text-emerald-400',
            label: 'Low Risk',
          };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap shrink-0',
        config.textColor,
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
      {typeof score === 'number' && (
        <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
          · {score}/100
        </span>
      )}
    </span>
  );
}
