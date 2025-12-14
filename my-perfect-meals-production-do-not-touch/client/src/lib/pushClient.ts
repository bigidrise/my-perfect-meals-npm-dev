// Base64 URL-safe decoding for VAPID key
function b64ToU8(b64: string) {
  const p = "=".repeat((4 - b64.length % 4) % 4);
  const s = (b64 + p).replace(/-/g, "+").replace(/_/g, "/");
  const d = atob(s); 
  const a = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) {
    a[i] = d.charCodeAt(i);
  }
  return a;
}

export async function registerForPush(userId: string) {
  try {
    // Check if service worker and push manager are supported
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications not supported in this browser");
    }

    // Register service worker
    const reg = await navigator.serviceWorker.register("/sw.js");
    console.log("✅ Service Worker registered");

    // ============================================
    // FORCE UPDATE FLOW (Mobile PWA Cache Purge)
    // ============================================
    
    // Force check for updates
    await reg.update();
    console.log("🔄 Checked for Service Worker updates");

    // If a new SW is waiting, activate it immediately and reload
    if (reg.waiting) {
      console.log("⏳ New Service Worker waiting, activating now...");
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload once the new SW takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log("🔄 New Service Worker activated, reloading page...");
        window.location.reload();
      }, { once: true });
      
      return; // Exit early, page will reload
    }

    // Listen for future updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW is installed and waiting
          console.log("⏳ New Service Worker installed, activating...");
          newWorker.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload when it takes control
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log("🔄 New Service Worker activated, reloading page...");
            window.location.reload();
          }, { once: true });
        }
      });
    });

    // Request notification permission
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      throw new Error("Notifications denied by user");
    }
    console.log("✅ Notification permission granted");

    // Subscribe to push notifications
    const vapidPublicKey = (import.meta.env as any).VITE_VAPID_PUBLIC_KEY as string;
    if (!vapidPublicKey) {
      throw new Error("VITE_VAPID_PUBLIC_KEY not configured");
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(vapidPublicKey),
    });
    console.log("✅ Push subscription created");

    // Send subscription to backend
    const apiBaseUrl = (import.meta.env as any).VITE_API_BASE_URL || "";
    const response = await fetch(`${apiBaseUrl}/api/notify/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register push subscription: ${response.statusText}`);
    }

    console.log("✅ Push subscription registered with server");
    return sub;

  } catch (error) {
    console.error("❌ Push registration failed:", error);
    throw error;
  }
}

export async function checkPushSupport() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushPermissionStatus() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}