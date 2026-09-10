export const SUPPORTED_TIMEZONES = [
  { timezone: "America/New_York", label: "Eastern Time" },
  { timezone: "America/Chicago", label: "Central Time" },
  { timezone: "America/Denver", label: "Mountain Time" },
  { timezone: "America/Los_Angeles", label: "Pacific Time" },
] as const;

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Detroit": "Eastern Time",
  "America/Indiana/Indianapolis": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Indiana/Knox": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Mountain Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii-Aleutian Time",
};

export function timezoneLabel(timezone: string): string {
  return TIMEZONE_LABELS[timezone] ?? timezone;
}