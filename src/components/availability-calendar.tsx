"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronIcon } from "@/components/icons";
import { addMonths, MONTHS_AHEAD, monthGrid, monthOf, weekdayColumns, weekStartFor, type Day, type Month } from "@/lib/availability";
import { formatCalendarDay, formatMonth, formatPrice, weekdayLabel } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import { monthQuote, nightQuote, pricesVary, type Pricing } from "@/lib/pricing";
import { groupDigits } from "@/lib/validation";

// Month calendars for rentals (docs/rental-calendar.md): the read-only one on the property page,
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
 * Read-only availability for customers on a rental's property page. Booked days are crossed out.
 * When the price changes by date (docs/rental-pricing.md), each free night shows its price, or each
 * month its price under the month name on monthly rentals.
 */
export function AvailabilityCalendar({ booked, today, pricing }: { booked: string[]; today: Day; pricing: Pricing }) {
  const t = useDict();
  const c = t.calendar;
  const bookedSet = useMemo(() => new Set(booked), [booked]);
  const vary = pricesVary(pricing, today);
  const nightPrices = vary && pricing.rentPeriod === "night";
  const cell = nightPrices ? "h-12 flex-col leading-tight" : "h-10";

  return (
    <div className="space-y-4">
      <CalendarMonths
        today={today}
        title={
          vary && pricing.rentPeriod === "month"
            ? (m, name) => (
                <>
                  {name}
                  <span className="text-xs font-semibold text-gold-deep">
                    {formatPrice(monthQuote(pricing, m).price, t.currency)} {fmt(t.per, { period: t.rentPeriod.month })}
                  </span>
                </>
              )
            : undefined
        }
        day={(d) => {
          // Past days can't be booked whatever the calendar says, so they're simply dimmed.
          if (d < today) {
            return <span className={`flex items-center justify-center text-sm text-cocoa/35 ${cell}`} aria-hidden="true">{dayNumber(d)}</span>;
          }
          const isBooked = bookedSet.has(d);
          const price = nightPrices && !isBooked ? nightQuote(pricing, d).price : null;
          const tone = isBooked ? "bg-line/70 text-cocoa/60 line-through" : "bg-success/10 font-semibold text-success-deep";
          const day = formatCalendarDay(d, t.locale);
          return (
            <span className={`flex items-center justify-center rounded-lg text-sm ${cell} ${tone} ${d === today ? TODAY_RING : ""}`}>
              <span aria-hidden="true">{dayNumber(d)}</span>
              {price !== null && (
                <span className="text-[10px] font-medium tabular-nums text-espresso/80" aria-hidden="true">
                  {groupDigits(String(price))}
                </span>
              )}
              <span className="sr-only">
                {isBooked ? fmt(c.dayBooked, { day }) : price !== null ? fmt(c.dayAvailablePrice, { day, price: formatPrice(price, t.currency) }) : fmt(c.dayAvailable, { day })}
              </span>
            </span>
          );
        }}
      />
      <CalendarLegend
        items={[
          { label: c.available, swatch: "bg-success/25" },
          { label: c.booked, swatch: "bg-line" },
          { label: c.today, swatch: TODAY_RING },
        ]}
      />
    </div>
  );
}
