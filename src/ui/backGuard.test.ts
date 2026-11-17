import { describe, expect, it } from 'vitest';
import { createBackGuard } from './backGuard';

/** A tiny stand-in for the browser's session history. `back()` is async there, so `flush` delivers it. */
const fakeWindow = (initial: unknown = null) => {
  const stack: unknown[] = [initial];
  let index = 0;
  let listener: ((e: PopStateEvent) => void) | null = null;
  const pending: (() => void)[] = [];
  const pop = (): void => {
    if (index === 0) return;
    index -= 1;
    listener?.({ state: stack[index] } as PopStateEvent);
  };
  return {
    win: {
      history: {
        get state() {
          return stack[index];
        },
        pushState: (state: unknown) => {
          stack.splice(index + 1);
          stack.push(state);
          index += 1;
        },
        back: () => {
          pending.push(pop);
        },
      },
      addEventListener: (_: 'popstate', l: (e: PopStateEvent) => void) => {
        listener = l;
      },
      removeEventListener: () => {
        listener = null;
      },
    },
    /** The person presses Back. */
    pressBack: pop,
    flush: () => {
      while (pending.length > 0) pending.shift()?.();
    },
    depth: () => index,
  };
};

describe('back guard', () => {
  it('Back inside a lesson returns home instead of leaving the site', () => {
    const f = fakeWindow();
    const guard = createBackGuard(f.win);
    let backs = 0;
    guard.listen(() => (backs += 1));
    guard.enter();
    expect(f.depth()).toBe(1);
    f.pressBack();
    expect(backs).toBe(1);
    expect(f.depth()).toBe(0);
  });
  it('moving between deep screens adds no extra entries', () => {
    const f = fakeWindow();
    const guard = createBackGuard(f.win);
    guard.listen(() => undefined);
    guard.enter();
    guard.enter();
    guard.enter();
    expect(f.depth()).toBe(1);
  });
  it('going home through the app removes the entry without reporting a Back press', () => {
    const f = fakeWindow();
    const guard = createBackGuard(f.win);
    let backs = 0;
    guard.listen(() => (backs += 1));
    guard.enter();
    guard.leave();
    f.flush();
    expect(f.depth()).toBe(0);
    expect(backs).toBe(0);
    guard.enter();
    expect(f.depth()).toBe(1);
  });
  it('entering again before the leave has landed still ends one entry deep', () => {
    const f = fakeWindow();
    const guard = createBackGuard(f.win);
    let backs = 0;
    guard.listen(() => (backs += 1));
    guard.enter();
    guard.leave();
    guard.enter();
    f.flush();
    expect(f.depth()).toBe(1);
    expect(backs).toBe(0);
    f.pressBack();
    expect(backs).toBe(1);
  });
  it('picks up the entry that survives a reload', () => {
    const f = fakeWindow();
    createBackGuard(f.win).enter();
    const reloaded = createBackGuard(f.win);
    let backs = 0;
    reloaded.listen(() => (backs += 1));
    reloaded.enter();
    expect(f.depth()).toBe(1);
    f.pressBack();
    expect(backs).toBe(1);
  });
});
