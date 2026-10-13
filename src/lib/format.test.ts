import { describe, expect, it } from "vitest";
import { floorText, formatCalendarDay, formatMonth, weekdayLabel } from "./format";
import ar from "./i18n/ar";
import en from "./i18n/en";

describe("floorText", () => {
  it("calls floor 0 the ground floor", () => {
    expect(floorText(en, 0)).toBe("Ground floor");
    expect(floorText(ar, 0)).toBe("الطابق الأرضي");
  });

  it("numbers every other floor", () => {
    expect(floorText(en, 3)).toBe("Floor 3");
    expect(floorText(en, 45)).toBe("Floor 45");
    expect(floorText(ar, 3)).toBe("الطابق 3");
  });
});

describe("calendar formatting", () => {
  it("names the month", () => {
    expect(formatMonth("2026-10", "en")).toBe("October 2026");
    expect(formatMonth("2026-10", "ar")).toBe("أكتوبر 2026");
  });

  it("formats a calendar day without shifting it by time zone", () => {
    expect(formatCalendarDay("2026-10-13", "en")).toBe("Tue, 13 Oct 2026");
    expect(formatCalendarDay("2027-01-01", "en")).toBe("Fri, 1 Jan 2027");
    expect(formatCalendarDay("2026-10-13", "ar")).toContain("13 أكتوبر 2026");
  });

  it("labels weekday columns, short in English and one letter in Arabic", () => {
    expect([0, 1, 6].map((w) => weekdayLabel(w, "en"))).toEqual(["Sun", "Mon", "Sat"]);
    expect([6, 0, 5].map((w) => weekdayLabel(w, "ar"))).toEqual(["س", "ح", "ج"]);
  });
});
