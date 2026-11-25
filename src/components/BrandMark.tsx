import { ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export function BrandMark({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md cursor-pointer',
        className
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-900/30 shrink-0">
        <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        TrustScan AI
      </span>
    </button>
  );
}
