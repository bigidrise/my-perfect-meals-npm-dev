import { getRolling14Days, getRolling7Days } from "../../client/src/utils/dateRange";

describe("Add to Plan presentation horizons", () => {
  test("mobile uses Today plus the next six canonical dates", () => {
    expect(getRolling7Days("2026-09-19")).toEqual([
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
  });

  test("desktop retains the existing 14-day horizon", () => {
    const dates = getRolling14Days("2026-09-19");
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-09-19");
    expect(dates[13]).toBe("2026-10-02");
  });
});