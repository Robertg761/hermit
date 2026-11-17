import { useMemo, useRef, useState } from 'react';
import type { Dialect } from '../../domain/dialects/dialect';
import {
  answerChoice,
  answerLine,
  completeCard,
  isLastChallenge,
  lessonProgress,
  markHintUsed,
  nextChallenge,
  startLesson,
  submitLine,
  type AnswerResult,
  type LessonRun,
} from '../../domain/lessons/lesson-run';
import { HEARTS_PER_LESSON, availableHints } from '../../domain/lessons/runner';
import type { ChallengeType, Lesson as LessonData } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { EGG_LINES, pickLine, type HermeEvent } from '../mascot/lines';
import { SECRET_IDS, isSecretId } from '../../domain/dialects/eggs';
import { Herme, type ShellKind, type HermeMood } from '../mascot/Herme';
import { SHELL_LABEL } from '../os';
import { sounds } from '../sound';
import { Terminal, type TerminalReply } from '../terminal/Terminal';
import { BurrowMap } from '../components/BurrowMap';
import { BuildCard, ChoiceCard, FillCard, LearnCardView, MatchCard, outputLines, type ScreenLine } from './cards';
import { Markdownish } from './Markdownish';

export type LessonResult = { readonly xp: number; readonly clean: number; readonly total: number; readonly lessonId: string };

type Props = {
  readonly lesson: LessonData;
  readonly os: OS;
  readonly dialect: Dialect;
  readonly onExit: () => void;
  readonly onComplete: (result: LessonResult) => void;
  /** Secrets found so far, and a callback when the learner finds an easter egg. */
  readonly secrets?: readonly string[];
  readonly onSecret?: (id: string) => void;
  readonly shell?: ShellKind;
};

type Speech = { readonly mood: HermeMood; readonly text: string };
type Feedback = { readonly kind: 'correct' | 'wrong'; readonly xp: number; readonly correctAnswer?: string; readonly reason?: string } | null;

const say = (event: HermeEvent, mood: HermeMood): Speech => ({ mood, text: pickLine(event) });

const TYPE_BADGE: Record<ChallengeType, string> = {
  learn: 'New command',
  typeAlong: 'Type along',
  pick: 'Pick one',
  match: 'Match',
  build: 'Build it',
  fill: 'Fill the gap',
  do: 'Your turn',
  predict: 'What prints?',
  fix: 'Fix it',
  translate: 'Translate',
};

const INTRO_LINE: Partial<Record<ChallengeType, string>> = {
  learn: "New trick! It's short. I read it twice to make sure.",
  typeAlong: 'Copy the grey text. Practice round, your hearts are safe.',
  pick: 'Pick one. Trust your gut. Or your shell.',
  match: "Tap a command, then what it does. I'll wait.",
  build: 'Tap the tiles in order, then run it for real.',
  fill: 'One piece is missing. You know the one.',
  predict: 'No typing. What will it print? Guess wisely.',
  fix: 'Someone typed this wrong. Not me. Fix it.',
  do: 'Your turn. No grey text this time. You can do it.',
  translate: 'Same job, different shell. Translate it.',
};

export function Lesson({ lesson, os, dialect, onExit, onComplete, secrets = [], onSecret, shell = 'spiral' }: Props) {
  const [run, setRun] = useState<LessonRun>(() => startLesson(lesson, os));
  const runRef = useRef(run);
  const [speech, setSpeech] = useState<Speech>(() => say('welcome', 'idle'));
  const [hintsShown, setHintsShown] = useState(0);
  const [restartNotice, setRestartNotice] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [heartPop, setHeartPop] = useState(0);
  const [ranLines, setRanLines] = useState<readonly ScreenLine[] | null>(null);
  const [flicker, setFlicker] = useState(false);

  const update = (next: LessonRun): void => {
    runRef.current = next;
    setRun(next);
  };

  const challenge = run.attempt.challenge;
  const hints = availableHints(run.attempt);
  const progress = lessonProgress(run, feedback !== null);

  const celebrate = (xp: number): void => {
    const clean = xp > 10;
    const nextCombo = clean ? combo + 1 : 0;
    setCombo(nextCombo);
    setFeedback({ kind: 'correct', xp });
    sounds.correct();
    if (nextCombo === 3 || (nextCombo > 3 && nextCombo % 5 === 0)) setSpeech({ mood: 'smug', text: pickLine('combo').replace('{n}', String(nextCombo)) });
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
    const before = runRef.current;
    const { run: next, event } = submitLine(before, line, dialect);
    update(next);
    const r = event.step.result;
    const clear = r.effects.some((e) => e.kind === 'clear');
    for (const effect of r.effects) {
      if (effect.kind === 'speak' && 'speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(effect.text));
      }
    }
    const egg = r.effects.find((e) => e.kind === 'easterEgg');
    if (egg?.kind === 'easterEgg' && isSecretId(egg.id) && event.kind !== 'solved') {
      const fresh = !secrets.includes(egg.id);
      onSecret?.(egg.id);
      const found = secrets.length + (fresh ? 1 : 0);
      const eggLine = EGG_LINES[egg.id];
      if (eggLine !== undefined) setSpeech({ mood: eggLine.mood, text: fresh ? `${eggLine.text} Secret found: ${found}/${SECRET_IDS.length}.` : eggLine.text });
      if (egg.id === 'nuke') {
        setFlicker(true);
        window.setTimeout(() => setFlicker(false), 700);
      }
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    const explainer = r.wrongOs ?? r.decoded;
    const note = explainer === undefined ? undefined : `Herme: ${explainer.replace(/`/g, '')}`;
    if (event.kind === 'outOfHearts') {
      loseHeart();
      outOfHearts();
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    if (event.kind === 'solved') {
      celebrate(event.xp);
      return { stdout: r.stdout, stderr: r.stderr, clear };
    }
    const lost = next.hearts < before.hearts;
    if (event.step.outcome === 'protected') {
      if (lost) loseHeart();
      setSpeech(say('protected', 'sad'));
      return { stdout: r.stdout, stderr: r.stderr, note: '(Herme put the files back. Try again.)' };
    }
    const ghost = challenge.type === 'typeAlong' ? challenge.solutions[os][0]?.[0] : undefined;
    if (ghost !== undefined && line.trim() !== '' && line.trim() !== ghost) {
      setSpeech({ mood: 'idle', text: `Close. Type the grey text exactly: \`${ghost}\`` });
      return { stdout: r.stdout, stderr: r.stderr, clear, ...(note ? { note } : {}) };
    }
    if (event.step.outcome === 'error') {
      if (lost) loseHeart();
      if (explainer !== undefined) {
        setSpeech({ mood: lost ? 'sad' : 'idle', text: explainer });
        return { stdout: r.stdout, stderr: r.stderr, clear, ...(note ? { note } : {}) };
      }
      setSpeech(lost ? say('error', 'sad') : { mood: 'idle', text: 'See? Nothing broke. Now read what it said, and fix it.' });
    } else if (r.free === true && explainer !== undefined) {
      // A real command Hermit doesn't simulate: curiosity, not a mistake.
      setSpeech({ mood: 'idle', text: explainer });
      return { stdout: r.stdout, stderr: r.stderr, clear, ...(note ? { note } : {}) };
    } else if (line.trim().length > 0) {
      setSpeech((s) => (s.mood === 'sad' ? { mood: 'idle', text: s.text } : s));
    }
    return { stdout: r.stdout, stderr: r.stderr, clear };
  };

  /** Shared ending for Pick, Predict, Build and Fill. */
  const settle = (r: AnswerResult, correctAnswer: string, reason?: string): void => {
    if (r.event === 'outOfHearts') {
      loseHeart();
      update(r.run);
      outOfHearts();
      return;
    }
    update(r.run);
    if (r.correct) {
      celebrate(r.xp);
      if (reason !== undefined) setFeedback({ kind: 'correct', xp: r.xp, reason });
    } else {
      loseHeart();
      setFeedback({ kind: 'wrong', xp: 0, correctAnswer, ...(reason !== undefined ? { reason } : {}) });
      setSpeech(say('error', 'sad'));
    }
  };

  const handleChoice = (choice: number): void => {
    const options = challenge.options?.[os] ?? [];
    const answer = challenge.answer?.[os] ?? 0;
    const reasons = challenge.optionReasons?.[os];
    settle(answerChoice(runRef.current, choice), options[answer] ?? '', choice === answer ? undefined : reasons?.[choice]);
  };

  const handleAssembled = (line: string): void => {
    const r = answerLine(runRef.current, line, dialect);
    const res = r.step.result;
    const explainer = res.wrongOs ?? res.decoded;
    setRanLines([
      { kind: 'cmd', prompt: dialect.prompt(runRef.current.attempt.machine), text: line },
      ...outputLines(res.stdout, res.stderr, res.exitCode),
      ...(explainer !== undefined && !r.correct ? [{ kind: 'note' as const, text: `Herme: ${explainer.replace(/`/g, '')}` }] : []),
    ]);
    settle(r, challenge.solutions[os][0]?.[0] ?? '');
  };

  const handleCard = (mistakes = 0): void => {
    const r = completeCard(runRef.current, mistakes);
    update(r.run);
    if (challenge.type === 'learn') {
      goNext();
      return;
    }
    celebrate(r.xp);
  };

  const goNext = (): void => {
    const current = runRef.current;
    const next = nextChallenge(current);
    setFeedback(null);
    setRanLines(null);
    if (next === null) {
      const total = current.queue.filter((c) => c.type !== 'learn').length;
      onComplete({ xp: current.xp, clean: current.clean, total, lessonId: lesson.id });
      return;
    }
    update(next);
    setHintsShown(0);
    const nextChallengeData = next.attempt.challenge;
    const retry = next.index >= lesson.challenges.length;
    setSpeech({
      mood: retry ? 'smug' : 'idle',
      text: retry ? 'This one again. You know it now.' : (INTRO_LINE[nextChallengeData.type] ?? 'Next one.'),
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
    setRanLines(null);
    setSpeech({ mood: 'idle', text: 'Fresh hearts. Same challenge. You know more than last time.' });
  };

  const sessionKey = `${run.restarts}:${run.index}`;
  const banner = useMemo(() => `Hermit ${SHELL_LABEL[os]} simulator. Nothing here touches a real computer.`, [os]);
  const isTerminal = challenge.type === 'do' || challenge.type === 'fix' || challenge.type === 'typeAlong' || challenge.type === 'translate';
  const locked = feedback !== null || restartNotice;
  // The map helps wherever the learner moves around: terminal, Build and Fill challenges.
  const showMap = isTerminal || challenge.type === 'build' || challenge.type === 'fill';
  const mapOpenByDefault = useMemo(
    () => /^u[12]-/.test(lesson.id) && !(typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches),
    [lesson.id],
  );

  const learnExample = useMemo((): readonly ScreenLine[] | null => {
    const example = challenge.card?.[os].example;
    if (challenge.type !== 'learn' || example === undefined) return null;
    const machine = run.attempt.machine;
    const r = dialect.run(example, machine);
    return [
      { kind: 'cmd', prompt: dialect.prompt(machine), text: example },
      ...outputLines(r.stdout, r.stderr, r.exitCode),
      { kind: 'cmd', prompt: dialect.prompt(r.state), text: '' },
    ];
  }, [challenge, os, dialect, run.attempt.machine]);

  const renderWorkbench = (): React.ReactNode => {
    if (isTerminal) {
      return (
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
            ghost={challenge.type === 'typeAlong' ? challenge.solutions[os][0]?.[0] : undefined}
            disabled={locked}
          />
        </div>
      );
    }
    switch (challenge.type) {
      case 'learn':
        return (
          <LearnCardView
            key={sessionKey}
            os={os}
            body={challenge.card?.[os].body ?? ''}
            example={learnExample}
            {...((challenge.teaches ?? []).includes('prompt') ? { anatomy: dialect.prompt(run.attempt.machine) } : {})}
            onContinue={() => handleCard()}
          />
        );
      case 'match':
        return <MatchCard key={sessionKey} id={challenge.id} pairs={challenge.pairs?.[os] ?? []} onDone={(m) => handleCard(m)} />;
      case 'build':
        return (
          <BuildCard
            key={sessionKey}
            os={os}
            prompt={dialect.prompt(run.attempt.machine)}
            tokens={challenge.tokens?.[os] ?? []}
            locked={locked}
            result={ranLines}
            onCheck={handleAssembled}
          />
        );
      case 'fill':
        return (
          <FillCard
            key={sessionKey}
            os={os}
            prompt={dialect.prompt(run.attempt.machine)}
            template={challenge.template?.[os] ?? ''}
            options={challenge.options?.[os] ?? []}
            locked={locked}
            result={ranLines}
            onCheck={handleAssembled}
          />
        );
      case 'predict':
        return (
          <ChoiceCard
            key={sessionKey}
            os={os}
            screen={(challenge.command?.[os] ?? []).map((text) => ({ kind: 'cmd', prompt: dialect.prompt(run.attempt.machine), text }))}
            options={challenge.options?.[os] ?? []}
            locked={locked}
            onCheck={handleChoice}
          />
        );
      default:
        return <ChoiceCard key={sessionKey} os={os} options={challenge.options?.[os] ?? []} locked={locked} onCheck={handleChoice} />;
    }
  };

  return (
    <main className={`lesson os-theme-${os}${flicker ? ' is-flicker' : ''}`}>
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
        <span className={`type-badge type-${challenge.type}`}>{challenge.type === 'learn' && (challenge.teaches ?? []).some((t) => t === 'prompt' || t === 'errors' || t === 'quotes' || t === 'recursive') ? 'New idea' : TYPE_BADGE[challenge.type]}</span>
        {challenge.review === true && <span className="type-badge type-review">Review</span>}
        {run.index >= lesson.challenges.length && <span className="type-badge type-review">Second try</span>}
        <h2 className="challenge-prompt">
          <Markdownish text={challenge.prompt[os]} />
        </h2>
        {challenge.protectedPaths && challenge.protectedPaths.length > 0 && (
          <p className="protected-note">🛡 Protected: {challenge.protectedPaths.join(', ')}</p>
        )}
      </section>

      <section className="workbench">
        {renderWorkbench()}

        <aside className="buddy" aria-live="polite">
          <div className="speech">
            <Markdownish text={speech.text} />
          </div>
          <Herme mood={speech.mood} size={150} shell={shell} />
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
          {showMap && <BurrowMap machine={run.attempt.machine} os={os} defaultOpen={mapOpenByDefault} />}
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
              {feedback.reason !== undefined && (
                <p className="result-reason">
                  <Markdownish text={feedback.reason} />
                </p>
              )}
              {feedback.correctAnswer !== undefined && (
                <p className="result-answer">
                  Correct answer: <code>{feedback.correctAnswer}</code>
                </p>
              )}
              {!(feedback.kind === 'wrong' && (challenge.type === 'build' || challenge.type === 'fill')) && (
                <p className="result-explain">
                  <Markdownish text={challenge.explain[os]} />
                </p>
              )}
            </div>
          </div>
          <ContinueButton onClick={goNext} label={isLastChallenge(run) ? 'Finish lesson' : 'Continue'} tone={feedback.kind} />
        </footer>
      )}

      {restartNotice && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-labelledby="restart-title">
            <Herme mood="sad" size={140} shell={shell} />
            <h3 id="restart-title">Out of hearts</h3>
            <p>No timers, no waiting. Herme refilled your hearts, and you pick up right here. (This lesson can't be Flawless now.)</p>
            <ContinueButton onClick={retry} label="Keep going" tone="correct" />
          </div>
        </div>
      )}
    </main>
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
