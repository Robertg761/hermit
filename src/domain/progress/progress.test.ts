import { describe, expect, it } from 'vitest';
import { completeLesson, currentStreak, emptyProgress, parseProgress, streakLost, trackFor, weekStrip } from './progress';

describe('progress', () => {
  it('awards XP per OS and records the lesson once', () => {
    let p = completeLesson(emptyProgress, 'linux', 'u1-l1', 85, '2026-11-16').progress;
    p = completeLesson(p, 'linux', 'u1-l1', 60, '2026-11-16').progress;
    expect(trackFor(p, 'linux')).toEqual({ xp: 145, completed: ['u1-l1'] });
    expect(trackFor(p, 'windows').xp).toBe(0);
  });
  it('starts and extends a streak once per day', () => {
    const a = completeLesson(emptyProgress, 'linux', 'a', 10, '2026-11-16');
    expect(a.streakAfter).toBe(1);
    expect(a.streakExtended).toBe(true);
    const b = completeLesson(a.progress, 'linux', 'b', 10, '2026-11-16');
    expect(b.streakAfter).toBe(1);
    expect(b.streakExtended).toBe(false);
    expect(b.lessonsToday).toBe(2);
    const c = completeLesson(b.progress, 'linux', 'c', 10, '2026-11-17');
    expect(c.streakAfter).toBe(2);
    expect(c.lessonsToday).toBe(1);
  });
  it('breaks the streak after a missed day', () => {
    const a = completeLesson(emptyProgress, 'linux', 'a', 10, '2026-11-16').progress;
    expect(currentStreak(a.streak, '2026-11-17')).toBe(1);
    expect(currentStreak(a.streak, '2026-11-18')).toBe(0);
    expect(streakLost(a.streak, '2026-11-18')).toBe(true);
    expect(completeLesson(a, 'linux', 'b', 10, '2026-11-19').streakAfter).toBe(1);
  });
  it('handles month boundaries', () => {
    const a = completeLesson(emptyProgress, 'mac', 'a', 10, '2026-11-30').progress;
    expect(completeLesson(a, 'mac', 'b', 10, '2026-12-01').streakAfter).toBe(2);
  });
  it('draws a week strip', () => {
    const p = completeLesson(completeLesson(emptyProgress, 'linux', 'a', 1, '2026-11-15').progress, 'linux', 'b', 1, '2026-11-16').progress;
    const strip = weekStrip(p.streak, '2026-11-16');
    expect(strip.map((d) => d.done)).toEqual([false, false, false, false, false, true, true]);
  });
  it('parses stored JSON defensively', () => {
    expect(parseProgress(null)).toEqual(emptyProgress);
    const p = parseProgress({ os: 'linux', tracks: { linux: { xp: 120, completed: ['u1-l1', 3] }, bogus: {} }, streak: { count: 1, lastDay: '2026-11-16' } });
    expect(p.os).toBe('linux');
    expect(p.tracks.linux).toEqual({ xp: 120, completed: ['u1-l1'] });
    expect(p.streak.count).toBe(1);
  });
});
