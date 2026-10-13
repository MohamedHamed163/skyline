import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  applyRange,
  bookedIn,
  cairoToday,
  daysBetween,
  isDay,
  lastBookableDay,
  monthGrid,
  weekdayColumns,
  weekStartFor,
} from "./availability";

const TODAY = "2026-10-13";

describe("isDay", () => {
  it("accepts real days in YYYY-MM-DD form", () => {
    expect(isDay("2026-10-13")).toBe(true);
    expect(isDay("2028-02-29")).toBe(true);
  });

  it("rejects impossible days and other shapes", () => {
    for (const v of ["2026-02-29", "2026-13-01", "2026-10-32", "2026-1-5", "2026-10-13T00:00", "", 20261013, null, undefined]) {
      expect(isDay(v)).toBe(false);
    }
  });
});

describe("day and month arithmetic", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("adds and subtracts months", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });

  it("lists every day in a range, in order, whichever way round it is given", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daysBetween("2026-11-02", "2026-10-30")).toEqual(daysBetween("2026-10-30", "2026-11-02"));
    expect(daysBetween(TODAY, TODAY)).toEqual([TODAY]);
  });
});

describe("cairoToday", () => {
  it("uses the date in Cairo, not UTC", () => {
    // Cairo is UTC+2 in winter: 22:30 UTC is already the next day there.
    expect(cairoToday(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-16");
    expect(cairoToday(new Date("2026-01-15T21:59:00Z"))).toBe("2026-01-15");
  });
});

describe("lastBookableDay", () => {
  it("is the end of the month 12 months ahead", () => {
    expect(lastBookableDay(TODAY)).toBe("2027-10-31");
    expect(lastBookableDay("2026-01-31")).toBe("2027-01-31");
    expect(lastBookableDay("2027-02-01")).toBe("2028-02-29");
  });
});

describe("applyRange", () => {
  it("books every day of a range, sorted and without duplicates", () => {
    expect(applyRange(["2026-10-25", "2026-10-20"], "2026-10-21", "2026-10-19", true, TODAY)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-25",
    ]);
  });

  it("frees a range and keeps the other booked days", () => {
    expect(applyRange(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-25"], "2026-10-20", "2026-10-30", false, TODAY)).toEqual(["2026-10-19"]);
  });

  it("drops days that are already past", () => {
    expect(applyRange(["2026-10-01", "2026-10-12", TODAY], "2026-11-01", "2026-11-01", true, TODAY)).toEqual([TODAY, "2026-11-01"]);
  });

  it("clips a range that starts in the past to today", () => {
    expect(applyRange([], "2026-10-11", "2026-10-14", true, TODAY)).toEqual([TODAY, "2026-10-14"]);
  });

  it("clips a range that runs past the booking horizon", () => {
    expect(applyRange([], "2027-10-30", "2027-11-05", true, TODAY)).toEqual(["2027-10-30", "2027-10-31"]);
  });

  it("ignores ranges entirely outside today … horizon", () => {
    expect(applyRange(["2026-10-20"], "2026-09-01", "2026-09-30", true, TODAY)).toEqual(["2026-10-20"]);
    expect(applyRange(["2026-10-20"], "2030-01-01", "2030-01-05", true, TODAY)).toEqual(["2026-10-20"]);
  });
});

describe("bookedIn", () => {
  it("counts the booked days inside a range", () => {
    const booked = new Set(["2026-10-19", "2026-10-21", "2026-11-01"]);
    expect(bookedIn(booked, "2026-10-18", "2026-10-22")).toBe(2);
    expect(bookedIn(booked, "2026-10-22", "2026-10-30")).toBe(0);
  });
});

describe("monthGrid", () => {
  it("pads the first week to the week start and fills whole weeks", () => {
    // 1 October 2026 is a Thursday.
    const sunday = monthGrid("2026-10", 0);
    expect(sunday.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(sunday.filter(Boolean)).toHaveLength(31);
    // 4 blanks + 31 days end exactly on a Saturday: five full weeks.
    expect(sunday).toHaveLength(35);
    expect(sunday.at(-1)).toBe("2026-10-31");

    const saturday = monthGrid("2026-10", 6);
    expect(saturday.indexOf("2026-10-01")).toBe(5);
    // 5 blanks + 31 days spill into a sixth week, padded with blanks.
    expect(saturday).toHaveLength(42);
    expect(saturday.slice(36)).toEqual([null, null, null, null, null, null]);
  });

  it("needs no padding when the month starts on the week start", () => {
    // 1 February 2026 is a Sunday and the month has exactly four weeks.
    const grid = monthGrid("2026-02", 0);
    expect(grid).toHaveLength(28);
    expect(grid[0]).toBe("2026-02-01");
    expect(grid.at(-1)).toBe("2026-02-28");
  });

  it("starts weeks on Saturday in Arabic and Sunday in English", () => {
    expect(weekStartFor("ar")).toBe(6);
    expect(weekStartFor("en")).toBe(0);
    expect(weekdayColumns(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(weekdayColumns(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
