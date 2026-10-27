import { describe, expect, it } from "vitest";
import { addDays, endOfMonth, matchPreset, parseRange, presetRange, toVnYmd, vnDayRange, weekdayVi } from "@/lib/dates";

describe("dates (Asia/Ho_Chi_Minh)", () => {
  it("uses the Vietnam calendar day, not UTC", () => {
    expect(toVnYmd(new Date("2026-10-25T17:30:00Z"))).toBe("2026-10-26");
    expect(toVnYmd(new Date("2026-10-25T16:59:59Z"))).toBe("2026-10-25");
  });
  it("builds half-open UTC ranges for Vietnam days", () => {
    const r = vnDayRange("2026-10-26", "2026-10-26");
    expect(r.gte.toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });
  it("handles month ends and weekdays", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(weekdayVi("2026-10-26")).toBe("Thứ Hai");
  });
  it("computes presets", () => {
    expect(presetRange("next7", "2026-10-26")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(presetRange("lastMonth", "2026-10-26")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(matchPreset("2026-10-01", "2026-10-31", "2026-10-26")).toBe("thisMonth");
  });
  it("parses query ranges defensively", () => {
    expect(parseRange(undefined, undefined, null)).toBeNull();
    expect(parseRange("2026-10-31", "2026-10-01", null)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseRange("2026-10-05", undefined, null)).toEqual({ from: "2026-10-05", to: "2026-10-05" });
    expect(parseRange("nope", "2026-13-40", { from: "2026-10-26", to: "2026-10-26" })).toEqual({ from: "2026-10-26", to: "2026-10-26" });
    expect(parseRange("2026-01-01", "2028-01-01", null)?.to).toBe("2027-01-01");
  });
});
