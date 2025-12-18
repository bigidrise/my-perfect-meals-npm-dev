import html2canvas from 'html2canvas';

export async function captureElementPng(selectorOrEl: string|HTMLElement, background='#ffffff'): Promise<string|undefined> {
  const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) as HTMLElement : selectorOrEl;
  if (!el) return;
  const canvas = await html2canvas(el, { backgroundColor: background, scale: 2, useCORS: true });
  return canvas.toDataURL('image/png');
}