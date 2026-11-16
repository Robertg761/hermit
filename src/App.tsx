import { useState } from 'react';
import { units, upcomingUnits } from './content/units';
import { dialects } from './domain/dialects/registry';
import type { Lesson as LessonData } from './domain/lessons/types';
import {
  completeLesson,
  currentStreak,
  dayKey,
  streakDoneToday,
  streakLost,
  trackFor,
  weekStrip,
  type Progress,
} from './domain/progress/progress';
import type { OS } from './domain/types';
import { createLocalStore } from './providers/storage';
import { pickLine } from './ui/mascot/lines';
import type { ShellbyMood } from './ui/mascot/Shellby';
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
  | { readonly kind: 'complete'; readonly result: LessonResult; readonly streak: number; readonly extended: boolean; readonly lessonsToday: number }
  | { readonly kind: 'streak'; readonly streak: number };

const store = createLocalStore();
const allLessons: readonly LessonData[] = units.flatMap((u) => u.lessons);
const available = (Object.keys(dialects) as OS[]).filter((os) => dialects[os] !== undefined);

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
        onExit={() => goHome()}
        onComplete={(result) => {
          const c = completeLesson(progress, os, result.lessonId, result.xp, today);
          save(c.progress);
          setScreen({ kind: 'complete', result, streak: c.streakAfter, extended: c.streakExtended, lessonsToday: c.lessonsToday });
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
        onContinue={() => (screen.extended ? setScreen({ kind: 'streak', streak: screen.streak }) : goHome())}
      />
    );
  }
  if (screen.kind === 'streak') {
    return <StreakScreen streak={screen.streak} week={weekStrip(progress.streak, today)} onContinue={() => goHome()} />;
  }
  if (screen.kind === 'home') {
    const track = trackFor(progress, os);
    return (
      <Home
        os={os}
        units={units}
        upcoming={upcomingUnits}
        completed={track.completed}
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
        goHome(next);
      }}
    />
  );
}
