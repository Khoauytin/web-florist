import { describe, expect, it } from "vitest";
import { addDays, endOfMonth, parseRange, presetRange, toVnYmd, vnDayRange, weekdayVi } from "@/lib/dates";

describe("dates (Asia/Ho_Chi_Minh)", () => {
  it("uses the Vietnam calendar day, not UTC", () => {
    expect(toVnYmd(new Date("2026-10-26T17:30:00Z"))).toBe("2026-10-27");
    expect(toVnYmd(new Date("2026-10-26T16:59:59Z"))).toBe("2026-10-26");
  });
  it("builds half-open UTC ranges for Vietnam days", () => {
    const r = vnDayRange("2026-10-27", "2026-10-27");
    expect(r.gte.toISOString()).toBe("2026-10-26T17:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });
  it("handles month ends and weekdays", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(weekdayVi("2026-10-27")).toBe("Thứ Ba");
  });
  it("computes presets and parses ranges defensively", () => {
    expect(presetRange("next7", "2026-10-27")).toEqual({ from: "2026-10-27", to: "2026-11-02" });
    expect(parseRange("2026-10-31", "2026-10-01", null)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseRange("nope", undefined, null)).toBeNull();
  });
});
