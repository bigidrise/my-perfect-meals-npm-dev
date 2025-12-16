let loaded = false;

export function loadRewardful(publicKey: string) {
  if (loaded || !publicKey) return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.defer = true;
  s.src = "https://r.wdfl.co/rw.js";
  s.setAttribute("data-rewardful", publicKey);
  document.head.appendChild(s);
}

/**
 * Optional helper for reading the rf cookie if you want to surface it in UI/debug.
 */
export function getRewardfulRef(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)rw_ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
