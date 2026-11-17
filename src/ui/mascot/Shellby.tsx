export type ShellbyMood = 'idle' | 'happy' | 'sad' | 'smug' | 'asleep';

/** Hermit crabs trade up. Shellby earns a new shell for each finished unit. */
export type ShellKind = 'spiral' | 'can' | 'teacup' | 'conch' | 'crt' | 'chest';

export const SHELLS: readonly { readonly kind: ShellKind; readonly name: string; readonly line: string }[] = [
  { kind: 'spiral', name: 'Spiral shell', line: 'The classic. Came with the crab.' },
  { kind: 'can', name: 'Tin can', line: 'Roomy, shiny, slightly beany.' },
  { kind: 'teacup', name: 'Teacup', line: 'Fancy. Pinky claw out.' },
  { kind: 'conch', name: 'Conch', line: 'You can hear the server room in it.' },
  { kind: 'crt', name: 'Old CRT monitor', line: 'Warm, humming, and full of green text.' },
  { kind: 'chest', name: 'Treasure chest', line: 'For a crab who knows sudo.' },
];

type Props = { readonly mood?: ShellbyMood; readonly size?: number; readonly title?: string; readonly shell?: ShellKind };

const BODY = 'var(--crab)';
const BODY_DARK = 'var(--crab-dark)';
const SHELL = 'var(--shell)';
const SHELL_DARK = 'var(--shell-dark)';
const INK = '#1d1a2b';

/** Shellby: an original hermit crab, drawn from scratch. */
export function Shellby({ mood = 'idle', size = 120, title = 'Shellby the hermit crab', shell = 'spiral' }: Props) {
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
      <ShellArt kind={shell} />

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

function ShellArt({ kind }: { kind: ShellKind }) {
  switch (kind) {
    case 'spiral':
      return (
        <g className="shellby-shell">
          <path d="M78 104 C 60 70, 80 22, 118 20 C 150 18, 166 46, 160 74 C 155 100, 128 112, 100 110 Z" fill={SHELL} stroke={SHELL_DARK} strokeWidth="3" />
          <path
            d="M118 66 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -17 2 a16 16 0 1 1 30 -6 a25 25 0 1 1 -44 16"
            fill="none"
            stroke={SHELL_DARK}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path d="M104 26 q 6 -10 14 -6" fill="none" stroke={SHELL_DARK} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'can':
      return (
        <g className="shellby-shell">
          <rect x="80" y="26" width="80" height="84" rx="10" fill="#c9d3dc" stroke="#6f7c88" strokeWidth="3" />
          <rect x="80" y="52" width="80" height="30" fill="#ff8a6b" stroke="#6f7c88" strokeWidth="3" />
          <path d="M84 40 h72 M84 96 h72" stroke="#6f7c88" strokeWidth="2.5" strokeLinecap="round" />
          <text x="120" y="73" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui">BEANS</text>
          <path d="M110 22 q 10 -10 20 0" fill="none" stroke="#6f7c88" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'teacup':
      return (
        <g className="shellby-shell">
          <path d="M150 50 q 24 -2 20 22 q -3 18 -24 18" fill="none" stroke="#c7a98a" strokeWidth="6" strokeLinecap="round" />
          <path d="M78 36 h80 l-6 56 q -4 18 -22 18 h-24 q -18 0 -22 -18 z" fill="#fff7ee" stroke="#c7a98a" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="118" cy="36" rx="40" ry="7" fill="#e9d6c0" stroke="#c7a98a" strokeWidth="3" />
          <circle cx="104" cy="66" r="5" fill="#ff9ab0" />
          <circle cx="122" cy="76" r="5" fill="#ff9ab0" />
          <circle cx="138" cy="62" r="5" fill="#ff9ab0" />
        </g>
      );
    case 'conch':
      return (
        <g className="shellby-shell">
          <path d="M78 106 C 66 72, 96 30, 156 12 C 146 40, 170 70, 158 94 C 146 112, 108 116, 78 106 Z" fill="#f9c0b0" stroke="#c46f5f" strokeWidth="3" strokeLinejoin="round" />
          <path d="M92 98 C 104 70, 124 46, 150 22 M106 104 C 118 80, 136 60, 158 44 M124 106 C 134 92, 148 80, 162 70" fill="none" stroke="#c46f5f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M84 84 q 18 -6 22 10" fill="#ffe3d8" stroke="#c46f5f" strokeWidth="2.5" />
        </g>
      );
    case 'crt':
      return (
        <g className="shellby-shell">
          <rect x="98" y="100" width="44" height="12" rx="3" fill="#bdb5a4" stroke="#7d7566" strokeWidth="3" />
          <rect x="78" y="24" width="88" height="80" rx="12" fill="#e3dccb" stroke="#7d7566" strokeWidth="3" />
          <rect x="88" y="34" width="62" height="52" rx="8" fill="#14261c" stroke="#7d7566" strokeWidth="2.5" />
          <text x="94" y="58" fontSize="14" fontWeight="700" fill="#6ee7a0" fontFamily="ui-monospace, monospace">$ ls</text>
          <text x="94" y="76" fontSize="14" fontWeight="700" fill="#6ee7a0" fontFamily="ui-monospace, monospace">&gt;_</text>
          <circle cx="158" cy="94" r="3" fill="#ff8a6b" />
        </g>
      );
    case 'chest':
      return (
        <g className="shellby-shell">
          <circle cx="104" cy="40" r="7" fill="#ffd34d" stroke="#b8860b" strokeWidth="2" />
          <circle cx="122" cy="34" r="7" fill="#ffd34d" stroke="#b8860b" strokeWidth="2" />
          <circle cx="140" cy="40" r="7" fill="#ffd34d" stroke="#b8860b" strokeWidth="2" />
          <path d="M80 60 q 0 -26 40 -26 q 40 0 40 26 z" fill="#a8632f" stroke="#5c3416" strokeWidth="3" strokeLinejoin="round" />
          <rect x="80" y="58" width="80" height="52" rx="4" fill="#9a5b2e" stroke="#5c3416" strokeWidth="3" />
          <path d="M80 72 h80" stroke="#e0b44c" strokeWidth="5" />
          <rect x="112" y="66" width="16" height="18" rx="3" fill="#e0b44c" stroke="#5c3416" strokeWidth="2.5" />
        </g>
      );
  }
}
