
export function bustImageCache(imagePath: string): string {
  // Add a timestamp query parameter to bust the cache
  const timestamp = Date.now();
  const separator = imagePath.includes('?') ? '&' : '?';
  return `${imagePath}${separator}v=${timestamp}`;
}
