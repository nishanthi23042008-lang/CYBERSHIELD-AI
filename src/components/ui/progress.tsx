import * as React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  indicatorClassName?: string;
}

export function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300',
          indicatorClassName
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
