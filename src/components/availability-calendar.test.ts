import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { bookingMessage, bookingRental, type Stay } from "@/lib/booking";
import ar from "@/lib/i18n/ar";
import { DictProvider } from "@/lib/i18n/client";
import en, { type Dict } from "@/lib/i18n/en";
import { AvailabilityCalendar, BookingSummary } from "./availability-calendar";

// Picking a stay on the property page's calendar and asking on WhatsApp (docs/booking-requests.md),
// as static HTML. Clicking needs a browser; the rules behind it are tested in src/lib/booking.test.ts.

// Tuesday 13 October 2026.
const TODAY = "2026-10-13";
const rental = bookingRental(makeProperty({ code: "VILLA12", title: "Sea view villa", purpose: "rent", price: 3000 }));

const render = (el: ReactElement, dict: Dict = en) => renderToStaticMarkup(h(DictProvider, { dict, children: el }));
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const summary = (stay: Stay | null, dict: Dict = en) => unescape(render(h(BookingSummary, { rental, stay, onClear: () => {} }), dict));

describe("AvailabilityCalendar day picking", () => {
  const html = render(h(AvailabilityCalendar, { booked: ["2026-10-16"], today: TODAY, rental }));

  it("makes free days from today clickable and booked days not", () => {
    expect(html).toMatch(/<button type="button" aria-pressed="false" class="[^"]*"><span aria-hidden="true">14<\/span><span class="sr-only">Wed, 14 Oct 2026, available</);
    expect(html).toMatch(/<button type="button" disabled="" aria-pressed="false" class="[^"]*"><span aria-hidden="true">16<\/span><span class="sr-only">Fri, 16 Oct 2026, booked</);
  });

  it("keeps past days as plain dimmed numbers", () => {
    expect(html).not.toContain("Mon, 12 Oct 2026");
  });

  it("starts with the booking bar asking for a check-in day and the WhatsApp button off", () => {
    expect(html).toContain(en.booking.pickCheckIn);
    expect(html).toContain(en.booking.yourStay);
    expect(html).not.toContain("wa.me");
  });
});

describe("BookingSummary", () => {
  it("asks for check-in, with the WhatsApp button disabled and nothing to clear", () => {
    const html = summary(null);
    expect(html).toContain(en.booking.pickCheckIn);
    expect(html).toMatch(/<button type="button" disabled="" class="[^"]*">.*Ask on WhatsApp<\/button>/);
    expect(html).not.toContain(en.booking.clear);
  });

  it("shows check-in and asks for check-out once the first day is picked", () => {
    const html = summary({ checkIn: "2026-10-14", checkOut: null });
    expect(html).toContain("Wed, 14 Oct 2026");
    expect(html).toContain(en.booking.pickCheckOut);
    expect(html).toContain(en.booking.clear);
    expect(html).not.toContain("wa.me");
  });

  it("shows the nights and total and links to WhatsApp with the booking message once both days are picked", () => {
    const html = summary({ checkIn: "2026-10-14", checkOut: "2026-10-17" });
    expect(html).toContain("Sat, 17 Oct 2026");
    expect(html).toContain(">3</dd>");
    expect(html).toContain("9,000 EGP");
    expect(html).toContain(en.booking.ready);
    const href = html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)![1];
    expect(new URL(href).searchParams.get("text")).toBe(bookingMessage(en, rental, "2026-10-14", "2026-10-17"));
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it("totals a month-long stay night by night", () => {
    const html = summary({ checkIn: "2026-10-20", checkOut: "2026-11-19" });
    expect(html).toContain(">30</dd>");
    expect(html).toContain(">90,000 EGP</dd>");
    expect(new URL(html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)![1]).searchParams.get("text")).toContain("Total price: 90,000 EGP");
  });

  it("is translated on the Arabic site", () => {
    const html = summary({ checkIn: "2026-10-14", checkOut: "2026-10-17" }, ar);
    expect(html).toContain(ar.booking.ask);
    expect(html).toContain("9,000 ج.م");
    const href = html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)![1];
    expect(new URL(href).searchParams.get("text")).toBe(bookingMessage(ar, rental, "2026-10-14", "2026-10-17"));
  });
});
