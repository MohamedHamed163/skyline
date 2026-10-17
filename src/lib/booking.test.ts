import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import {
  BOOKING_WHATSAPP,
  bookingHref,
  bookingMessage,
  bookingRental,
  canPick,
  lastCheckOut,
  pickDay,
  stayNights,
  stayTotal,
  type Rental,
} from "./booking";
import ar from "./i18n/ar";
import en from "./i18n/en";

// Tuesday 13 October 2026. The calendar's last day is 31 October 2027.
const TODAY = "2026-10-13";
const LAST = "2027-10-31";

const nightly = (o: Partial<Rental> = {}): Rental => ({
  ...bookingRental(makeProperty({ code: "VILLA12", title: "Sea view villa", purpose: "rent", rentPeriod: "night", price: 3000 })),
  ...o,
});
const monthly = (o: Partial<Rental> = {}): Rental => nightly({ rentPeriod: "month", price: 25_000, ...o });

describe("bookingRental", () => {
  it("keeps only the price fields, code and title, so the seller never reaches the browser", () => {
    const p = makeProperty({ purpose: "rent", rentPeriod: "night", weekendPrice: 4500, adminNotes: "call after 5" });
    expect(bookingRental(p)).toEqual({
      code: p.code,
      title: p.title,
      purpose: "rent",
      rentPeriod: "night",
      price: p.price,
      weekendPrice: 4500,
      priceRules: [],
    });
  });
});

describe("stayNights", () => {
  it("counts the nights from check-in to the night before check-out", () => {
    expect(stayNights("2026-10-18", "2026-10-22")).toEqual(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(stayNights("2026-10-31", "2026-11-01")).toEqual(["2026-10-31"]);
  });

  it("has no nights when check-out isn't after check-in", () => {
    expect(stayNights("2026-10-18", "2026-10-18")).toEqual([]);
    expect(stayNights("2026-10-18", "2026-10-15")).toEqual([]);
  });
});

describe("lastCheckOut", () => {
  const booked = new Set(["2026-10-14", "2026-10-20", "2026-10-25"]);

  it("is the next booked day: the guest leaves the day the next one arrives", () => {
    expect(lastCheckOut(booked, "2026-10-15", TODAY)).toBe("2026-10-20");
    expect(lastCheckOut(booked, "2026-10-21", TODAY)).toBe("2026-10-25");
  });

  it("is the calendar's last day when nothing after check-in is booked", () => {
    expect(lastCheckOut(booked, "2026-10-26", TODAY)).toBe(LAST);
    expect(lastCheckOut(new Set(), TODAY, TODAY)).toBe(LAST);
  });
});

describe("canPick and pickDay", () => {
  const booked = new Set(["2026-10-20", "2026-10-21", "2026-10-25"]);
  const can = (stay: Parameters<typeof canPick>[0], day: string) => canPick(stay, day, booked, TODAY);
  const pick = (stay: Parameters<typeof pickDay>[0], day: string) => pickDay(stay, day, booked, TODAY);

  it("offers any free day from today as check-in, but not past, booked or the calendar's last day", () => {
    expect(can(null, TODAY)).toBe(true);
    expect(can(null, "2026-10-19")).toBe(true);
    expect(can(null, "2026-10-12")).toBe(false);
    expect(can(null, "2026-10-20")).toBe(false);
    expect(can(null, "2027-10-30")).toBe(true);
    expect(can(null, LAST)).toBe(false);
  });

  it("picks check-in first, then check-out", () => {
    const stay = pick(null, "2026-10-15");
    expect(stay).toEqual({ checkIn: "2026-10-15", checkOut: null });
    expect(pick(stay, "2026-10-18")).toEqual({ checkIn: "2026-10-15", checkOut: "2026-10-18" });
  });

  it("lets the stay end on the next booked day, but not run past it", () => {
    const stay = { checkIn: "2026-10-15", checkOut: null };
    expect(can(stay, "2026-10-20")).toBe(true);
    expect(pick(stay, "2026-10-20")).toEqual({ checkIn: "2026-10-15", checkOut: "2026-10-20" });
    // The 21st is booked and beyond the next arrival.
    expect(can(stay, "2026-10-21")).toBe(false);
  });

  it("starts again from an earlier day or a free day past the next booked one", () => {
    const stay = { checkIn: "2026-10-15", checkOut: null };
    expect(pick(stay, "2026-10-14")).toEqual({ checkIn: "2026-10-14", checkOut: null });
    expect(pick(stay, "2026-10-22")).toEqual({ checkIn: "2026-10-22", checkOut: null });
  });

  it("clears the stay when check-in is clicked again", () => {
    expect(pick({ checkIn: "2026-10-15", checkOut: null }, "2026-10-15")).toBeNull();
  });

  it("starts a new stay on the next click once both days are picked", () => {
    const stay = { checkIn: "2026-10-15", checkOut: "2026-10-18" };
    expect(pick(stay, "2026-10-16")).toEqual({ checkIn: "2026-10-16", checkOut: null });
    // A booked day can no longer be clicked once the stay is complete.
    expect(can(stay, "2026-10-20")).toBe(false);
  });

  it("can end on the calendar's last day", () => {
    const stay = { checkIn: "2027-10-28", checkOut: null };
    expect(can(stay, LAST)).toBe(true);
    expect(pick(stay, LAST)).toEqual({ checkIn: "2027-10-28", checkOut: LAST });
  });
});

describe("stayTotal", () => {
  it("adds up each night of a nightly rental", () => {
    expect(stayTotal(nightly(), "2026-10-18", "2026-10-21")).toBe(9000);
  });

  it("charges the weekend price on Thursday and Friday nights", () => {
    // Wed 14 – Sun 18 October: Wed 3,000 + Thu 4,500 + Fri 4,500 + Sat 3,000.
    expect(stayTotal(nightly({ weekendPrice: 4500 }), "2026-10-14", "2026-10-18")).toBe(15_000);
  });

  it("charges special prices on the nights they cover", () => {
    const rental = nightly({ priceRules: [{ from: "2026-11-01", to: "2026-11-30", price: 2000, weekendPrice: null }] });
    // Sat 31 October at the standard price, then 1 and 2 November at the special one.
    expect(stayTotal(rental, "2026-10-31", "2026-11-03")).toBe(7000);
  });

  it("prices a rental without a rent period by the night", () => {
    expect(stayTotal(nightly({ rentPeriod: null }), "2026-10-18", "2026-10-20")).toBe(6000);
  });

  it("has no total for a monthly rental", () => {
    expect(stayTotal(monthly(), "2026-10-18", "2026-11-18")).toBeNull();
  });
});

describe("bookingMessage and bookingHref", () => {
  it("writes the code, dates, nights and total in English", () => {
    expect(bookingMessage(en, nightly({ weekendPrice: 4500 }), "2026-10-14", "2026-10-18")).toBe(
      [
        "Hi, I'm interested in the following booking:",
        "Property: VILLA12 – Sea view villa",
        "Check-in: Wed, 14 Oct 2026",
        "Check-out: Sun, 18 Oct 2026",
        "Total nights: 4",
        "Total price: 15,000 EGP",
        "Is it available on these dates?",
      ].join("\n"),
    );
  });

  it("leaves the total out for a monthly rental", () => {
    expect(bookingMessage(en, monthly(), "2026-10-20", "2026-11-19")).toBe(
      [
        "Hi, I'm interested in the following booking:",
        "Property: VILLA12 – Sea view villa",
        "Check-in: Tue, 20 Oct 2026",
        "Check-out: Thu, 19 Nov 2026",
        "Total nights: 30",
        "Is it available on these dates?",
      ].join("\n"),
    );
  });

  it("writes it in Arabic on the Arabic site", () => {
    const lines = bookingMessage(ar, nightly(), "2026-10-14", "2026-10-16").split("\n");
    expect(lines[0]).toBe(ar.booking.message.greeting);
    expect(lines[1]).toBe("العقار: VILLA12 – Sea view villa");
    expect(lines[4]).toBe("عدد الليالي: 2");
    expect(lines[5]).toBe("السعر الإجمالي: 6,000 ج.م");
    expect(lines[6]).toBe(ar.booking.message.question);
  });

  it("opens WhatsApp to Skyline's booking number with the message typed", () => {
    expect(BOOKING_WHATSAPP).toBe("0109 990 0149");
    const url = new URL(bookingHref(en, nightly(), "2026-10-14", "2026-10-16"));
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/201099900149");
    expect(url.searchParams.get("text")).toBe(bookingMessage(en, nightly(), "2026-10-14", "2026-10-16"));
  });
});
