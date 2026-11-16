/** Tiny synthesized sound effects (no audio files). Muted state is a per-browser preference. */
type Tone = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const MUTE_KEY = 'hermit:muted';
let ctx: AudioContext | null = null;

export const isMuted = (): boolean => {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setMuted = (muted: boolean): void => {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
};

const play = (tones: readonly Tone[]): void => {
  if (isMuted()) return;
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    for (const t of tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type ?? 'triangle';
      osc.frequency.value = t.freq;
      const start = now + t.at;
      const peak = t.gain ?? 0.18;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + t.dur + 0.02);
    }
  } catch {
    // audio unavailable
  }
};

export const sounds = {
  correct: () =>
    play([
      { freq: 784, at: 0, dur: 0.12 },
      { freq: 1175, at: 0.09, dur: 0.22 },
    ]),
  wrong: () =>
    play([
      { freq: 220, at: 0, dur: 0.16, type: 'square', gain: 0.07 },
      { freq: 185, at: 0.12, dur: 0.22, type: 'square', gain: 0.07 },
    ]),
  select: () => play([{ freq: 660, at: 0, dur: 0.05, gain: 0.08 }]),
  complete: () =>
    play([
      { freq: 523, at: 0, dur: 0.14 },
      { freq: 659, at: 0.12, dur: 0.14 },
      { freq: 784, at: 0.24, dur: 0.14 },
      { freq: 1047, at: 0.36, dur: 0.4 },
    ]),
  streak: () =>
    play([
      { freq: 440, at: 0, dur: 0.1, type: 'sawtooth', gain: 0.06 },
      { freq: 880, at: 0.08, dur: 0.35, type: 'triangle' },
    ]),
};
