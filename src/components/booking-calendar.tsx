"use client";

import { useState, useTransition } from "react";
import { CalendarLegend, CalendarMonths, dayNumber } from "@/components/availability-calendar";
import { setBookedDays } from "@/lib/actions";
import { applyRange, bookedIn, daysBetween, lastBookableDay, type Day } from "@/lib/availability";
import { formatCalendarDay } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import { withFallback } from "@/lib/safe-action";

const ordered = (a: Day, b: Day): [Day, Day] => (a <= b ? [a, b] : [b, a]);

/**
 * Admin booking calendar for a rental (docs/rental-calendar.md). Click a day, or a first and a last
 * day, then mark the selection booked or available. Each change is saved straight away.
 */
export function BookingCalendar({ propertyId, bookedDates, today }: { propertyId: string; bookedDates: string[]; today: Day }) {
  const t = useDict();
  const c = t.admin.calendar;
  const [booked, setBooked] = useState(bookedDates);
  // The first day clicked, and the last once picked. While the last is missing, the hovered day previews the range.
  const [selection, setSelection] = useState<{ start: Day; end: Day | null } | null>(null);
  const [hover, setHover] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const last = lastBookableDay(today);
  const bookedSet = new Set(booked);
  const chosen = selection && ordered(selection.start, selection.end ?? selection.start);
  const preview = selection && ordered(selection.start, selection.end ?? hover ?? selection.start);
  const upcoming = booked.filter((d) => d >= today).length;

  const pick = (d: Day) => {
    setError(null);
    setSelection((s) => (s && !s.end ? { start: s.start, end: d } : { start: d, end: null }));
  };

  const clear = () => {
    setSelection(null);
    setHover(null);
  };

  const apply = (isBooked: boolean) => {
    if (!chosen) return;
    const [from, to] = chosen;
    const before = booked;
    // Show the change at once; the saved list from the server replaces it, or the old one comes back on failure.
    setBooked(applyRange(before, from, to, isBooked, today));
    clear();
    setError(null);
    startTransition(async () => {
      const result = await withFallback(() => setBookedDays(propertyId, from, to, isBooked), { ok: false, message: t.msg.actionFailed });
      if (result.ok) {
        setBooked(result.days);
      } else {
        setBooked(before);
        setError(result.message);
      }
    });
  };

  let summary = null;
  if (chosen) {
    const [from, to] = chosen;
    const count = daysBetween(from, to).length;
    const alreadyBooked = bookedIn(bookedSet, from, to);
    summary = (
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ivory p-3">
        <p className="text-sm">
          <span className="text-cocoa">{c.selected}: </span>
          <span className="font-semibold">
            {from === to ? formatCalendarDay(from, t.locale) : `${formatCalendarDay(from, t.locale)} – ${formatCalendarDay(to, t.locale)}`}
          </span>
          {count > 1 && <span className="text-cocoa"> {fmt(c.days, { n: count })}</span>}
        </p>
        <div className="ms-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => apply(true)} disabled={pending || alreadyBooked === count} className="btn-dark btn-sm">
            {c.markBooked}
          </button>
          <button type="button" onClick={() => apply(false)} disabled={pending || alreadyBooked === 0} className="btn-outline btn-sm">
            {c.markAvailable}
          </button>
          <button type="button" onClick={clear} className="btn-sm cursor-pointer font-semibold text-cocoa hover:text-espresso">
            {c.cancel}
          </button>
        </div>
      </div>
    );
  }

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
          const isBooked = bookedSet.has(d);
          const selected = Boolean(preview && d >= preview[0] && d <= preview[1]);
          const tone = isBooked ? "bg-espresso font-semibold text-cream hover:bg-deep" : selected ? "bg-gold/35" : "text-espresso hover:bg-gold/15";
          return (
            <button
              type="button"
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              disabled={d < today || d > last}
              aria-pressed={selected}
              aria-label={fmt(isBooked ? t.calendar.dayBooked : t.calendar.dayAvailable, { day: formatCalendarDay(d, t.locale) })}
              className={`flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors disabled:cursor-default disabled:bg-transparent disabled:font-normal disabled:text-cocoa/30 ${tone} ${
                selected ? "ring-2 ring-inset ring-gold-dark" : ""
              } ${d === today ? "underline decoration-gold-dark decoration-2 underline-offset-4" : ""}`}
            >
              {dayNumber(d)}
            </button>
          );
        }}
      />
      {summary}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <CalendarLegend
          items={[
            { label: t.calendar.available, swatch: "border border-line bg-white" },
            { label: t.calendar.booked, swatch: "bg-espresso" },
          ]}
        />
        <p className="text-xs text-cocoa" role="status">
          {pending ? c.saving : fmt(c.upcoming, { n: upcoming })}
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
