import { useEffect, useState } from 'react';

/** Counts from 0 up to `to` over `ms` milliseconds. */
export function CountUp({ to, ms = 900, prefix = '', suffix = '' }: { to: number; ms?: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number): void => {
      const k = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return (
    <>
      {prefix}
      {n}
      {suffix}
    </>
  );
}
