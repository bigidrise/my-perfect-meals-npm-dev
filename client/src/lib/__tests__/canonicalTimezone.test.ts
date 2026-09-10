import {
  SUPPORTED_TIMEZONES,
  timezoneLabel,
} from "@/components/CanonicalTimezonePrompt";

describe("canonical timezone choices", () => {
  it("uses stable US labels for the bounded choices", () => {
    expect(SUPPORTED_TIMEZONES).toEqual([
      { timezone: "America/New_York", label: "Eastern Time" },
      { timezone: "America/Chicago", label: "Central Time" },
      { timezone: "America/Denver", label: "Mountain Time" },
      { timezone: "America/Los_Angeles", label: "Pacific Time" },
    ]);
  });

  it("does not localize or append changing DST names to labels", () => {
    expect(timezoneLabel("America/New_York")).toBe("Eastern Time");
    expect(timezoneLabel("America/Phoenix")).toBe("Mountain Time");
    expect(timezoneLabel("Europe/London")).toBe("Europe/London");
  });
});