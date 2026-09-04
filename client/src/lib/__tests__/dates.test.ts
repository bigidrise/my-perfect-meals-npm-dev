import { addCalendarDays, localYYYYMMDD } from "../../utils/dates";

describe("local calendar dates", () => {
  it("keeps Chicago on Thursday when UTC is already Friday", () => {
    expect(localYYYYMMDD(
      new Date("2026-09-04T01:30:00.000Z"),
      "America/Chicago",
    )).toBe("2026-09-03");
  });

  it("resolves today in the authoritative timezone", () => {
    const instant = new Date("2026-09-04T01:30:00.000Z");
    expect(localYYYYMMDD(instant, "America/Chicago")).toBe("2026-09-03");
    expect(localYYYYMMDD(instant, "UTC")).toBe("2026-09-04");
  });

  it("maps Sunday through Saturday to their own calendar dates", () => {
    expect(Array.from({ length: 7 }, (_, index) => addCalendarDays("2026-08-30", index)))
      .toEqual([
        "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02",
        "2026-09-03", "2026-09-04", "2026-09-05",
      ]);
  });

  it("crosses Saturday/Sunday and month boundaries without shifting", () => {
    expect(addCalendarDays("2026-09-05", 1)).toBe("2026-09-06");
    expect(addCalendarDays("2026-08-30", -1)).toBe("2026-08-29");
  });

  it("keeps dates stable across Chicago DST transitions", () => {
    expect(localYYYYMMDD(new Date("2026-03-08T07:30:00.000Z"), "America/Chicago"))
      .toBe("2026-03-08");
    expect(localYYYYMMDD(new Date("2026-11-01T06:30:00.000Z"), "America/Chicago"))
      .toBe("2026-11-01");
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addCalendarDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});