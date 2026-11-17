import { useState } from 'react';
import { units, upcomingUnits } from './content/units';
import { dialects } from './domain/dialects/registry';
import type { Lesson as LessonData } from './domain/lessons/types';
import {
  completeLesson,
  currentStreak,
  dayKey,
  findSecret,
  finishedUnits,
  playableLessons,
  unlockUnit,
  streakDoneToday,
  streakLost,
  trackFor,
  weekStrip,
  type Progress,
} from './domain/progress/progress';
import type { OS } from './domain/types';
import { createLocalStore } from './providers/storage';
import { pickLine } from './ui/mascot/lines';
import { SHELLS, type ShellKind, type ShellbyMood } from './ui/mascot/Shellby';
import { detectOs } from './ui/os';
import { Home } from './ui/screens/Home';
import { Landing } from './ui/screens/Landing';
import { Lesson, type LessonResult } from './ui/screens/Lesson';
import { LessonComplete } from './ui/screens/LessonComplete';
import { StreakScreen } from './ui/screens/StreakScreen';

type Screen =
  | { readonly kind: 'landing' }
  | { readonly kind: 'home' }
  | { readonly kind: 'lesson'; readonly lessonId: string }
  | {
      readonly kind: 'complete';
      readonly result: LessonResult;
      readonly streak: number;
      readonly extended: boolean;
      readonly lessonsToday: number;
      readonly newShell: ShellKind | null;
      readonly nextId: string | null;
    }
  | { readonly kind: 'streak'; readonly streak: number; readonly nextId: string | null };

const store = createLocalStore();
const allLessons: readonly LessonData[] = units.flatMap((u) => u.lessons);
const available = (Object.keys(dialects) as OS[]).filter((os) => dialects[os] !== undefined);

/** Shells earned on a track: the starter, plus one per finished unit, in unit order. */
const earnedShells = (p: Progress, os: OS): readonly ShellKind[] => {
  const done = finishedUnits(units, trackFor(p, os));
  return ['spiral', ...units.flatMap((u, i) => (done.includes(u.id) ? [SHELLS[i + 1]?.kind ?? 'spiral'] : []))];
};

const wornShell = (p: Progress, os: OS): ShellKind => {
  const earned = earnedShells(p, os);
  return earned.find((k) => k === p.wearing) ?? earned[earned.length - 1] ?? 'spiral';
};

/** The lesson after this one in course order that isn't done yet, else the first one still open. */
const nextLessonAfter = (p: Progress, os: OS, lessonId: string): string | null => {
  const track = trackFor(p, os);
  const i = allLessons.findIndex((l) => l.id === lessonId);
  const after = allLessons.slice(i + 1).find((l) => !track.completed.includes(l.id) && playableLessons(units, track).includes(l.id));
  return after?.id ?? playableLessons(units, track)[0] ?? null;
};

export function App() {
  const [progress, setProgress] = useState<Progress>(() => store.load());
  const [screen, setScreen] = useState<Screen>(() =>
    progress.os !== null && available.includes(progress.os) ? { kind: 'home' } : { kind: 'landing' },
  );
  const today = dayKey(new Date());
  const detected = detectOs(navigator.userAgent);
  const os = progress.os ?? detected;

  const save = (p: Progress): void => {
    setProgress(p);
    store.save(p);
  };

  const makeGreeting = (p: Progress): { text: string; mood: ShellbyMood } => {
    if (streakLost(p.streak, today)) return { text: pickLine('streakLost'), mood: 'sad' };
    const track = trackFor(p, p.os ?? os);
    if (track.completed.length === 0) return { text: "Welcome to the tide pool. Tap the glowing node and let's begin.", mood: 'idle' };
    if (streakDoneToday(p.streak, today)) return { text: 'Streak safe for today. More lessons, more XP. Just saying.', mood: 'smug' };
    return { text: "You haven't done a lesson today. Your streak is getting nervous.", mood: 'asleep' };
  };
  const [greeting, setGreeting] = useState(() => makeGreeting(progress));
  const goHome = (p: Progress = progress): void => {
    setGreeting(makeGreeting(p));
    setScreen({ kind: 'home' });
  };

  if (screen.kind === 'lesson') {
    const lesson = allLessons.find((l) => l.id === screen.lessonId);
    const dialect = dialects[os];
    if (lesson === undefined || dialect === undefined) return null;
    return (
      <Lesson
        key={`${os}:${lesson.id}`}
        lesson={lesson}
        os={os}
        dialect={dialect}
        shell={wornShell(progress, os)}
        secrets={progress.secrets}
        onSecret={(id) => save(findSecret(progress, id))}
        onExit={() => goHome()}
        onComplete={(result) => {
          const before = earnedShells(progress, os);
          const c = completeLesson(progress, os, result.lessonId, result.xp, today);
          const after = earnedShells(c.progress, os);
          const newShell = after.find((k) => !before.includes(k)) ?? null;
          const next = newShell === null ? c.progress : { ...c.progress, wearing: newShell };
          save(next);
          setScreen({
            kind: 'complete',
            result,
            streak: c.streakAfter,
            extended: c.streakExtended,
            lessonsToday: c.lessonsToday,
            newShell,
            nextId: nextLessonAfter(next, os, result.lessonId),
          });
        }}
      />
    );
  }
  if (screen.kind === 'complete') {
    return (
      <LessonComplete
        xp={screen.result.xp}
        clean={screen.result.clean}
        total={screen.result.total}
        streak={screen.streak}
        lessonsToday={screen.lessonsToday}
        shell={wornShell(progress, os)}
        newShell={screen.newShell}
        nextTitle={allLessons.find((l) => l.id === screen.nextId)?.title ?? null}
        onNext={() => {
          const nextId = screen.nextId;
          if (nextId === null) return goHome();
          if (screen.extended) return setScreen({ kind: 'streak', streak: screen.streak, nextId });
          setScreen({ kind: 'lesson', lessonId: nextId });
        }}
        onContinue={() => (screen.extended ? setScreen({ kind: 'streak', streak: screen.streak, nextId: null }) : goHome())}
      />
    );
  }
  if (screen.kind === 'streak') {
    const nextId = screen.nextId;
    return (
      <StreakScreen
        streak={screen.streak}
        week={weekStrip(progress.streak, today)}
        continueLabel={nextId === null ? 'Continue' : 'Next lesson'}
        onContinue={() => (nextId === null ? goHome() : setScreen({ kind: 'lesson', lessonId: nextId }))}
      />
    );
  }
  if (screen.kind === 'home') {
    const track = trackFor(progress, os);
    return (
      <Home
        os={os}
        units={units}
        upcoming={upcomingUnits}
        completed={track.completed}
        playable={playableLessons(units, track)}
        unlocked={track.unlocked}
        shell={wornShell(progress, os)}
        shells={earnedShells(progress, os)}
        secrets={progress.secrets}
        onWear={(kind) => save({ ...progress, wearing: kind })}
        onSkipAhead={(unitId) => save(unlockUnit(progress, os, unitId))}
        xp={track.xp}
        streak={currentStreak(progress.streak, today)}
        streakToday={streakDoneToday(progress.streak, today)}
        greeting={greeting}
        onStart={(lessonId) => setScreen({ kind: 'lesson', lessonId })}
        onSwitchOs={() => setScreen({ kind: 'landing' })}
      />
    );
  }
  return (
    <Landing
      detected={detected}
      current={progress.os}
      available={available}
      onPick={(picked) => {
        const next = { ...progress, os: picked };
        save(next);
        // A brand-new visitor goes straight to their first keystroke.
        const first = allLessons[0];
        if (progress.os === null && trackFor(next, picked).completed.length === 0 && first !== undefined) {
          setScreen({ kind: 'lesson', lessonId: first.id });
          return;
        }
        goHome(next);
      }}
    />
  );
}
