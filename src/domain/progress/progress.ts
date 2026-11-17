import type { OS } from '../types';

/** `unlocked`: units opened early with "Know this already? Skip ahead". */
export type Track = { readonly xp: number; readonly completed: readonly string[]; readonly unlocked: readonly string[] };

export type Streak = { readonly count: number; readonly lastDay: string | null };

export type Progress = {
  readonly os: OS | null;
  readonly rosetta: { readonly know: OS; readonly learn: OS } | null;
  readonly tracks: Partial<Record<OS, Track>>;
  readonly streak: Streak;
  /** Lessons finished today, for "three in a row" reactions. Resets each day. */
  readonly today: { readonly day: string | null; readonly lessons: number };
  /** Easter eggs found, across all OSes. */
  readonly secrets: readonly string[];
  /** The shell Shellby wears, picked from the ones earned. null means the newest. */
  readonly wearing: string | null;
};

export const emptyProgress: Progress = {
  os: null,
  rosetta: null,
  tracks: {},
  streak: { count: 0, lastDay: null },
  today: { day: null, lessons: 0 },
  secrets: [],
  wearing: null,
};

export const emptyTrack: Track = { xp: 0, completed: [], unlocked: [] };

export const trackFor = (p: Progress, os: OS): Track => p.tracks[os] ?? emptyTrack;

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1);
  const tb = Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((tb - ta) / 86_400_000);
};

/** The streak as it stands today: it breaks if yesterday was missed. */
export const currentStreak = (s: Streak, today: string): number => {
  if (s.lastDay === null) return 0;
  const gap = daysBetween(s.lastDay, today);
  return gap <= 1 ? s.count : 0;
};

/** True when the learner had a streak but missed a day. */
export const streakLost = (s: Streak, today: string): boolean =>
  s.lastDay !== null && s.count > 0 && daysBetween(s.lastDay, today) > 1;

export const streakDoneToday = (s: Streak, today: string): boolean => s.lastDay === today;

export type LessonCompletion = {
  readonly progress: Progress;
  readonly streakBefore: number;
  readonly streakAfter: number;
  readonly streakExtended: boolean;
  readonly lessonsToday: number;
};

export const completeLesson = (p: Progress, os: OS, lessonId: string, xp: number, today: string): LessonCompletion => {
  const track = trackFor(p, os);
  const streakBefore = currentStreak(p.streak, today);
  const alreadyToday = streakDoneToday(p.streak, today);
  const streakAfter = alreadyToday ? streakBefore : streakBefore + 1;
  const lessonsToday = (p.today.day === today ? p.today.lessons : 0) + 1;
  return {
    progress: {
      ...p,
      tracks: {
        ...p.tracks,
        [os]: {
          ...track,
          xp: track.xp + xp,
          completed: track.completed.includes(lessonId) ? track.completed : [...track.completed, lessonId],
        },
      },
      streak: { count: streakAfter, lastDay: today },
      today: { day: today, lessons: lessonsToday },
    },
    streakBefore,
    streakAfter,
    streakExtended: !alreadyToday,
    lessonsToday,
  };
};

/** The last 7 days (oldest first) and whether each had a completed lesson, given the streak. */
export const weekStrip = (s: Streak, today: string): readonly { day: string; done: boolean }[] => {
  const out: { day: string; done: boolean }[] = [];
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    const key = dayKey(dt);
    let done = false;
    if (s.lastDay !== null && s.count > 0) {
      const sinceLast = daysBetween(key, s.lastDay);
      done = sinceLast >= 0 && sinceLast < s.count;
    }
    out.push({ day: key, done });
  }
  return out;
};

/** Validate unknown JSON from storage into Progress, falling back field by field. */
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : []);

export const parseProgress = (raw: unknown): Progress => {
  if (typeof raw !== 'object' || raw === null) return emptyProgress;
  const r = raw as Record<string, unknown>;
  const isOs = (v: unknown): v is OS => v === 'linux' || v === 'mac' || v === 'windows';
  const tracks: Partial<Record<OS, Track>> = {};
  if (typeof r['tracks'] === 'object' && r['tracks'] !== null) {
    for (const [k, v] of Object.entries(r['tracks'] as Record<string, unknown>)) {
      if (!isOs(k) || typeof v !== 'object' || v === null) continue;
      const t = v as Record<string, unknown>;
      tracks[k] = {
        xp: typeof t['xp'] === 'number' ? t['xp'] : 0,
        completed: strings(t['completed']),
        unlocked: strings(t['unlocked']),
      };
    }
  }
  const s = typeof r['streak'] === 'object' && r['streak'] !== null ? (r['streak'] as Record<string, unknown>) : {};
  const t = typeof r['today'] === 'object' && r['today'] !== null ? (r['today'] as Record<string, unknown>) : {};
  const ro = typeof r['rosetta'] === 'object' && r['rosetta'] !== null ? (r['rosetta'] as Record<string, unknown>) : null;
  return {
    os: isOs(r['os']) ? r['os'] : null,
    rosetta: ro !== null && isOs(ro['know']) && isOs(ro['learn']) ? { know: ro['know'], learn: ro['learn'] } : null,
    tracks,
    streak: {
      count: typeof s['count'] === 'number' ? s['count'] : 0,
      lastDay: typeof s['lastDay'] === 'string' ? s['lastDay'] : null,
    },
    today: {
      day: typeof t['day'] === 'string' ? t['day'] : null,
      lessons: typeof t['lessons'] === 'number' ? t['lessons'] : 0,
    },
    secrets: strings(r['secrets']),
    wearing: typeof r['wearing'] === 'string' ? r['wearing'] : null,
  };
};

/** Record an easter egg. Returns the same object when it was already found. */
export const findSecret = (p: Progress, id: string): Progress => (p.secrets.includes(id) ? p : { ...p, secrets: [...p.secrets, id] });

/** "Know this already? Skip ahead": open a unit early on one OS track. */
export const unlockUnit = (p: Progress, os: OS, unitId: string): Progress => {
  const track = trackFor(p, os);
  if (track.unlocked.includes(unitId)) return p;
  return { ...p, tracks: { ...p.tracks, [os]: { ...track, unlocked: [...track.unlocked, unitId] } } };
};

/**
 * Lessons the learner may start: the first unfinished lesson overall, plus the
 * first unfinished lesson of each unit they skipped ahead to. Finished ones stay open for practice.
 */
export const playableLessons = (units: readonly { readonly id: string; readonly lessons: readonly { readonly id: string }[] }[], track: Track): readonly string[] => {
  const open: string[] = [];
  const firstOverall = units.flatMap((u) => u.lessons).find((l) => !track.completed.includes(l.id));
  if (firstOverall !== undefined) open.push(firstOverall.id);
  for (const u of units) {
    if (!track.unlocked.includes(u.id)) continue;
    const first = u.lessons.find((l) => !track.completed.includes(l.id));
    if (first !== undefined && !open.includes(first.id)) open.push(first.id);
  }
  return open;
};

/** Units fully finished on a track, in course order. Each one earns Shellby a new shell. */
export const finishedUnits = (units: readonly { readonly id: string; readonly lessons: readonly { readonly id: string }[] }[], track: Track): readonly string[] =>
  units.filter((u) => u.lessons.every((l) => track.completed.includes(l.id))).map((u) => u.id);
