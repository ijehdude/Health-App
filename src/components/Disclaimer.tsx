import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Non-intrusive medical disclaimer shown anywhere coaching, training or
 * calorie advice is given.
 */
export default function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-xs text-slate-400', className)}>
      <Info size={13} className="mt-0.5 shrink-0" />
      <span>
        General guidance only — not medical advice. Consult a qualified professional for medical
        conditions, injuries, pregnancy, or a history of disordered eating.
      </span>
    </p>
  );
}
