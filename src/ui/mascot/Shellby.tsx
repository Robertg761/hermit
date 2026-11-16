export type ShellbyMood = 'idle' | 'happy' | 'sad' | 'smug' | 'asleep';

type Props = { readonly mood?: ShellbyMood; readonly size?: number; readonly title?: string };

const BODY = 'var(--crab)';
const BODY_DARK = 'var(--crab-dark)';
const SHELL = 'var(--shell)';
const SHELL_DARK = 'var(--shell-dark)';
const INK = '#1d1a2b';

/** Shellby: an original hermit crab, drawn from scratch. */
export function Shellby({ mood = 'idle', size = 120, title = 'Shellby the hermit crab' }: Props) {
  const raised = mood === 'happy';
  const droop = mood === 'sad' || mood === 'asleep';
  const leftEye = { x: droop ? 40 : 41, y: droop ? 56 : 46 };
  const rightEye = { x: droop ? 70 : 68, y: droop ? 56 : 44 };

  return (
    <svg
      className={`shellby shellby-${mood}`}
      viewBox="0 0 170 140"
      width={size}
      height={(size * 140) / 170}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* shell */}
      <g className="shellby-shell">
        <path
          d="M78 104 C 60 70, 80 22, 118 20 C 150 18, 166 46, 160 74 C 155 100, 128 112, 100 110 Z"
          fill={SHELL}
          stroke={SHELL_DARK}
          strokeWidth="3"
        />
        <path
          d="M118 66 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -17 2 a16 16 0 1 1 30 -6 a25 25 0 1 1 -44 16"
          fill="none"
          stroke={SHELL_DARK}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M104 26 q 6 -10 14 -6" fill="none" stroke={SHELL_DARK} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* legs */}
      <g stroke={BODY_DARK} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M44 112 q -8 8 -14 16" />
        <path d="M56 116 q -2 8 -6 14" />
        <path d="M74 116 q 4 8 4 14" />
        <path d="M86 112 q 8 8 12 14" />
      </g>

      {/* eye stalks */}
      <g stroke={BODY_DARK} strokeWidth="4" strokeLinecap="round">
        <line x1="52" y1="92" x2={leftEye.x} y2={leftEye.y + 8} />
        <line x1="62" y1="92" x2={rightEye.x} y2={rightEye.y + 8} />
      </g>

      {/* body */}
      <ellipse cx="64" cy="102" rx="30" ry="17" fill={BODY} stroke={BODY_DARK} strokeWidth="3" />

      {/* claws */}
      <g className="shellby-claws" transform={raised ? 'translate(0 -14)' : undefined}>
        <path
          d="M36 100 q -14 -2 -20 -14 q -4 -10 4 -14 q 6 10 14 8 q -2 -8 4 -12 q 8 6 6 18 q -2 10 -8 14 z"
          fill={BODY}
          stroke={BODY_DARK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M92 104 q 12 -2 16 -12 q 2 -8 -4 -10 q -4 8 -10 6 q 0 -6 -4 -8 q -6 6 -4 14 q 2 8 6 10 z"
          fill={BODY}
          stroke={BODY_DARK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      {/* eyes */}
      <Eye cx={leftEye.x} cy={leftEye.y} mood={mood} side="left" />
      <Eye cx={rightEye.x} cy={rightEye.y} mood={mood} side="right" />

      {/* mouth */}
      <Mouth mood={mood} />

      {mood === 'asleep' && (
        <g className="shellby-zzz" fill={INK} fontFamily="ui-sans-serif, system-ui" fontWeight="700">
          <text x="84" y="40" fontSize="14">z</text>
          <text x="94" y="28" fontSize="18">z</text>
          <text x="108" y="14" fontSize="22">Z</text>
        </g>
      )}
    </svg>
  );
}

function Eye({ cx, cy, mood, side }: { cx: number; cy: number; mood: ShellbyMood; side: 'left' | 'right' }) {
  if (mood === 'happy') {
    return (
      <g>
        <circle cx={cx} cy={cy} r="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <path d={`M${cx - 5} ${cy + 2} q 5 -8 10 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (mood === 'asleep') {
    return (
      <g>
        <circle cx={cx} cy={cy} r="10" fill={BODY} stroke={BODY_DARK} strokeWidth="2.5" />
        <path d={`M${cx - 6} ${cy} q 6 5 12 0`} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  const pupilDy = mood === 'sad' ? 3 : 0;
  const pupilDx = mood === 'smug' ? (side === 'left' ? 3 : 3) : side === 'left' ? 1 : -1;
  return (
    <g>
      <circle cx={cx} cy={cy} r="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx={cx + pupilDx} cy={cy + pupilDy} r="4.5" fill={INK} />
      <circle cx={cx + pupilDx + 1.5} cy={cy + pupilDy - 1.5} r="1.4" fill="#fff" />
      {mood === 'smug' && (
        <path
          d={`M${cx - 10} ${cy - 1} a 10 10 0 0 1 20 0 z`}
          fill={BODY}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {mood === 'sad' && (
        <path
          d={side === 'left' ? `M${cx - 8} ${cy - 14} l 12 4` : `M${cx + 8} ${cy - 14} l -12 4`}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: ShellbyMood }) {
  const common = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round' as const };
  switch (mood) {
    case 'happy':
      return <path d="M54 100 q 10 12 20 0 z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
    case 'sad':
      return <path d="M56 106 q 8 -7 16 0" {...common} />;
    case 'smug':
      return <path d="M56 102 q 10 4 18 -4" {...common} />;
    case 'asleep':
      return <ellipse cx="64" cy="103" rx="3" ry="2.5" fill={INK} />;
    case 'idle':
      return <path d="M57 101 q 7 6 14 0" {...common} />;
  }
}
