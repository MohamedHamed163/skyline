"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronIcon, WhatsAppIcon } from "@/components/icons";
import { addMonths, MONTHS_AHEAD, monthGrid, monthOf, weekdayColumns, weekStartFor, type Day, type Month } from "@/lib/availability";
import { bookingHref, canPick, pickDay, stayNights, stayTotal, type Rental, type Stay } from "@/lib/booking";
import { formatCalendarDay, formatMonth, formatPrice, weekdayLabel } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import { nightQuote, pricesVary } from "@/lib/pricing";
import { groupDigits } from "@/lib/validation";

// Month calendars for rentals (docs/rental-calendar.md): the customers' one on the property page,
// and the building blocks the admin booking calendar (booking-calendar.tsx) shares with it.

export const dayNumber = (day: Day) => Number(day.slice(8));

const NAV_BUTTON =
  "absolute top-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-espresso hover:bg-ivory disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * Two months side by side (one on phones), from the current month up to MONTHS_AHEAD months
 * ahead, with previous / next buttons. `day` renders each date's cell; `title`, if given, renders
 * each month's heading from its name (the admin price calendar makes it a button).
 */
export function CalendarMonths({ today, day, title }: { today: Day; day: (d: Day) => ReactNode; title?: (m: Month, name: string) => ReactNode }) {
  const t = useDict().calendar;
  const [offset, setOffset] = useState(0);
  const first = monthOf(today);
  const months = [addMonths(first, offset), ...(offset < MONTHS_AHEAD ? [addMonths(first, offset + 1)] : [])];
  const next = (max: number, className: string) => (
    <button
      type="button"
      onClick={() => setOffset((o) => Math.min(o + 1, max))}
      disabled={offset >= max}
      aria-label={t.nextMonth}
      className={`${NAV_BUTTON} end-0 ${className}`}
    >
      <ChevronIcon className="rtl:rotate-180" />
    </button>
  );

  return (
    <div className="relative">
      <button type="button" onClick={() => setOffset((o) => Math.max(o - 1, 0))} disabled={offset === 0} aria-label={t.prevMonth} className={`${NAV_BUTTON} start-0`}>
        <ChevronIcon className="rotate-180 rtl:rotate-0" />
      </button>
      {/* Phones show one month and can page to the last; wider screens show two, so stop one earlier. */}
      {next(MONTHS_AHEAD, "sm:hidden")}
      {next(MONTHS_AHEAD - 1, "hidden sm:flex")}
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {months.map((m, i) => (
          <MonthView key={m} month={m} day={day} title={title} className={i ? "hidden sm:block" : undefined} />
        ))}
      </div>
    </div>
  );
}

function MonthView({ month, day, title, className }: { month: Month; day: (d: Day) => ReactNode; title?: (m: Month, name: string) => ReactNode; className?: string }) {
  const { locale } = useDict();
  const weekStart = weekStartFor(locale);
  const name = formatMonth(month, locale);
  return (
    <div className={className}>
      <h3 className="flex min-h-8 flex-col items-center justify-center text-sm font-bold">{title ? title(month, name) : name}</h3>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {weekdayColumns(weekStart).map((w) => (
          <span key={w} className="pb-1 text-xs font-medium text-cocoa" aria-hidden="true">
            {weekdayLabel(w, locale)}
          </span>
        ))}
        {monthGrid(month, weekStart).map((d, i) => (d ? <Fragment key={d}>{day(d)}</Fragment> : <span key={`blank-${i}`} aria-hidden="true" />))}
      </div>
    </div>
  );
}

/** Colour key under a calendar. */
export function CalendarLegend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cocoa">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={`h-3.5 w-3.5 rounded ${item.swatch}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

const TODAY_RING = "ring-1 ring-inset ring-gold-dark";

/**
 * Availability for customers on a rental's property page. Booked days are crossed out. When the
 * price changes by date (docs/rental-pricing.md), each free night shows its price. Customers click a
 * check-in and a check-out day to see the nights and total and ask Skyline about them on WhatsApp
 * (docs/booking-requests.md).
 */
export function AvailabilityCalendar({ booked, today, rental }: { booked: string[]; today: Day; rental: Rental }) {
  const t = useDict();
  const c = t.calendar;
  const bookedSet = useMemo(() => new Set(booked), [booked]);
  const [stay, setStay] = useState<Stay | null>(null);
  const [hover, setHover] = useState<Day | null>(null);
  const nightPrices = pricesVary(rental, today);
  const cell = nightPrices ? "h-12 flex-col leading-tight" : "h-10";

  // The stay's days, check-out included. While check-out is being picked, the hovered day previews it.
  const end = stay && (stay.checkOut ?? (hover && hover > stay.checkIn && canPick(stay, hover, bookedSet, today) ? hover : stay.checkIn));
  const clear = () => {
    setStay(null);
    setHover(null);
  };

  return (
    <div
      className="space-y-4"
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") clear();
      }}
    >
      <CalendarMonths
        today={today}
        day={(d) => {
          // Past days can't be booked whatever the calendar says, so they're simply dimmed.
          if (d < today) {
            return <span className={`flex items-center justify-center text-sm text-cocoa/35 ${cell}`} aria-hidden="true">{dayNumber(d)}</span>;
          }
          const isBooked = bookedSet.has(d);
          const price = nightPrices && !isBooked ? nightQuote(rental, d).price : null;
          const edge = stay && (d === stay.checkIn || d === end);
          const inStay = Boolean(stay && end && d > stay.checkIn && d < end);
          const tone = edge
            ? "bg-gold font-bold text-espresso"
            : inStay
              ? "bg-gold/50 font-semibold text-espresso"
              : isBooked
                ? "bg-line/70 text-cocoa/60 line-through"
                : "bg-success/10 font-semibold text-success-deep hover:bg-success/25";
          const day = formatCalendarDay(d, t.locale);
          return (
            <button
              type="button"
              onClick={() => setStay(pickDay(stay, d, bookedSet, today))}
              onMouseEnter={() => setHover(d)}
              disabled={!canPick(stay, d, bookedSet, today)}
              aria-pressed={Boolean(edge || inStay)}
              className={`flex cursor-pointer items-center justify-center rounded-lg text-sm transition-colors disabled:cursor-default ${cell} ${tone} ${d === today && !edge ? TODAY_RING : ""}`}
            >
              <span aria-hidden="true">{dayNumber(d)}</span>
              {price !== null && (
                <span className="text-[10px] font-medium tabular-nums text-espresso/80" aria-hidden="true">
                  {groupDigits(String(price))}
                </span>
              )}
              <span className="sr-only">
                {isBooked ? fmt(c.dayBooked, { day }) : price !== null ? fmt(c.dayAvailablePrice, { day, price: formatPrice(price, t.currency) }) : fmt(c.dayAvailable, { day })}
              </span>
            </button>
          );
        }}
      />
      <CalendarLegend
        items={[
          { label: c.available, swatch: "bg-success/25" },
          { label: c.booked, swatch: "bg-line" },
          { label: c.today, swatch: TODAY_RING },
          { label: t.booking.yourStay, swatch: "bg-gold" },
        ]}
      />
      <BookingSummary rental={rental} stay={stay} onClear={clear} />
    </div>
  );
}

/**
 * The bar under the property page's calendar: the stay picked so far, its nights and total, and the
 * button that opens WhatsApp with the booking message (docs/booking-requests.md).
 */
export function BookingSummary({ rental, stay, onClear }: { rental: Rental; stay: Stay | null; onClear: () => void }) {
  const t = useDict();
  const b = t.booking;
  const complete = stay?.checkOut ? { checkIn: stay.checkIn, checkOut: stay.checkOut } : null;
  const value = (text: string | null) => (text ? <dd className="font-semibold text-espresso">{text}</dd> : <dd className="text-cocoa/70">{b.pickDay}</dd>);
  const whatsappClass = "btn btn-sm bg-success text-deep hover:bg-success-dark";

  return (
    <div className="space-y-3 rounded-xl bg-ivory p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-cocoa">{b.checkIn}</dt>
          {value(stay && formatCalendarDay(stay.checkIn, t.locale))}
        </div>
        <div>
          <dt className="text-xs text-cocoa">{b.checkOut}</dt>
          {value(complete && formatCalendarDay(complete.checkOut, t.locale))}
        </div>
        <div>
          <dt className="text-xs text-cocoa">{b.nights}</dt>
          {complete ? <dd className="font-semibold text-espresso">{stayNights(complete.checkIn, complete.checkOut).length}</dd> : <dd className="text-cocoa/70">–</dd>}
        </div>
        <div>
          <dt className="text-xs text-cocoa">{b.total}</dt>
          {complete ? <dd className="font-bold text-espresso">{formatPrice(stayTotal(rental, complete.checkIn, complete.checkOut), t.currency)}</dd> : <dd className="text-cocoa/70">–</dd>}
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <p className="text-xs text-cocoa" role="status">
          {complete ? b.ready : stay ? b.pickCheckOut : b.pickCheckIn}
        </p>
        <div className="ms-auto flex flex-wrap gap-2">
          {stay && (
            <button type="button" onClick={onClear} className="btn-sm cursor-pointer font-semibold text-cocoa hover:text-espresso">
              {b.clear}
            </button>
          )}
          {complete ? (
            <a href={bookingHref(t, rental, complete.checkIn, complete.checkOut)} target="_blank" rel="noopener noreferrer" className={whatsappClass}>
              <WhatsAppIcon /> {b.ask}
            </a>
          ) : (
            <button type="button" disabled className={whatsappClass}>
              <WhatsAppIcon /> {b.ask}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
