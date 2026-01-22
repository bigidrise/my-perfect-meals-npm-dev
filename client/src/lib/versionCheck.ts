// Version checking utilities for app update detection

export interface VersionInfo {
  version: string;
  builtAt: string;
  minSupported: string;
  changelogUrl?: string;
}

export interface VersionCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  remoteInfo: VersionInfo | null;
}

// Get current app version from environment variable
// This is injected at build time
export function getCurrentVersion(): string {
  return import.meta.env.VITE_APP_VERSION || '1.0.7+dev';
}

// Fetch the latest version info from server
export async function fetchLatestVersion(): Promise<VersionInfo | null> {
  try {
    // Add timestamp to bust iOS Safari aggressive caching in PWAs
    const cacheBuster = Date.now();
    const response = await fetch(`/version.json?t=${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch version.json:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching version info:', error);
    return null;
  }
}

// Compare version strings (basic comparison)
// Format: "1.0.0+2025.10.21.abc1234"
export function isNewerVersion(current: string, remote: string): boolean {
  if (current === remote) return false;
  
  // Extract base version (before +)
  const currentBase = current.split('+')[0];
  const remoteBase = remote.split('+')[0];
  
  // If base versions differ, compare them
  if (currentBase !== remoteBase) {
    return compareSemanticVersion(currentBase, remoteBase) > 0;
  }
  
  // Same base version, compare build date/hash
  // If they're different, assume remote is newer
  return current !== remote;
}

// Compare semantic versions (1.0.0 vs 1.0.1)
function compareSemanticVersion(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (bPart > aPart) return 1; // b is newer
    if (bPart < aPart) return -1; // a is newer
  }
  
  return 0; // equal
}

// Check if current version meets minimum supported version
export function meetsMinimumVersion(current: string, minSupported?: string): boolean {
  if (!current || !minSupported) return true; // No minimum specified = passes
  
  const currentBase = current.split('+')[0];
  const minBase = minSupported.split('+')[0];
  
  // Current version should be >= minimum supported version
  return compareSemanticVersion(currentBase, minBase) >= 0;
}

// Main version check function
export async function checkForUpdates(): Promise<VersionCheckResult> {
  const currentVersion = getCurrentVersion();
  const remoteInfo = await fetchLatestVersion();
  
  if (!remoteInfo) {
    return {
      updateAvailable: false,
      forceUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      remoteInfo: null
    };
  }
  
  const updateAvailable = isNewerVersion(currentVersion, remoteInfo.version);
  const forceUpdate = !meetsMinimumVersion(currentVersion, remoteInfo.minSupported);
  
  return {
    updateAvailable,
    forceUpdate,
    currentVersion,
    latestVersion: remoteInfo.version,
    remoteInfo
  };
}
