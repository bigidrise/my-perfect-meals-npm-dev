import { Capacitor } from '@capacitor/core';

let WebViewCache: any = null;

async function loadWebViewCachePlugin() {
  if (WebViewCache) return WebViewCache;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const module = await import('capacitor-plugin-webview-cache-extended');
      WebViewCache = module.WebViewCache;
      return WebViewCache;
    } catch (e) {
      console.warn('[WebViewCache] Plugin not available:', e);
      return null;
    }
  }
  return null;
}

export async function clearWebViewCache(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[WebViewCache] Not on native platform, skipping cache clear');
    return false;
  }

  try {
    const plugin = await loadWebViewCachePlugin();
    if (!plugin) {
      console.warn('[WebViewCache] Plugin not loaded');
      return false;
    }

    console.log('[WebViewCache] Clearing WKWebView cache...');
    await plugin.clearCache();
    console.log('[WebViewCache] Cache cleared successfully');
    return true;
  } catch (error) {
    console.error('[WebViewCache] Failed to clear cache:', error);
    return false;
  }
}

export async function setNoCacheMode(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const plugin = await loadWebViewCachePlugin();
    if (!plugin) {
      return false;
    }

    const { WebViewCacheMode } = await import('capacitor-plugin-webview-cache-extended');
    await plugin.setCacheMode({ mode: WebViewCacheMode.LOAD_NO_CACHE });
    console.log('[WebViewCache] Set to LOAD_NO_CACHE mode');
    return true;
  } catch (error) {
    console.error('[WebViewCache] Failed to set cache mode:', error);
    return false;
  }
}

export async function forceReloadWithCacheClear(): Promise<void> {
  console.log('[WebViewCache] Force reloading with cache clear...');
  
  await clearWebViewCache();
  
  localStorage.removeItem('sw-cache-cleared');
  
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[WebViewCache] Browser caches cleared');
    } catch (e) {
      console.warn('[WebViewCache] Failed to clear browser caches:', e);
    }
  }

  window.location.reload();
}
