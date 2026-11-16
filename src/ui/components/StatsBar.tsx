import { useState } from 'react';
import type { OS } from '../../domain/types';
import { OS_LABEL } from '../os';
import { isMuted, setMuted } from '../sound';

type Props = {
  readonly os: OS;
  readonly xp: number;
  readonly streak: number;
  readonly streakToday: boolean;
  readonly onSwitchOs: () => void;
};

export function StatsBar({ os, xp, streak, streakToday, onSwitchOs }: Props) {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <header className="stats-bar">
      <button type="button" className={`os-chip os-chip-${os}`} onClick={onSwitchOs} title="Switch OS">
        <span className="os-chip-dot" />
        {OS_LABEL[os]}
        <span className="os-chip-switch">switch</span>
      </button>
      <div className="stat-pills">
        <span className={`stat-pill streak-pill${streakToday ? ' is-lit' : ''}`} title={`${streak} day streak`}>
          <Flame lit={streakToday} />
          {streak}
        </span>
        <span className="stat-pill xp-pill" title={`${xp} XP`}>
          <ShellIcon />
          {xp}
        </span>
        <button
          type="button"
          className="stat-pill mute-pill"
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          title={muted ? 'Sounds off' : 'Sounds on'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}

export function Flame({ lit, size = 22 }: { lit: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="flame-icon">
      <path
        d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"
        fill={lit ? '#ff9a3c' : '#4a4f78'}
      />
      <path d="M12 12c1 2 3 3 3 5a3 3 0 0 1-6 0c0-1 1-2 1.5-2.5.2 1 .8 1.5 1.5 1.5 0-2-.5-3 0-4z" fill={lit ? '#ffd166' : '#5c628f'} />
    </svg>
  );
}

export function ShellIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M10 52 C 4 34 14 8 36 8 C 54 8 62 24 58 38 C 55 52 40 58 26 56 Z" fill="#f7c58b" stroke="#b8783a" strokeWidth="4" />
      <path d="M36 33 m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -9 1 a9 9 0 1 1 16 -3 a14 14 0 1 1 -24 9" fill="none" stroke="#b8783a" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
