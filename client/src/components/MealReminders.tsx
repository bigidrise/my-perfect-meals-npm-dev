import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, Plus, Trash2, Pencil, Check, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  loadRemindersFromServer,
  saveRemindersToServer,
  syncToiOS,
  canceliOSReminders,
  requestNotificationPermission,
  checkNotificationPermission,
  enrollWebPush,
  getWebPushPermission,
  checkWebPushPipeline,
  getDefaultSlots,
  ReminderSlot,
  PipelineDiagnostic,
  MAX_SLOTS,
  setupNotificationListeners,
} from "@/services/mealReminderService";
import { useToast } from "@/hooks/use-toast";

function isBlockedPermission(permission: string): boolean {
  return permission === "unsupported" || permission === "denied";
}

function TimeRow({
  slot,
  index,
  total,
  disabled,
  onToggle,
  onTimeChange,
  onLabelChange,
  onRemove,
}: {
  slot: ReminderSlot;
  index: number;
  total: number;
  disabled: boolean;
  onToggle: () => void;
  onTimeChange: (t: string) => void;
  onLabelChange: (l: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slot.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitLabel() {
    const trimmed = draft.trim() || `Meal ${index + 1}`;
    onLabelChange(trimmed);
    setDraft(trimmed);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/10 last:border-b-0">
      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={slot.enabled}
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          slot.enabled
            ? "bg-emerald-600/80 border border-emerald-400/40"
            : "bg-white/10 border border-white/20"
        } disabled:opacity-40`}
      >
        {slot.enabled ? (
          <Bell className="w-3 h-3 text-white" />
        ) : (
          <BellOff className="w-3 h-3 text-white/50" />
        )}
      </button>

      {/* Label */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") { setDraft(slot.label); setEditing(false); } }}
              maxLength={30}
              className="bg-white/10 border border-orange-400/40 rounded px-2 py-0.5 text-white text-xs w-full focus:outline-none"
            />
            <button onClick={commitLabel} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setDraft(slot.label); setEditing(false); }} className="text-white/40 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(slot.label); setEditing(true); }}
            className="flex items-center gap-1 group text-left"
          >
            <span className="text-white text-xs truncate">{slot.label}</span>
            <Pencil className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Time picker */}
      <input
        type="time"
        value={slot.time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={disabled}
        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-40 flex-shrink-0"
      />

      {/* Remove (only if more than 1 slot) */}
      {total > 1 && (
        <button onClick={onRemove} className="text-white/20 hover:text-red-400 flex-shrink-0 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function MealReminders() {
  const [slots, setSlots] = useState<ReminderSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webPermission, setWebPermission] = useState<string>("default");
  const [iOSPermission, setiOSPermission] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineDiagnostic | null>(null);
  const [pipelineChecking, setPipelineChecking] = useState(false);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();
  const anyEnabled = slots.some((s) => s.enabled);

  async function runPipelineCheck() {
    if (isNative) return;
    setPipelineChecking(true);
    try {
      const result = await checkWebPushPipeline();
      setPipeline(result);
    } finally {
      setPipelineChecking(false);
    }
  }

  // Load schedule from server on mount
  useEffect(() => {
    async function init() {
      try {
        const saved = await loadRemindersFromServer();
        setSlots(saved.length > 0 ? saved : getDefaultSlots());
        if (isNative) {
          setiOSPermission(await checkNotificationPermission());
        } else {
          const perm = getWebPushPermission();
          setWebPermission(perm);
          // Run full chain check on mount so users immediately see where they stand
          const result = await checkWebPushPipeline();
          setPipeline(result);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isNative]);

  // iOS tap-to-route listener
  useEffect(() => {
    if (!isNative) return;
    const cleanup = setupNotificationListeners((path) => {
      window.location.href = path;
    });
    return cleanup;
  }, [isNative]);

  // Re-check permission + full pipeline when user returns to this tab
  useEffect(() => {
    if (isNative) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        const perm = getWebPushPermission();
        setWebPermission(perm);
        runPipelineCheck();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isNative]);

  function recheckPermission() {
    const perm = getWebPushPermission();
    setWebPermission(perm);
    runPipelineCheck();
  }

  async function persist(next: ReminderSlot[]) {
    setSaving(true);
    try {
      const saved = await saveRemindersToServer(next);
      setSlots(saved);
      if (isNative) {
        await syncToiOS(saved);
      }
    } catch (e) {
      console.error("[MealReminders] save failed:", e);
      toast({ title: "Couldn't save reminders", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSlot(index: number) {
    const slot = slots[index];
    const willEnable = !slot.enabled;

    // Permission gate
    if (willEnable) {
      if (isNative) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          toast({
            title: "Notifications blocked",
            description: "Go to iPhone Settings › My Perfect Meals › Allow Notifications",
            variant: "destructive",
          });
          return;
        }
        setiOSPermission(true);
      } else {
        const perm = getWebPushPermission();
        if (perm === "unsupported") {
          toast({ title: "Not supported", description: "This browser doesn't support push notifications.", variant: "destructive" });
          return;
        }
        if (perm === "denied") {
          toast({ title: "Notifications blocked", description: "Allow notifications in your browser's site settings, then try again.", variant: "destructive" });
          return;
        }
        // Enroll web push
        const result = await enrollWebPush();
        if (!result.success) {
          toast({ title: "Couldn't enable notifications", description: result.reason === "denied" ? "Permission was denied." : "Try again in a moment.", variant: "destructive" });
          return;
        }
        setWebPermission("granted");
      }
    }

    const next = slots.map((s, i) => i === index ? { ...s, enabled: willEnable } : s);

    // If disabling all, cancel iOS local notifications too
    if (!next.some((s) => s.enabled) && isNative) {
      await canceliOSReminders();
    }

    await persist(next);
  }

  function handleTimeChange(index: number, time: string) {
    const next = slots.map((s, i) => i === index ? { ...s, time } : s);
    setSlots(next);
    persist(next);
  }

  function handleLabelChange(index: number, label: string) {
    const next = slots.map((s, i) => i === index ? { ...s, label } : s);
    persist(next);
  }

  function handleRemove(index: number) {
    if (slots.length <= 1) return;
    const next = slots.filter((_, i) => i !== index);
    persist(next);
  }

  function handleAdd() {
    if (slots.length >= MAX_SLOTS) return;
    const n = slots.length + 1;
    const defaultHour = 6 + n * 3;
    const h = Math.min(defaultHour, 21);
    const time = `${h.toString().padStart(2, "0")}:00`;
    const next = [...slots, { label: `Meal ${n}`, time, enabled: false }];
    persist(next);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-3 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-1/2" />
      </div>
    );
  }

  const webBlocked = !isNative && isBlockedPermission(webPermission);

  return (
    <div className="bg-white/5 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-400" />
        <span className="text-white text-sm font-medium">Meal Reminders</span>
        {saving && <span className="text-white/30 text-[10px] ml-auto">Saving…</span>}
      </div>

      {/* Blocked / unsupported state */}
      {webBlocked ? (
        <div className="space-y-2">
          {webPermission === "unsupported" ? (
            <p className="text-white/50 text-xs leading-relaxed">
              Push notifications aren't supported by this browser. Try Chrome or Edge on desktop.
            </p>
          ) : (
            <>
              <p className="text-white/50 text-xs leading-relaxed">
                Notifications are blocked for this site. To fix it:
              </p>
              <ol className="text-white/40 text-[11px] leading-relaxed list-decimal list-inside space-y-0.5">
                <li>Click the <strong className="text-white/60">lock icon</strong> (🔒) in your browser's address bar</li>
                <li>Find <strong className="text-white/60">Notifications</strong> and set it to <strong className="text-white/60">Allow</strong></li>
                <li>Tap <strong className="text-white/60">Check again</strong> below — no reload needed</li>
              </ol>
              <button
                onClick={recheckPermission}
                disabled={pipelineChecking}
                className="mt-1 flex items-center gap-1.5 bg-orange-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-60"
              >
                {pipelineChecking && <Loader2 className="w-3 h-3 animate-spin" />}
                Check again
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Pipeline status chain — shown when permission is not blocked */}
          {!isNative && pipeline && (
            <div className="space-y-1 pb-1 border-b border-white/10">
              {pipeline.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  {step.ok ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className={`text-[11px] ${step.ok ? "text-white/50" : "text-white/70"}`}>{step.label}</span>
                    {step.detail && !step.ok && (
                      <span className="block text-[10px] text-white/30 leading-tight">{step.detail}</span>
                    )}
                  </div>
                </div>
              ))}
              {pipelineChecking && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-white/20 animate-spin" />
                  <span className="text-[11px] text-white/30">Checking…</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Slot list — shown regardless of pipeline state (lets user set times before enabling) */}
      {!webBlocked && (
        <>
          {/* Slots */}
          <div>
            {slots.map((slot, i) => (
              <TimeRow
                key={slot.id || i}
                slot={slot}
                index={i}
                total={slots.length}
                disabled={saving}
                onToggle={() => handleToggleSlot(i)}
                onTimeChange={(t) => handleTimeChange(i, t)}
                onLabelChange={(l) => handleLabelChange(i, l)}
                onRemove={() => handleRemove(i)}
              />
            ))}
          </div>

          {/* Add button */}
          {slots.length < MAX_SLOTS && (
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 text-orange-400 text-xs hover:text-orange-300 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Add meal reminder
            </button>
          )}

          {/* Help text */}
          <p className="text-white/30 text-[10px] leading-relaxed">
            {isNative
              ? "Reminders are delivered through the My Perfect Meals app. Tap a label to rename it."
              : anyEnabled
              ? "Reminders are sent as browser notifications. Keep your browser running for reliable delivery."
              : "Toggle a slot to enable reminders. You can have up to 6."}
          </p>
        </>
      )}
    </div>
  );
}
