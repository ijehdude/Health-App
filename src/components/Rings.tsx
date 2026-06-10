'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/lib/utils';

interface RingProps {
  value: number;
  target: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}

/** Animated SVG progress ring. Fill animates from 0 on mount. */
function Ring({ value, target, size, strokeWidth, color, trackColor = '#f1f5f9', children }: RingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? Math.min(value / target, 1) : 0;
  const offset = circumference * (1 - (mounted ? fraction : 0));
  const over = target > 0 && value > target * 1.05;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? '#e11d48' : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const remaining = Math.max(target - consumed, 0);
  const over = consumed > target;
  return (
    <Ring value={consumed} target={target} size={208} strokeWidth={16} color="#2563eb">
      <span className="text-4xl font-extrabold tracking-tight text-slate-900">{fmt(consumed)}</span>
      <span className="text-xs font-medium text-slate-400">of {fmt(target)} kcal</span>
      <span className={`mt-1 text-xs font-semibold ${over ? 'text-danger-600' : 'text-success-600'}`}>
        {over ? `${fmt(consumed - target)} over` : `${fmt(remaining)} left`}
      </span>
    </Ring>
  );
}

export function MacroRing({
  label,
  consumed,
  target,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Ring value={consumed} target={target} size={76} strokeWidth={8} color={color}>
        <span className="text-sm font-bold text-slate-900">{fmt(consumed)}</span>
        <span className="text-[9px] text-slate-400">/{fmt(target)}{unit}</span>
      </Ring>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}
