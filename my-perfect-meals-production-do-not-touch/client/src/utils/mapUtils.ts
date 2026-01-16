export function getMapUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    return `maps://maps.apple.com/?q=${encodedAddress}`;
  }
  
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

export function openInMaps(address: string): void {
  const url = getMapUrl(address);
  window.open(url, '_blank');
}

export async function copyAddressToClipboard(address: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(address);
    return true;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = address;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  }
}
