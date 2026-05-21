// ─────────────────────────────────────────────────────────────────────────────
// MPM Calendar Link Generation — Phase 1
//
// Generates Google Calendar URLs, Outlook deep-links, and downloadable .ics
// files from a structured MPMCalendarEvent.
//
// The event schema is deliberately forward-compatible: the optional `meta`
// block carries hooks for Phase 3 pattern alerts and Phase 4 AI escalation.
// Nothing in the meta block is used in Phase 1 — it is recorded so the
// scheduling system is only ever built once.
// ─────────────────────────────────────────────────────────────────────────────

export type CalendarEventSource = "coach" | "ai" | "system";
export type CalendarEventPriority = "normal" | "warning" | "urgent";
export type CalendarEventType =
  | "checkin"
  | "followup"
  | "consultation"
  | "meal_review"
  | "accountability";

export interface MPMCalendarEvent {
  title: string;
  startAt: Date;
  durationMinutes?: number;
  description?: string;
  location?: string;

  meta?: {
    type: CalendarEventType;
    source: CalendarEventSource;
    priority: CalendarEventPriority;
    linkedMetrics?: string[];
    escalationEligible?: boolean;
    behavioralTags?: string[];
    complianceContext?: Record<string, unknown>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function endTime(event: MPMCalendarEvent): Date {
  return new Date(event.startAt.getTime() + (event.durationMinutes ?? 60) * 60_000);
}

function toGCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ── Google Calendar ───────────────────────────────────────────────────────────

export function buildGoogleCalendarUrl(event: MPMCalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGCalDate(event.startAt)}/${toGCalDate(endTime(event))}`,
    details: event.description ?? "Scheduled via My Perfect Meals.",
  });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── Outlook (Live / 365) ──────────────────────────────────────────────────────

export function buildOutlookUrl(event: MPMCalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.startAt.toISOString(),
    enddt: endTime(event).toISOString(),
    body: event.description ?? "Scheduled via My Perfect Meals.",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ── Apple / iCalendar (.ics) ──────────────────────────────────────────────────

function buildICSContent(event: MPMCalendarEvent): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${event.startAt.getTime()}-${Math.random().toString(36).slice(2)}@myperfectmeals.com`;
  const desc = (event.description ?? "Scheduled via My Perfect Meals.").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Perfect Meals//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(event.startAt)}`,
    `DTEND:${fmt(endTime(event))}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${desc}`,
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder — My Perfect Meals",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(event: MPMCalendarEvent): void {
  const blob = new Blob([buildICSContent(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
