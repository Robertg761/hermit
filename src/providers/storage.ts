import { emptyProgress, parseProgress, type Progress } from '../domain/progress/progress';

export type ProgressStore = {
  readonly load: () => Progress;
  readonly save: (p: Progress) => void;
};

const KEY = 'hermit:v1';

/** localStorage-backed store. If storage is unavailable, progress lives in memory for the session. */
export const createLocalStore = (): ProgressStore => {
  let memory: Progress = emptyProgress;
  return {
    load: () => {
      try {
        const raw = window.localStorage.getItem(KEY);
        memory = raw === null ? emptyProgress : parseProgress(JSON.parse(raw));
      } catch {
        // keep in-memory progress
      }
      return memory;
    },
    save: (p) => {
      memory = p;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(p));
      } catch {
        // storage full or blocked: progress stays in memory
      }
    },
  };
};
