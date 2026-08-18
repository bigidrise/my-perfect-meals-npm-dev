import { Capacitor } from "@capacitor/core";

export interface ReminderSlot {
  id?: string;
  label: string;
  time: string;
  enabled: boolean;
}

const MAX_SLOTS = 6;
const VAPID_PUBLIC_KEY = 'BOX8GMIv1Y8E14t5Vc9elEjswXS-N-xvRVjqUsV2dGQwyXH0yyXvVUD94nyocUyG-V8f2Gdj4tfVzYaxKNHybqg';

// ── SERVER API ───────────────────────────────────────────────────────────────

export async function loadRemindersFromServer(): Promise<ReminderSlot[]> {
  try {
    const res = await fetch('/api/user/reminders', { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.slots || []).map((s: any) => ({
      id: s.id,
      label: s.label,
      time: s.time,
      enabled: s.enabled,
    }));
  } catch {
    return getDefaultSlots();
  }
}

export async function saveRemindersToServer(slots: ReminderSlot[]): Promise<ReminderSlot[]> {
  const res = await fetch('/api/user/reminders', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.slots || []).map((s: any) => ({ id: s.id, label: s.label, time: s.time, enabled: s.enabled }));
}

export function getDefaultSlots(): ReminderSlot[] {
  return [
    { label: 'Meal 1', time: '08:00', enabled: false },
    { label: 'Meal 2', time: '13:00', enabled: false },
    { label: 'Meal 3', time: '18:00', enabled: false },
  ];
}

export { MAX_SLOTS };

// ── iOS CAPACITOR MIRROR ─────────────────────────────────────────────────────

let LocalNotificationsModule: any = null;

async function getLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    if (!LocalNotificationsModule) {
      const mod = await import("@capacitor/local-notifications");
      LocalNotificationsModule = mod.LocalNotifications;
    }
    return LocalNotificationsModule;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const LN = await getLocalNotifications();
  if (!LN) return false;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display === 'granted') return true;
    const req = await LN.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  const LN = await getLocalNotifications();
  if (!LN) return false;
  try {
    const perm = await LN.checkPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

export async function syncToiOS(slots: ReminderSlot[]): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;

  try {
    const pending = await LN.getPending();
    if (pending.notifications.length > 0) {
      await LN.cancel({ notifications: pending.notifications.map((n: any) => ({ id: n.id })) });
    }
  } catch { /* ignore cancel errors */ }

  const enabled = slots.filter((s) => s.enabled);
  if (enabled.length === 0) return;

  const notifications = enabled.map((slot, i) => {
    const [hour, minute] = slot.time.split(':').map(Number);
    return {
      id: 2000 + i,
      title: `🍽️ ${slot.label}`,
      body: `Time for ${slot.label}. Tap to open My Perfect Meals.`,
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      sound: 'default',
      extra: { route: '/hub' },
    };
  });

  try {
    await LN.schedule({ notifications });
  } catch (e) {
    console.warn('[iOS reminders] schedule failed:', e);
  }
}

export async function canceliOSReminders(): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length > 0) {
      await LN.cancel({ notifications: pending.notifications.map((n: any) => ({ id: n.id })) });
    }
  } catch { /* ignore */ }
}

// ── WEB PUSH ENROLLMENT ──────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type WebPushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function getWebPushPermission(): WebPushPermission {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return Notification.permission as WebPushPermission;
}

export async function enrollWebPush(): Promise<{ success: boolean; reason?: string }> {
  if (getWebPushPermission() === 'unsupported') return { success: false, reason: 'unsupported' };
  if (getWebPushPermission() === 'denied') return { success: false, reason: 'denied' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { success: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const subscription = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    if (!res.ok) return { success: false, reason: 'server_error' };
    return { success: true };
  } catch (e: any) {
    console.error('[webpush] enrollment error:', e);
    return { success: false, reason: e.message };
  }
}

// ── PIPELINE DIAGNOSTIC ──────────────────────────────────────────────────────

export interface PipelineStep {
  label: string;
  ok: boolean | null; // null = not applicable / skipped
  detail?: string;
}

export interface PipelineDiagnostic {
  steps: PipelineStep[];
  ready: boolean; // true only if ALL applicable steps pass
}

export async function checkWebPushPipeline(): Promise<PipelineDiagnostic> {
  const steps: PipelineStep[] = [];

  // Step 1 — API support
  const supported = ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
  steps.push({ label: 'Browser supports push', ok: supported });
  if (!supported) return { steps, ready: false };

  // Step 2 — Permission
  const perm = Notification.permission;
  steps.push({
    label: 'Notification permission',
    ok: perm === 'granted',
    detail: perm === 'denied' ? 'Denied — open browser site settings to allow' :
            perm === 'default' ? 'Not yet asked — toggle a slot to enable' : 'Granted',
  });
  if (perm !== 'granted') return { steps, ready: false };

  // Step 3 — Service worker
  let swOk = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    swOk = !!(reg && reg.active);
    steps.push({ label: 'Service worker active', ok: swOk, detail: swOk ? undefined : 'Try refreshing the page' });
  } catch {
    steps.push({ label: 'Service worker active', ok: false, detail: 'Could not check' });
  }
  if (!swOk) return { steps, ready: false };

  // Step 4 — Push subscription
  let subOk = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    subOk = !!sub;
    steps.push({ label: 'Push subscription registered', ok: subOk, detail: subOk ? undefined : 'Toggle a slot to subscribe' });
  } catch {
    steps.push({ label: 'Push subscription registered', ok: false, detail: 'Could not check' });
  }

  return { steps, ready: subOk };
}

// ── NOTIFICATION LISTENER (iOS tap handler) ───────────────────────────────────

export function setupNotificationListeners(navigate: (path: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let cleanup: (() => void) | null = null;
  getLocalNotifications().then((LN) => {
    if (!LN) return;
    LN.addListener('localNotificationActionPerformed', (n: any) => {
      const route = n?.notification?.extra?.route;
      if (route) navigate(route);
    }).then((listener: { remove: () => void }) => {
      cleanup = () => listener.remove();
    });
  });
  return () => { if (cleanup) cleanup(); };
}
