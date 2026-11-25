import * as React from 'react';
import { cn } from '../../lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'destructive';
}

export function Alert({ className, variant = 'info', children, ...props }: AlertProps) {
  const styles: Record<NonNullable<AlertProps['variant']>, string> = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    destructive: 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200',
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
