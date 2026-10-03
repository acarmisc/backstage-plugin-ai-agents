import { useEffect, useState } from 'react';

/**
 * A ticking clock hook that updates at the specified interval.
 * Returns the current time in milliseconds since epoch.
 * A clock is information, not animation, so it keeps ticking under reduced motion.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;

    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
