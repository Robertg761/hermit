import { useMemo, useRef, useState } from 'react';
import type { Dialect } from '../../domain/dialects/dialect';
import { isLastChallenge, markHintUsed, nextChallenge, startLesson, submitLine, type LessonRun } from '../../domain/lessons/lesson-run';
import { HEARTS_PER_LESSON, availableHints } from '../../domain/lessons/runner';
import type { Lesson as LessonData } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { pickLine, type ShellbyEvent } from '../mascot/lines';
import { Shellby, type ShellbyMood } from '../mascot/Shellby';
import { OS_LABEL, SHELL_LABEL } from '../os';
import { Terminal, type TerminalReply } from '../terminal/Terminal';
import { Markdownish } from './Markdownish';

type Props = {
  readonly lesson: LessonData;
  readonly os: OS;
  readonly dialect: Dialect;
  readonly onExit: () => void;
  readonly onComplete: (result: { xp: number; clean: number; total: number }) => void;
};

type Speech = { readonly mood: ShellbyMood; readonly text: string };

const say = (event: ShellbyEvent, mood: ShellbyMood): Speech => ({ mood, text: pickLine(event) });

export function Lesson({ lesson, os, dialect, onExit, onComplete }: Props) {
  const [run, setRun] = useState<LessonRun>(() => startLesson(lesson, os));
  const runRef = useRef(run);
  const [speech, setSpeech] = useState<Speech>(() => say('welcome', 'idle'));
  const [hintsShown, setHintsShown] = useState(0);
  const [restartNotice, setRestartNotice] = useState(false);

  const update = (next: LessonRun): void => {
    runRef.current = next;
    setRun(next);
  };

  const challenge = run.attempt.challenge;
  const solved = run.attempt.solved;
  const hints = availableHints(run.attempt);
  const progress = (run.index + (solved ? 1 : 0)) / lesson.challenges.length;

  const handleLine = (line: string): TerminalReply => {
    const { run: next, event } = submitLine(runRef.current, line, dialect);
    update(next);
    const r = event.step.result;
    const clear = r.effects.some((e) => e.kind === 'clear');
    if (event.kind === 'outOfHearts') {
      setRestartNotice(true);
      setHintsShown(0);
      setSpeech(say('outOfHearts', 'sad'));
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    if (event.kind === 'solved') {
      setSpeech(event.xp > 10 ? say('solvedClean', 'happy') : say('solved', 'happy'));
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    if (event.step.outcome === 'protected') {
      setSpeech(say('protected', 'sad'));
      return { stdout: r.stdout, stderr: r.stderr, note: '(Shellby restored the files for this challenge.)' };
    }
    if (event.step.outcome === 'error') setSpeech(say('error', 'sad'));
    else if (line.trim().length > 0) setSpeech((s) => (s.mood === 'sad' ? { mood: 'idle', text: s.text } : s));
    return { stdout: r.stdout, stderr: r.stderr, clear };
  };

  const goNext = (): void => {
    const current = runRef.current;
    const next = nextChallenge(current);
    if (next === null) {
      onComplete({ xp: current.xp, clean: current.clean, total: lesson.challenges.length });
      return;
    }
    update(next);
    setHintsShown(0);
    setSpeech({ mood: 'idle', text: pickLine('welcome') });
  };

  const showHint = (): void => {
    update(markHintUsed(runRef.current));
    setHintsShown((n) => Math.min(n + 1, hints.length));
    setSpeech(say('hint', 'smug'));
  };

  const retry = (): void => {
    setRestartNotice(false);
    update(startLesson(lesson, os, runRef.current.restarts));
    setSpeech(say('welcome', 'idle'));
  };

  const sessionKey = `${run.restarts}:${run.index}`;
  const banner = useMemo(
    () => `Hermit ${SHELL_LABEL[os]} simulator. Nothing here touches a real computer.`,
    [os],
  );

  return (
    <main className={`lesson os-theme-${os}`}>
      <header className="lesson-top">
        <button type="button" className="icon-button" onClick={onExit} aria-label="Leave lesson">
          ✕
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="hearts" aria-label={`${run.hearts} of ${HEARTS_PER_LESSON} hearts`}>
          {Array.from({ length: HEARTS_PER_LESSON }, (_, i) => (
            <span key={i} className={i < run.hearts ? 'heart' : 'heart is-empty'} aria-hidden="true">
              ♥
            </span>
          ))}
        </div>
      </header>

      <section className="challenge">
        <div className="challenge-meta">
          {lesson.title} · {run.index + 1} of {lesson.challenges.length} · {OS_LABEL[os]}
        </div>
        <h2 className="challenge-prompt">
          <Markdownish text={challenge.prompt[os]} />
        </h2>
        {challenge.protectedPaths && challenge.protectedPaths.length > 0 && (
          <p className="protected-note">Don't touch: {challenge.protectedPaths.join(', ')}</p>
        )}
      </section>

      <section className="workbench">
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
            disabled={solved || restartNotice}
          />
        </div>

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
          {!solved && hints.length > hintsShown && (
            <button type="button" className={`hint-button${hintsShown === 0 ? ' is-pulsing' : ''}`} onClick={showHint}>
              {hintsShown === 0 ? 'Hint' : 'Another hint'}
            </button>
          )}
        </aside>
      </section>

      {solved && (
        <footer className="result-sheet" role="status">
          <div>
            <p className="result-title">Nice! +{run.attempt.usedHint || run.attempt.lostHeart ? 10 : 15} XP</p>
            <p className="result-explain">
              <Markdownish text={challenge.explain[os]} />
            </p>
          </div>
          <ContinueButton onClick={goNext} label={isLastChallenge(run) ? 'Finish lesson' : 'Continue'} />
        </footer>
      )}

      {restartNotice && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-labelledby="restart-title">
            <Shellby mood="sad" size={140} />
            <h3 id="restart-title">Out of hearts</h3>
            <p>No timers, no waiting. The lesson starts over from the first challenge.</p>
            <ContinueButton onClick={retry} label="Try again" />
          </div>
        </div>
      )}
    </main>
  );
}

function ContinueButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="primary-button"
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
