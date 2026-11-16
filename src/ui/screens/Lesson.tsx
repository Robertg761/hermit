import { useMemo, useRef, useState } from 'react';
import type { Dialect } from '../../domain/dialects/dialect';
import {
  answerPredict,
  isLastChallenge,
  markHintUsed,
  nextChallenge,
  startLesson,
  submitLine,
  type LessonRun,
} from '../../domain/lessons/lesson-run';
import { HEARTS_PER_LESSON, availableHints } from '../../domain/lessons/runner';
import type { ChallengeType, Lesson as LessonData } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { pickLine, type ShellbyEvent } from '../mascot/lines';
import { Shellby, type ShellbyMood } from '../mascot/Shellby';
import { SHELL_LABEL } from '../os';
import { sounds } from '../sound';
import { Terminal, type TerminalReply } from '../terminal/Terminal';
import { Markdownish } from './Markdownish';

export type LessonResult = { readonly xp: number; readonly clean: number; readonly total: number; readonly lessonId: string };

type Props = {
  readonly lesson: LessonData;
  readonly os: OS;
  readonly dialect: Dialect;
  readonly onExit: () => void;
  readonly onComplete: (result: LessonResult) => void;
};

type Speech = { readonly mood: ShellbyMood; readonly text: string };
type Feedback = { readonly kind: 'correct' | 'wrong'; readonly xp: number; readonly correctAnswer?: string } | null;

const say = (event: ShellbyEvent, mood: ShellbyMood): Speech => ({ mood, text: pickLine(event) });

const TYPE_BADGE: Record<ChallengeType, string> = {
  do: 'Your turn',
  predict: 'What prints?',
  fix: 'Fix it',
  translate: 'Translate',
};

export function Lesson({ lesson, os, dialect, onExit, onComplete }: Props) {
  const [run, setRun] = useState<LessonRun>(() => startLesson(lesson, os));
  const runRef = useRef(run);
  const [speech, setSpeech] = useState<Speech>(() => say('welcome', 'idle'));
  const [hintsShown, setHintsShown] = useState(0);
  const [restartNotice, setRestartNotice] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [heartPop, setHeartPop] = useState(0);

  const update = (next: LessonRun): void => {
    runRef.current = next;
    setRun(next);
  };

  const challenge = run.attempt.challenge;
  const hints = availableHints(run.attempt);
  const progress = (run.index + (feedback !== null ? 1 : 0)) / lesson.challenges.length;

  const celebrate = (xp: number): void => {
    const clean = xp > 10;
    const nextCombo = clean ? combo + 1 : 0;
    setCombo(nextCombo);
    setFeedback({ kind: 'correct', xp });
    sounds.correct();
    if (nextCombo >= 3) setSpeech({ mood: 'smug', text: `${nextCombo} in a row! ${pickLine('hatTrick')}` });
    else setSpeech(clean ? say('solvedClean', 'happy') : say('solved', 'happy'));
  };

  const loseHeart = (): void => {
    setCombo(0);
    setHeartPop((n) => n + 1);
    sounds.wrong();
  };

  const outOfHearts = (): void => {
    setRestartNotice(true);
    setHintsShown(0);
    setFeedback(null);
    setSpeech(say('outOfHearts', 'sad'));
  };

  const handleLine = (line: string): TerminalReply => {
    const { run: next, event } = submitLine(runRef.current, line, dialect);
    update(next);
    const r = event.step.result;
    const clear = r.effects.some((e) => e.kind === 'clear');
    for (const effect of r.effects) {
      if (effect.kind === 'speak' && 'speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(effect.text));
      }
    }
    if (event.kind === 'outOfHearts') {
      loseHeart();
      outOfHearts();
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    if (event.kind === 'solved') {
      celebrate(event.xp);
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    if (event.step.outcome === 'protected') {
      loseHeart();
      setSpeech(say('protected', 'sad'));
      return { stdout: r.stdout, stderr: r.stderr, note: '(Shellby put the files back. Try again.)' };
    }
    if (event.step.outcome === 'error') {
      loseHeart();
      setSpeech(say('error', 'sad'));
    } else if (line.trim().length > 0) {
      setSpeech((s) => (s.mood === 'sad' ? { mood: 'idle', text: s.text } : s));
    }
    return { stdout: r.stdout, stderr: r.stderr, clear };
  };

  const handlePredict = (choice: number): void => {
    const r = answerPredict(runRef.current, choice);
    if (r.event === 'outOfHearts') {
      loseHeart();
      update(r.run);
      outOfHearts();
      return;
    }
    update(r.run);
    if (r.correct) {
      celebrate(r.xp);
    } else {
      loseHeart();
      const options = challenge.options?.[os] ?? [];
      const answer = challenge.answer?.[os] ?? 0;
      setFeedback({ kind: 'wrong', xp: 0, correctAnswer: options[answer] ?? '' });
      setSpeech(say('error', 'sad'));
    }
  };

  const goNext = (): void => {
    const current = runRef.current;
    const next = nextChallenge(current);
    setFeedback(null);
    if (next === null) {
      onComplete({ xp: current.xp, clean: current.clean, total: lesson.challenges.length, lessonId: lesson.id });
      return;
    }
    update(next);
    setHintsShown(0);
    const nextType = next.attempt.challenge.type;
    setSpeech({
      mood: 'idle',
      text: nextType === 'predict' ? 'No typing this time. Just guess. Wisely.' : nextType === 'fix' ? 'Someone typed this wrong. Not me. Fix it.' : pickLine('welcome'),
    });
  };

  const showHint = (): void => {
    update(markHintUsed(runRef.current));
    setHintsShown((n) => Math.min(n + 1, hints.length));
    setSpeech(say('hint', 'smug'));
  };

  const retry = (): void => {
    setRestartNotice(false);
    setCombo(0);
    update(startLesson(lesson, os, runRef.current.restarts));
    setSpeech(say('welcome', 'idle'));
  };

  const sessionKey = `${run.restarts}:${run.index}`;
  const banner = useMemo(() => `Hermit ${SHELL_LABEL[os]} simulator. Nothing here touches a real computer.`, [os]);
  const isTerminal = challenge.type !== 'predict';

  return (
    <main className={`lesson os-theme-${os}`}>
      <header className="lesson-top">
        <button type="button" className="icon-button" onClick={onExit} aria-label="Leave lesson">
          ✕
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="progress-fill" style={{ width: `${Math.max(progress * 100, 4)}%` }}>
            <span className="progress-shine" />
          </div>
          {combo >= 2 && <span className="combo-tag">{combo} in a row</span>}
        </div>
        <div className="hearts" aria-label={`${run.hearts} of ${HEARTS_PER_LESSON} hearts`} key={heartPop}>
          <span className={`heart-big${heartPop > 0 ? ' is-hit' : ''}`} aria-hidden="true">
            ♥
          </span>
          <span className="heart-count">{run.hearts}</span>
        </div>
      </header>

      <section className="challenge">
        <span className={`type-badge type-${challenge.type}`}>{TYPE_BADGE[challenge.type]}</span>
        <h2 className="challenge-prompt">
          <Markdownish text={challenge.prompt[os]} />
        </h2>
        {challenge.protectedPaths && challenge.protectedPaths.length > 0 && (
          <p className="protected-note">🛡 Protected: {challenge.protectedPaths.join(', ')}</p>
        )}
      </section>

      <section className="workbench">
        {isTerminal ? (
          <div className="terminal-frame">
            <div className="terminal-titlebar">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="terminal-title">{SHELL_LABEL[os]}</span>
            </div>
            <Terminal
              os={os}
              sessionKey={sessionKey}
              prompt={() => dialect.prompt(runRef.current.attempt.machine)}
              onLine={handleLine}
              banner={banner}
              prefill={challenge.prefill?.[os]}
              disabled={feedback !== null || restartNotice}
            />
          </div>
        ) : (
          <PredictCard
            key={sessionKey}
            os={os}
            prompt={dialect.prompt(run.attempt.machine)}
            lines={challenge.command?.[os] ?? []}
            options={challenge.options?.[os] ?? []}
            locked={feedback !== null}
            onCheck={handlePredict}
          />
        )}

        <aside className="buddy" aria-live="polite">
          <div className="speech">
            <Markdownish text={speech.text} />
          </div>
          <Shellby mood={speech.mood} size={150} />
          {hintsShown > 0 && (
            <ol className="hints">
              {hints.slice(0, hintsShown).map((h) => (
                <li key={h}>
                  <Markdownish text={h} />
                </li>
              ))}
            </ol>
          )}
          {isTerminal && feedback === null && hints.length > hintsShown && (
            <button type="button" className={`hint-button${hintsShown === 0 ? ' is-pulsing' : ''}`} onClick={showHint}>
              💡 {hintsShown === 0 ? 'Hint' : 'Another hint'}
            </button>
          )}
        </aside>
      </section>

      {feedback !== null && (
        <footer className={`result-sheet result-${feedback.kind}`} role="status">
          <div className="result-body">
            <span className="result-icon" aria-hidden="true">
              {feedback.kind === 'correct' ? '✓' : '✕'}
            </span>
            <div>
              <p className="result-title">
                {feedback.kind === 'correct' ? (feedback.xp > 10 ? 'Flawless!' : 'Nice!') : 'Not quite.'}
                {feedback.kind === 'correct' && <span className="xp-pop">+{feedback.xp} XP</span>}
              </p>
              {feedback.correctAnswer !== undefined && (
                <p className="result-answer">
                  Correct answer: <code>{feedback.correctAnswer}</code>
                </p>
              )}
              <p className="result-explain">
                <Markdownish text={challenge.explain[os]} />
              </p>
            </div>
          </div>
          <ContinueButton onClick={goNext} label={isLastChallenge(run) ? 'Finish lesson' : 'Continue'} tone={feedback.kind} />
        </footer>
      )}

      {restartNotice && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-labelledby="restart-title">
            <Shellby mood="sad" size={140} />
            <h3 id="restart-title">Out of hearts</h3>
            <p>No timers, no waiting. The lesson starts over from the first challenge.</p>
            <ContinueButton onClick={retry} label="Try again" tone="correct" />
          </div>
        </div>
      )}
    </main>
  );
}

function PredictCard({
  os,
  prompt,
  lines,
  options,
  locked,
  onCheck,
}: {
  os: OS;
  prompt: string;
  lines: readonly string[];
  options: readonly string[];
  locked: boolean;
  onCheck: (choice: number) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const pick = (i: number): void => {
    if (locked) return;
    setChoice(i);
    sounds.select();
  };
  const check = (): void => {
    if (choice === null || locked) return;
    setChecked(choice);
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
      <div className={`predict-screen os-screen-${os}`}>
        {lines.map((l, i) => (
          <div key={i} className="predict-line">
            <span className="predict-prompt">{prompt}</span>
            {l}
          </div>
        ))}
        <div className="predict-unknown">???</div>
      </div>
      <div className="options" role="radiogroup">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={choice === i}
            className={`option${choice === i ? ' is-selected' : ''}${checked === i ? ' is-checked' : ''}`}
            onClick={() => pick(i)}
            disabled={locked}
          >
            <span className="option-key">{i + 1}</span>
            <code className="option-text">{opt}</code>
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

function ContinueButton({ onClick, label, tone }: { onClick: () => void; label: string; tone: 'correct' | 'wrong' }) {
  return (
    <button
      type="button"
      className={`primary-button continue-${tone}`}
      onClick={onClick}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </button>
  );
}
