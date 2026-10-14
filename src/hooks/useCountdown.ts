import { useEffect, useMemo, useState } from "react";

export interface Countdown {
  past: boolean;
  d: number;
  h: number;
  m: number;
  s: number;
}

export function useCountdown(targetISO: string): Countdown {
  const target = useMemo(() => new Date(targetISO).getTime(), [targetISO]);

  const calc = (): Countdown => {
    const diff = target - Date.now();
    if (diff <= 0) return { past: true, d: 0, h: 0, m: 0, s: 0 };
    return {
      past: false,
      d: Math.floor(diff / 86_400_000),
      h: Math.floor((diff / 3_600_000) % 24),
      m: Math.floor((diff / 60_000) % 60),
      s: Math.floor((diff / 1000) % 60),
    };
  };

  const [t, setT] = useState<Countdown>(calc);
  useEffect(() => {
    const id = window.setInterval(() => setT(calc()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return t;
}
