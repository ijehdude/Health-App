import type { ExerciseType, SvgKey } from '@/lib/types';

const TYPE_COLORS: Record<ExerciseType, string> = {
  cardio: '#2563eb', // blue
  strength: '#16a34a', // green
  flexibility: '#9333ea', // purple
  hiit: '#e11d48', // red
  recovery: '#0d9488', // teal
};

interface Props {
  svgKey: SvgKey;
  type: ExerciseType;
  size?: number;
}

/** Stick-figure exercise illustrations. One figure per svgKey, coloured by type. */
export default function ExerciseSVG({ svgKey, type, size = 80 }: Props) {
  const c = TYPE_COLORS[type];
  const stroke = {
    stroke: c,
    strokeWidth: 5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  const head = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={8} fill={c} />;
  const faint = { ...stroke, strokeWidth: 3, opacity: 0.35 };

  const figures: Record<SvgKey, React.ReactNode> = {
    walk: (
      <>
        {head(50, 20)}
        <path d="M50 28 L50 62" {...stroke} />
        <path d="M50 38 L62 50 M50 38 L38 48" {...stroke} />
        <path d="M50 62 L62 90 M50 62 L40 78 L36 92" {...stroke} />
        <path d="M20 100 L84 100" {...faint} />
      </>
    ),
    run: (
      <>
        {head(58, 18)}
        <path d="M56 26 L48 58" {...stroke} />
        <path d="M54 36 L70 30 M54 36 L38 44" {...stroke} />
        <path d="M48 58 L70 70 L66 90 M48 58 L32 72 L18 70" {...stroke} />
        <path d="M14 34 L28 34 M10 46 L24 46" {...faint} />
      </>
    ),
    cycle: (
      <>
        <circle cx={28} cy={84} r={14} {...faint} />
        <circle cx={76} cy={84} r={14} {...faint} />
        {head(60, 22)}
        <path d="M58 30 L46 56 L28 84" {...stroke} />
        <path d="M56 38 L72 50 L74 60" {...stroke} />
        <path d="M46 56 L58 70 M46 56 L40 72" {...stroke} />
        <path d="M70 46 L78 42" {...faint} />
      </>
    ),
    swim: (
      <>
        {head(78, 38)}
        <path d="M70 42 L34 50" {...stroke} />
        <path d="M58 45 L48 26 M40 49 L22 56" {...stroke} />
        <path d="M34 50 L18 44 M34 50 L20 60" {...stroke} />
        <path d="M10 78 Q22 70 34 78 Q46 86 58 78 Q70 70 82 78" {...faint} />
      </>
    ),
    'jump-rope': (
      <>
        {head(50, 24)}
        <path d="M50 32 L50 60" {...stroke} />
        <path d="M50 40 L66 46 M50 40 L34 46" {...stroke} />
        <path d="M50 60 L60 80 M50 60 L40 80" {...stroke} />
        <path d="M34 46 Q50 110 66 46" {...faint} />
        <path d="M40 96 L60 96" {...faint} />
      </>
    ),
    hiit: (
      <>
        {head(50, 18)}
        <path d="M50 26 L50 58" {...stroke} />
        <path d="M50 34 L72 16 M50 34 L28 16" {...stroke} />
        <path d="M50 58 L70 84 M50 58 L30 84" {...stroke} />
        <path d="M14 50 L22 50 M78 50 L86 50 M16 64 L24 60 M84 64 L76 60" {...faint} />
      </>
    ),
    squat: (
      <>
        {head(46, 30)}
        <path d="M46 38 L44 62" {...stroke} />
        <path d="M45 46 L70 46 M45 46 L68 54" {...stroke} />
        <path d="M44 62 L26 70 L30 92 M44 62 L52 74 L48 94" {...stroke} />
        <path d="M20 100 L80 100" {...faint} />
      </>
    ),
    'push-up': (
      <>
        {head(78, 52)}
        <path d="M70 58 L26 70" {...stroke} />
        <path d="M62 60 L60 80 M64 60 L70 82" {...stroke} />
        <path d="M26 70 L14 78" {...stroke} />
        <path d="M8 88 L92 88" {...faint} />
      </>
    ),
    plank: (
      <>
        {head(80, 48)}
        <path d="M72 54 L24 62" {...stroke} />
        <path d="M68 56 L66 76 L78 78" {...stroke} />
        <path d="M24 62 L12 74" {...stroke} />
        <path d="M6 86 L94 86" {...faint} />
      </>
    ),
    lunge: (
      <>
        {head(50, 22)}
        <path d="M50 30 L50 58" {...stroke} />
        <path d="M50 40 L62 34 M50 40 L38 34" {...stroke} />
        <path d="M50 58 L68 66 L68 90 M50 58 L36 76 L18 80" {...stroke} />
        <path d="M10 96 L90 96" {...faint} />
      </>
    ),
    row: (
      <>
        {head(34, 28)}
        <path d="M40 34 L62 48 L66 76" {...stroke} />
        <path d="M50 40 L48 64" {...stroke} />
        <path d="M40 64 L56 64" {...faint} />
        <circle cx={38} cy={64} r={5} fill={c} opacity={0.5} />
        <circle cx={58} cy={64} r={5} fill={c} opacity={0.5} />
        <path d="M66 76 L80 94 M66 76 L56 94" {...stroke} />
        <path d="M10 100 L90 100" {...faint} />
      </>
    ),
    yoga: (
      <>
        {head(50, 18)}
        <path d="M50 26 L50 60" {...stroke} />
        <path d="M50 34 Q50 18 50 12 M50 36 L30 24 M50 36 L70 24" {...stroke} />
        <path d="M50 60 L50 94 M50 64 L66 56 L60 70" {...stroke} />
        <path d="M30 100 L70 100" {...faint} />
      </>
    ),
    stretch: (
      <>
        {head(54, 22)}
        <path d="M52 30 Q46 48 42 62" {...stroke} />
        <path d="M50 38 Q70 28 80 14 M50 38 Q36 30 30 18" {...stroke} />
        <path d="M42 62 L34 92 M42 62 L56 78 L58 94" {...stroke} />
        <path d="M20 100 L80 100" {...faint} />
      </>
    ),
    balance: (
      <>
        {head(50, 20)}
        <path d="M50 28 L50 60" {...stroke} />
        <path d="M50 38 L76 32 M50 38 L24 32" {...stroke} />
        <path d="M50 60 L50 94 M50 60 L70 68 L84 60" {...stroke} />
        <path d="M36 100 L64 100" {...faint} />
      </>
    ),
    chair: (
      <>
        <path d="M30 50 L30 96 M30 72 L62 72 L62 96 M30 50 L26 50" {...faint} />
        {head(44, 32)}
        <path d="M44 40 L44 70" {...stroke} />
        <path d="M44 48 L62 40 M44 48 L28 44" {...stroke} />
        <path d="M44 70 L58 70 L58 94 M44 70 L44 94" {...stroke} />
        <path d="M20 100 L76 100" {...faint} />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      role="img"
      aria-label={`${svgKey} exercise illustration`}
    >
      {figures[svgKey]}
    </svg>
  );
}
