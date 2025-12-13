import { useMemo } from 'react';

export function useSearch() {
  const usp = useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
  return usp;
}