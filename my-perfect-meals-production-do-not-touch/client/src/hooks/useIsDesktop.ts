import { useEffect, useState } from 'react';

export function useIsDesktop(min = 1024) {
  const [is, setIs] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= min : false);
  
  useEffect(() => {
    const onResize = () => setIs(window.innerWidth >= min);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [min]);
  
  return is;
}