export function canonicalName(name: string): string {
  let clean = name.toLowerCase().trim();

  // Remove common descriptors
  const descriptors = [
    'organic', 'boneless', 'skinless', 'plain', 'shaved', 
    'grilled', 'cooked', 'fresh', 'chopped', 'diced', 'halved', 'sliced',
    'optional', 'small', 'medium', 'large', 'lean', 'baked'
  ];

  for (const desc of descriptors) {
    clean = clean.replace(new RegExp(`\\b${desc}\\b`, 'gi'), '').trim();
  }

  // Plural → singular normalization
  if (clean === "egg whites" || clean === "egg white") clean = "egg white";
  if (clean === "eggs" || clean === "egg") clean = "egg";
  if (clean === "berries" || clean === "berry") clean = "berry";
  if (clean === "mixed berries") clean = "berry";

  // Normalize common variations
  if (clean.includes('chicken')) clean = 'chicken breast';
  if (clean.includes('greek yogurt') || clean === 'yogurt') clean = 'greek yogurt';
  if (clean.includes('broccoli')) clean = 'broccoli';

  // Title case
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}