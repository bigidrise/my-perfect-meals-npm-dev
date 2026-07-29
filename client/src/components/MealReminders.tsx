import { useState, useEffect, useRef } from "react";
import {
  Bell, BellOff, Plus, Trash2, Pencil, Check, X,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Smartphone, Globe,
} from "lucide-react";
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

// ── TimeRow sub-component ────────────────────────────────────────────────────

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
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          slot.enabled
            ? "bg-emerald-600 border border-emerald-400/60"
            : "bg-white/15 border border-white/30"
        } disabled:opacity-40`}
      >
        {slot.enabled ? (
          <Bell className="w-3 h-3 text-white" />
        ) : (
          <BellOff className="w-3 h-3 text-white/80" />
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
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") { setDraft(slot.label); setEditing(false); }
              }}
              maxLength={30}
              className="bg-white/10 border border-orange-400/60 rounded px-2 py-0.5 text-white text-xs w-full focus:outline-none"
            />
            <button onClick={commitLabel} className="text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setDraft(slot.label); setEditing(false); }} className="text-white/70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(slot.label); setEditing(true); }}
            className="flex items-center gap-1 group text-left"
          >
            <span className="text-white text-xs truncate">{slot.label}</span>
            <Pencil className="w-2.5 h-2.5 text-white/50 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Time picker — compact */}
      <input
        type="time"
        value={slot.time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={disabled}
        className="bg-white/10 border border-white/30 rounded-full px-3 py-[2px] text-white text-[11px] font-semibold tracking-wide focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-40 flex-shrink-0"
      />

      {/* Remove — always red so it's obvious */}
      {total > 1 && (
        <button onClick={onRemove} className="text-red-400 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MealReminders() {
  const [slots, setSlots] = useState<ReminderSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webPermission, setWebPermission] = useState<string>("default");
  const [iOSPermission, setiOSPermission] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineDiagnostic | null>(null);
  const [pipelineChecking, setPipelineChecking] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();
  const anyEnabled = slots.some((s) => s.enabled);

  async function runPipelineCheck() {
    if (isNative) return;
    setPipelineChecking(true);
    try {
      const result = await checkWebPushPipeline();
      setPipeline(result);
      setWebPermission(getWebPushPermission());
    } finally {
      setPipelineChecking(false);
    }
  }

  // Mount: load reminders + run initial pipeline check
  useEffect(() => {
    async function init() {
      try {
        const saved = await loadRemindersFromServer();
        setSlots(saved.length > 0 ? saved : getDefaultSlots());
        if (isNative) {
          setiOSPermission(await checkNotificationPermission());
        } else {
          setWebPermission(getWebPushPermission());
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

  // Re-check on tab focus (user may have changed browser settings)
  useEffect(() => {
    if (isNative) return;
    function onVisible() {
      if (document.visibilityState === "visible") runPipelineCheck();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isNative]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function persist(next: ReminderSlot[]) {
    setSaving(true);
    try {
      const saved = await saveRemindersToServer(next);
      setSlots(saved);
      if (isNative) await syncToiOS(saved);
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
          toast({ title: "Notifications blocked", description: "Allow notifications via the lock icon in your address bar, then tap Check again.", variant: "destructive" });
          return;
        }
        const result = await enrollWebPush();
        if (!result.success) {
          toast({ title: "Couldn't enable notifications", description: result.reason === "denied" ? "Permission denied." : "Try again in a moment.", variant: "destructive" });
          return;
        }
        // Re-run pipeline after enrollment
        runPipelineCheck();
      }
    }

    const next = slots.map((s, i) => i === index ? { ...s, enabled: willEnable } : s);
    if (!next.some((s) => s.enabled) && isNative) await canceliOSReminders();
    await persist(next);
  }

  function handleTimeChange(index: number, time: string) {
    const next = slots.map((s, i) => i === index ? { ...s, time } : s);
    setSlots(next);
    persist(next);
  }

  function handleLabelChange(index: number, label: string) {
    persist(slots.map((s, i) => i === index ? { ...s, label } : s));
  }

  function handleRemove(index: number) {
    if (slots.length <= 1) return;
    persist(slots.filter((_, i) => i !== index));
  }

  function handleAdd() {
    if (slots.length >= MAX_SLOTS) return;
    const n = slots.length + 1;
    const h = Math.min(6 + n * 3, 21);
    persist([...slots, { label: `Meal ${n}`, time: `${h.toString().padStart(2, "0")}:00`, enabled: false }]);
  }

  // ── Derived status ─────────────────────────────────────────────────────────

  // For web: derive a simple 3-state user status from the pipeline result
  function webStatus(): "blocked" | "unsupported" | "ready" | "partial" | "pending" {
    if (webPermission === "unsupported") return "unsupported";
    if (webPermission === "denied") return "blocked";
    if (!pipeline) return "pending";
    if (pipeline.ready) return "ready";
    // Permission granted but something else missing
    if (webPermission === "granted") return "partial";
    return "pending";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-3 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-1/2" />
      </div>
    );
  }

  const status = webStatus();
  const isBlocked = !isNative && (status === "blocked" || status === "unsupported");

  return (
    <div className="bg-white/5 rounded-xl p-3 space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-400" />
        <span className="text-white text-sm font-medium">Meal Reminders</span>
        {saving && <span className="text-white/60 text-[10px] ml-auto">Saving…</span>}
      </div>

      {/* ── Delivery channel badge ── */}
      <div className="flex items-center gap-1.5">
        {isNative ? (
          <Smartphone className="w-3 h-3 text-white/60" />
        ) : (
          <Globe className="w-3 h-3 text-white/60" />
        )}
        <span className="text-white/60 text-[11px]">
          {isNative ? "Native iOS delivery" : "Web push delivery"}
        </span>
      </div>

      {/* ── Simple user-facing status ── */}
      {!isNative && (
        <div className="flex items-center gap-2">
          {status === "ready" && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-400 text-xs font-medium">Notifications connected</span>
            </>
          )}
          {status === "partial" && (
            <>
              <XCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              <span className="text-white text-xs">Not fully connected — toggle a slot to finish setup</span>
            </>
          )}
          {status === "pending" && (
            <>
              <BellOff className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
              <span className="text-white/80 text-xs">Toggle a slot to enable notifications</span>
            </>
          )}
          {status === "blocked" && (
            <>
              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-white text-xs font-medium">Notifications blocked in browser</span>
            </>
          )}
          {status === "unsupported" && (
            <>
              <XCircle className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
              <span className="text-white/80 text-xs">Not supported by this browser</span>
            </>
          )}
        </div>
      )}

      {/* ── Blocked: instructions + check again ── */}
      {status === "blocked" && (
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <p className="text-white text-[11px] leading-relaxed font-medium">To unblock:</p>
          <ol className="text-white/80 text-[11px] leading-relaxed list-decimal list-inside space-y-0.5">
            <li>Click the <strong className="text-white">🔒 lock</strong> in your browser's address bar</li>
            <li>Set <strong className="text-white">Notifications</strong> to <strong className="text-white">Allow</strong></li>
            <li>Tap <strong className="text-white">Check again</strong> below</li>
          </ol>
          <button
            onClick={() => runPipelineCheck()}
            disabled={pipelineChecking}
            className="flex items-center gap-1.5 bg-orange-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-60"
          >
            {pipelineChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Check again
          </button>
        </div>
      )}

      {status === "unsupported" && (
        <p className="text-white/70 text-[11px] leading-relaxed">
          Try Chrome or Edge on desktop. Safari on iOS requires the app instead.
        </p>
      )}

      {/* ── Expandable connection diagnostics (for admins / debugging) ── */}
      {!isNative && pipeline && status !== "unsupported" && (
        <div>
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="flex items-center gap-1 text-white/50 text-[10px]"
          >
            {showDiagnostics ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Connection diagnostics
          </button>

          {showDiagnostics && (
            <div className="mt-2 space-y-1.5 pl-1">
              {pipeline.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  {step.ok ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className={`text-[11px] ${step.ok ? "text-white/70" : "text-white"}`}>
                      {step.label}
                    </span>
                    {!step.ok && step.detail && (
                      <span className="block text-[10px] text-white/60 leading-tight">{step.detail}</span>
                    )}
                  </div>
                </div>
              ))}
              {pipelineChecking && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-white/20 animate-spin" />
                  <span className="text-[11px] text-white/25">Checking…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Slot list ─────────────────────────────────────────────────── */}
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

      {/* Add slot */}
      {slots.length < MAX_SLOTS && (
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 text-orange-400 text-xs transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Add meal reminder
        </button>
      )}

      {/* Footer hint */}
      <p className="text-white/60 text-[10px] leading-relaxed">
        {isNative
          ? "Tap a label to rename it. Reminders are delivered through the iOS app."
          : isBlocked
          ? "Set up times now — notifications will activate once permissions are granted."
          : anyEnabled
          ? "Keep your browser open for reliable delivery."
          : "Up to 6 reminders. Tap a label to rename."}
      </p>
    </div>
  );
}
