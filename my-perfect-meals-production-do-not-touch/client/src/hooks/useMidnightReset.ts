import { useEffect, useRef } from 'react';
import { msUntilNextMidnight, todayISOInTZ } from '@/utils/midnight';

export function useMidnightReset(tz: string, onMidnight: () => void) {
  const tzRef = useRef(tz);
  tzRef.current = tz;

  useEffect(() => {
    // run now if we crossed a day while app was closed
    onMidnightIfDayChanged();

    let id = window.setTimeout(tick, msUntilNextMidnight(tzRef.current));
    function tick() {
      onMidnight();
      id = window.setTimeout(tick, msUntilNextMidnight(tzRef.current)); // schedule next day
    }
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz]);

  function onMidnightIfDayChanged() {
    const key = 'lastDailyResetISO';
    const last = localStorage.getItem(key);
    const today = todayISOInTZ(tzRef.current);
    if (last !== today) {
      onMidnight();
      localStorage.setItem(key, today);
    }
  }
}