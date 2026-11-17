/**
 * Keeps the browser's Back button inside Hermit. The app has no URLs, so without this Back
 * leaves the site from the middle of a lesson. One extra history entry stands for "somewhere
 * deeper than home"; Back pops it and the app returns home.
 */
type Win = {
  readonly history: Pick<History, 'state' | 'pushState' | 'back'>;
  addEventListener(type: 'popstate', listener: (e: PopStateEvent) => void): void;
  removeEventListener(type: 'popstate', listener: (e: PopStateEvent) => void): void;
};

const DEEP = 'hermit-deep';
const isDeep = (state: unknown): boolean => typeof state === 'object' && state !== null && (state as { hermit?: unknown }).hermit === DEEP;

export type BackGuard = {
  /** The app moved from home to a deeper screen (a lesson, or the OS picker opened from home). */
  readonly enter: () => void;
  /** The app itself went back home, so the extra entry is no longer needed. */
  readonly leave: () => void;
  /** Call `onBack` when the person presses Back while on a deeper screen. Returns an unsubscribe. */
  readonly listen: (onBack: () => void) => () => void;
};

export const createBackGuard = (win: Win): BackGuard => {
  // After a reload the entry is still there, so read it rather than assume.
  let deep = isDeep(win.history.state);
  /** Our own history.back() is in flight; its popstate is not the person's. */
  let leaving = false;
  let enterAfterLeave = false;
  const push = (): void => {
    win.history.pushState({ hermit: DEEP }, '');
    deep = true;
  };
  return {
    enter: () => {
      if (leaving) enterAfterLeave = true;
      else if (!deep) push();
    },
    leave: () => {
      enterAfterLeave = false;
      if (!deep || leaving) return;
      leaving = true;
      win.history.back();
    },
    listen: (onBack) => {
      const handler = (e: PopStateEvent): void => {
        deep = isDeep(e.state);
        if (leaving) {
          leaving = false;
          if (enterAfterLeave && !deep) push();
          enterAfterLeave = false;
          return;
        }
        if (!deep) onBack();
      };
      win.addEventListener('popstate', handler);
      return () => win.removeEventListener('popstate', handler);
    },
  };
};
