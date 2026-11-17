import { useMemo, useState } from 'react';
import type { OS } from '../../domain/types';
import { sounds } from '../sound';
import { Markdownish } from './Markdownish';
import { parseAnsi } from '../components/ansi';
import { PromptAnatomy } from '../components/PromptAnatomy';

/** A static terminal screen: prompt, command, output, as on a real terminal. */
export type ScreenLine = { readonly kind: 'cmd'; readonly prompt: string; readonly text: string } | { readonly kind: 'out' | 'err' | 'note'; readonly text: string };

export function Screen({ os, lines, children }: { os: OS; lines: readonly ScreenLine[]; children?: React.ReactNode }) {
  return (
    <div className={`predict-screen os-screen-${os}`}>
      {lines.map((l, i) =>
        l.kind === 'cmd' ? (
          <div key={i} className="predict-line">
            <span className="predict-prompt">{l.prompt}</span>
            {l.text}
          </div>
        ) : (
          <pre key={i} className={`screen-${l.kind}`}>
            {parseAnsi(l.text).map((sp, j) =>
              sp.bold || sp.colour !== null ? (
                <span key={j} className={`ansi${sp.bold ? ' ansi-bold' : ''}${sp.colour !== null ? ` ansi-${sp.colour}` : ''}`}>
                  {sp.text}
                </span>
              ) : (
                sp.text
              ),
            )}
          </pre>
        ),
      )}
      {children}
    </div>
  );
}

/** Output of a run, as screen lines. Silent success gets a gentle note for beginners. */
export const outputLines = (stdout: string, stderr: string, exitCode: number): ScreenLine[] => {
  const out: ScreenLine[] = [];
  const trimmedOut = stdout.replace(/\n+$/, '').replace(/^\n+/, '');
  if (trimmedOut !== '') out.push({ kind: 'out', text: trimmedOut });
  if (stderr.trim() !== '') out.push({ kind: 'err', text: stderr.replace(/\n+$/, '') });
  if (out.length === 0 && exitCode === 0) out.push({ kind: 'note', text: '(no output: it worked)' });
  return out;
};

/** Commands render as code, sentences as plain text. */
const looksLikeCommand = (s: string): boolean => {
  if (!s.includes(' ')) return true;
  const first = s.split(' ')[0] ?? '';
  return first.includes('-') || first === first.toLowerCase();
};

export function OptionText({ text }: { text: string }) {
  return looksLikeCommand(text) ? <code className="option-text">{text}</code> : <span className="option-text is-prose">{text}</span>;
}

/** Pick and Predict: choose one option, then Check. */
export function ChoiceCard({
  os,
  screen,
  options,
  locked,
  onCheck,
}: {
  os: OS;
  screen?: readonly ScreenLine[];
  options: readonly string[];
  locked: boolean;
  onCheck: (choice: number) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const pick = (i: number): void => {
    if (locked) return;
    setChoice(i);
    sounds.select();
  };
  const check = (): void => {
    if (choice === null || locked) return;
    onCheck(choice);
  };
  return (
    <div
      className="predict"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) pick(n - 1);
        if (e.key === 'Enter' && !locked) {
          e.preventDefault();
          check();
        }
      }}
    >
      {screen !== undefined && (
        <Screen os={os} lines={screen}>
          <div className="predict-unknown">???</div>
        </Screen>
      )}
      <div className="options" role="radiogroup">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={choice === i}
            className={`option${choice === i ? ' is-selected' : ''}`}
            onClick={() => pick(i)}
            disabled={locked}
          >
            <span className="option-key">{i + 1}</span>
            <OptionText text={opt} />
          </button>
        ))}
      </div>
      {!locked && (
        <button type="button" className="primary-button check-button" disabled={choice === null} onClick={check}>
          Check
        </button>
      )}
    </div>
  );
}

/** A small deterministic shuffle, so a challenge always looks the same. */
const shuffled = <T,>(items: readonly T[], seed: string): T[] => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  // Never leave the meanings in the same order as the commands.
  return out.every((x, i) => x === items[i]) && out.length > 1 ? [...out.slice(1), ...out.slice(0, 1)] : out;
};

/** Match: tap a command, then its meaning. Wrong taps shake but cost nothing. */
export function MatchCard({ id, pairs, onDone }: { id: string; pairs: readonly (readonly [string, string])[]; onDone: (mistakes: number) => void }) {
  const right = useMemo(() => shuffled(pairs.map((p) => p[1]), id), [pairs, id]);
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState<readonly number[]>([]);
  const [shake, setShake] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const tapRight = (meaning: string): void => {
    if (left === null) return;
    const pair = pairs[left];
    if (pair === undefined) return;
    if (pair[1] === meaning) {
      const next = [...done, left];
      setDone(next);
      setLeft(null);
      sounds.select();
      if (next.length === pairs.length) onDone(mistakes);
    } else {
      setMistakes((m) => m + 1);
      setShake(meaning);
      sounds.wrong();
      window.setTimeout(() => setShake(null), 400);
    }
  };

  return (
    <div className="match-grid">
      <div className="match-col">
        {pairs.map(([cmd], i) => (
          <button
            key={cmd}
            type="button"
            className={`match-tile is-command${left === i ? ' is-selected' : ''}${done.includes(i) ? ' is-done' : ''}`}
            disabled={done.includes(i)}
            onClick={() => {
              setLeft(i);
              sounds.select();
            }}
          >
            <code>{cmd}</code>
          </button>
        ))}
      </div>
      <div className="match-col">
        {right.map((meaning) => {
          const matched = done.some((i) => pairs[i]?.[1] === meaning);
          return (
            <button
              key={meaning}
              type="button"
              className={`match-tile${matched ? ' is-done' : ''}${shake === meaning ? ' is-shake' : ''}`}
              disabled={matched || left === null}
              onClick={() => tapRight(meaning)}
            >
              {meaning}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Build: tap tiles to assemble a command at the prompt. Tap a placed tile to take it back. */
export function BuildCard({
  os,
  prompt,
  tokens,
  locked,
  result,
  onCheck,
}: {
  os: OS;
  prompt: string;
  tokens: readonly string[];
  locked: boolean;
  result: readonly ScreenLine[] | null;
  onCheck: (line: string) => void;
}) {
  const [placed, setPlaced] = useState<readonly number[]>([]);
  const line = placed.map((i) => tokens[i] ?? '').join(' ');
  return (
    <div className="predict">
      <Screen os={os} lines={result === null ? [] : result}>
        {result === null && (
          <div className="predict-line build-line">
            <span className="predict-prompt">{prompt}</span>
            {placed.length === 0 ? (
              <span className="build-placeholder">tap the tiles below</span>
            ) : (
              placed.map((i) => (
                <button key={i} type="button" className="tile is-placed" disabled={locked} onClick={() => setPlaced(placed.filter((p) => p !== i))}>
                  {tokens[i]}
                </button>
              ))
            )}
          </div>
        )}
      </Screen>
      <div className="tiles">
        {tokens.map((t, i) => (
          <button
            key={`${t}-${i}`}
            type="button"
            className={`tile${placed.includes(i) ? ' is-used' : ''}`}
            disabled={locked || placed.includes(i)}
            onClick={() => {
              setPlaced([...placed, i]);
              sounds.select();
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {!locked && (
        <button type="button" className="primary-button check-button" disabled={placed.length === 0} onClick={() => onCheck(line)}>
          Run it
        </button>
      )}
    </div>
  );
}

/** Fill: one gap in a command, filled from tiles. */
export function FillCard({
  os,
  prompt,
  template,
  options,
  locked,
  result,
  onCheck,
}: {
  os: OS;
  prompt: string;
  template: string;
  options: readonly string[];
  locked: boolean;
  result: readonly ScreenLine[] | null;
  onCheck: (line: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [before, after] = template.split('___');
  const chosen = choice === null ? null : (options[choice] ?? null);
  return (
    <div className="predict">
      <Screen os={os} lines={result === null ? [] : result}>
        {result === null && (
          <div className="predict-line build-line">
            <span className="predict-prompt">{prompt}</span>
            {before}
            <span className={`gap${chosen === null ? '' : ' is-filled'}`}>{chosen ?? '   '}</span>
            {after}
          </div>
        )}
      </Screen>
      <div className="tiles">
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={`tile${choice === i ? ' is-selected' : ''}`}
            disabled={locked}
            onClick={() => {
              setChoice(i);
              sounds.select();
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {!locked && (
        <button
          type="button"
          className="primary-button check-button"
          disabled={chosen === null}
          onClick={() => {
            if (chosen !== null) onCheck(template.replace('___', chosen));
          }}
        >
          Run it
        </button>
      )}
    </div>
  );
}

/** Learn: a short card with a live example. */
export function LearnCardView({
  os,
  body,
  example,
  anatomy,
  onContinue,
}: {
  os: OS;
  body: string;
  example: readonly ScreenLine[] | null;
  /** The first lesson: show the prompt itself, labelled. */
  anatomy?: string;
  onContinue: () => void;
}) {
  return (
    <div className="learn-card">
      <p className="learn-body">
        <Markdownish text={body} />
      </p>
      {anatomy !== undefined && <PromptAnatomy os={os} prompt={anatomy} />}
      {example !== null && <Screen os={os} lines={example} />}
      <button
        type="button"
        className="primary-button check-button"
        ref={(el) => el?.focus()}
        onClick={onContinue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onContinue();
          }
        }}
      >
        Got it
      </button>
    </div>
  );
}
