import { useRef } from "react";
import type { WeekBoard } from "@/lib/boardApi";

export interface WeekBoardCache {
  getWeek: (weekISO: string) => WeekBoard | null | undefined;
  setWeek: (weekISO: string, data: WeekBoard | null) => void;
  invalidateWeeks: (weekISOs: string[]) => void;
}

export function useWeekBoardCache(): WeekBoardCache {
  const cache = useRef<Record<string, WeekBoard | null>>({});

  const getWeek = (weekISO: string): WeekBoard | null | undefined =>
    cache.current[weekISO];

  const setWeek = (weekISO: string, data: WeekBoard | null): void => {
    cache.current[weekISO] = data;
  };

  const invalidateWeeks = (weekISOs: string[]): void => {
    weekISOs.forEach((w) => delete cache.current[w]);
  };

  return { getWeek, setWeek, invalidateWeeks };
}
