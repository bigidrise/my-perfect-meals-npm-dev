export function onPageHide(callback: () => void) {
  const handler = () => { 
    if (document.visibilityState !== "visible") callback(); 
  };
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("pagehide", callback);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("pagehide", callback);
  };
}