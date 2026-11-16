import { useState } from 'react';
import { units } from './content/units';
import { dialects } from './domain/dialects/registry';
import type { Lesson as LessonData } from './domain/lessons/types';
import type { OS } from './domain/types';
import { detectOs } from './ui/os';
import { Landing } from './ui/screens/Landing';
import { Lesson } from './ui/screens/Lesson';
import { LessonComplete } from './ui/screens/LessonComplete';

type Screen =
  | { readonly kind: 'landing' }
  | { readonly kind: 'lesson'; readonly os: OS; readonly lessonIndex: number }
  | { readonly kind: 'complete'; readonly os: OS; readonly lessonIndex: number; readonly xp: number; readonly clean: number; readonly total: number };

const allLessons: readonly LessonData[] = units.flatMap((u) => u.lessons);
const available = (Object.keys(dialects) as OS[]).filter((os) => dialects[os] !== undefined);

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'landing' });
  const detected = detectOs(navigator.userAgent);

  if (screen.kind === 'lesson') {
    const lesson = allLessons[screen.lessonIndex];
    const dialect = dialects[screen.os];
    if (lesson === undefined || dialect === undefined) return null;
    return (
      <Lesson
        key={`${screen.os}:${lesson.id}`}
        lesson={lesson}
        os={screen.os}
        dialect={dialect}
        onExit={() => setScreen({ kind: 'landing' })}
        onComplete={(r) => setScreen({ kind: 'complete', os: screen.os, lessonIndex: screen.lessonIndex, ...r })}
      />
    );
  }
  if (screen.kind === 'complete') {
    const hasNext = screen.lessonIndex + 1 < allLessons.length;
    return (
      <LessonComplete
        xp={screen.xp}
        clean={screen.clean}
        total={screen.total}
        hasNext={hasNext}
        onNext={() => setScreen({ kind: 'lesson', os: screen.os, lessonIndex: screen.lessonIndex + 1 })}
        onHome={() => setScreen({ kind: 'landing' })}
      />
    );
  }
  return <Landing detected={detected} available={available} onPick={(os) => setScreen({ kind: 'lesson', os, lessonIndex: 0 })} />;
}
