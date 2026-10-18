"use client";

import { useEffect, useState, type ChangeEvent, type RefObject } from "react";
import { CalendarLegend, CalendarMonths, dayNumber } from "@/components/availability-calendar";
import { useDigits } from "@/components/number-field";
import { daysBetween, lastBookableDay, type Day } from "@/lib/availability";
import { formatCalendarDay, formatPrice } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import { hasRuleIn, monthNights, nightQuote, ruleCovering, setPriceRule, tidyPriceRules, type PriceKind, type Pricing } from "@/lib/pricing";
import type { Property } from "@/lib/types";
import { checkWholeNumber, groupDigits, PROPERTY_LIMITS } from "@/lib/validation";

const ordered = (a: Day, b: Day): [Day, Day] => (a <= b ? [a, b] : [b, a]);

// Cell colours by where the price comes from, and the matching legend swatches.
const TONE: Record<PriceKind, string> = {
  standard: "bg-white text-espresso hover:bg-gold/15",
  weekend: "bg-line/60 text-espresso hover:bg-gold/20",
  special: "bg-gold/30 text-espresso hover:bg-gold/45",
};
const SWATCH: Record<PriceKind, string> = { standard: "border border-line bg-white", weekend: "bg-line/60", special: "bg-gold/30" };
const SELECTED = "ring-2 ring-inset ring-espresso";

type Selection = { start: Day; end: Day | null };

/**
 * Special prices on the rental form (docs/rental-pricing.md): a calendar showing each night's price.
 * Click a month's name or a first and a last night, enter the price and Apply. The list underneath
 * shows every special price. The prices are sent with the form as JSON in `priceRules`, so they're
 * saved with Publish / Save changes.
 */
export function SpecialPrices({
  standard,
  weekend,
  defaults,
  today,
}: {
  /** The standard and weekend prices as typed on the form (0 / null while empty). */
  standard: number;
  weekend: number | null;
  defaults?: Pick<Property, "priceRules">;
  today: Day;
}) {
  const t = useDict();
  const c = t.admin.pricing;
  const [rules, setRules] = useState(() => tidyPriceRules(defaults?.priceRules ?? [], today));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState("");
  const price = useDigits("", PROPERTY_LIMITS.price, true);
  const weekendDraft = useDigits("", PROPERTY_LIMITS.price, true);

  const chosen = selection && ordered(selection.start, selection.end ?? selection.start);
  const preview = selection && ordered(selection.start, selection.end ?? hover ?? selection.start);
  const pricing: Pricing = { price: standard, purpose: "rent", weekendPrice: weekend, priceRules: rules };
  const last = lastBookableDay(today);

  // A typed but unapplied price stops the form from being sent, so it can't be lost by mistake. A
  // special price opened with Edit and left as it was is already saved, so it doesn't.
  const covering = chosen ? ruleCovering(rules, ...chosen) : undefined;
  const unchanged = covering && price.digits === String(covering.price) && weekendDraft.digits === String(covering.weekendPrice ?? "");
  const unapplied = Boolean(chosen && price.digits && !unchanged);
  useEffect(() => price.ref.current?.setCustomValidity(unapplied ? c.notApplied : ""), [price.ref, unapplied, selection, c.notApplied]);

  // Opening a selection fills in its special price, if one covers it. Picking the last night of a
  // selection (`extending`) keeps a price that was already typed.
  const select = (next: Selection | null, extending = false) => {
    setSelection(next);
    setError("");
    if (!next) {
      setHover(null);
      price.setDigits("");
      weekendDraft.setDigits("");
      return;
    }
    if (extending && price.digits) return;
    const rule = ruleCovering(rules, ...ordered(next.start, next.end ?? next.start));
    price.setDigits(rule ? String(rule.price) : "");
    weekendDraft.setDigits(rule?.weekendPrice ? String(rule.weekendPrice) : "");
  };

  const pick = (night: Day) => (selection && !selection.end ? select({ start: selection.start, end: night }, true) : select({ start: night, end: null }));

  const save = (value: number | null, weekendValue: number | null) => {
    if (!chosen) return;
    const [from, to] = chosen;
    setRules((r) => setPriceRule(r, from, to, value, weekendValue, today));
    select(null);
  };

  const apply = () => {
    const { min, max } = PROPERTY_LIMITS.price;
    const range = { min: groupDigits(String(min)), max: groupDigits(String(max)) };
    if (checkWholeNumber(price.digits, PROPERTY_LIMITS.price)) return setError(fmt(c.badPrice, range));
    if (checkWholeNumber(weekendDraft.digits, PROPERTY_LIMITS.price, false)) return setError(fmt(c.badWeekend, range));
    save(Number(price.digits), weekendDraft.digits ? Number(weekendDraft.digits) : null);
  };

  const name = (night: Day) => formatCalendarDay(night, t.locale);
  const span = (from: Day, to: Day) => (from === to ? name(from) : `${name(from)} – ${name(to)}`);
  const amount = (n: number) => formatPrice(n, t.currency);
  const label = (night: Day, n: number) => fmt(c.keyPrice, { key: name(night), price: n ? amount(n) : t.none });
  const comma = t.locale === "ar" ? "، " : ", ";

  return (
    <div
      className="space-y-4"
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") select(null);
      }}
    >
      <div>
        <p className="label">
          {c.title} <span className="font-normal text-cocoa">{t.optional}</span>
        </p>
        <p className="text-sm text-cocoa">{c.hint}</p>
        {!standard && <p className="mt-1 text-sm font-medium text-gold-deep">{c.standardFirst}</p>}
      </div>

      <CalendarMonths
        today={today}
        title={(m, monthName) => {
          const nights = monthNights(m, today);
          return (
            <button
              type="button"
              disabled={!nights}
              onClick={() => nights && select({ start: nights[0], end: nights[1] })}
              aria-label={fmt(c.selectMonth, { month: monthName })}
              className="cursor-pointer rounded-lg px-2 py-1 underline decoration-gold-dark decoration-dotted underline-offset-4 hover:bg-gold/15 hover:text-gold-deep disabled:cursor-default"
            >
              {monthName}
            </button>
          );
        }}
        day={(d) => {
          const q = nightQuote(pricing, d);
          const off = d < today || d > last;
          const selected = Boolean(preview && d >= preview[0] && d <= preview[1]);
          return (
            <button
              type="button"
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              disabled={off}
              aria-pressed={selected}
              aria-label={label(d, q.price)}
              className={`flex h-12 cursor-pointer flex-col items-center justify-center rounded-lg leading-tight transition-colors disabled:cursor-default disabled:bg-transparent disabled:text-cocoa/30 ${TONE[q.kind]} ${selected ? SELECTED : ""}`}
            >
              <span className="text-sm">{dayNumber(d)}</span>
              {!off && q.price > 0 && (
                <span className={`text-[10px] tabular-nums ${q.kind === "special" ? "font-semibold" : "text-cocoa"}`}>{groupDigits(String(q.price))}</span>
              )}
            </button>
          );
        }}
      />

      {chosen && (
        <div className="space-y-3 rounded-xl border border-gold/50 bg-ivory p-3 sm:p-4">
          <p className="text-sm">
            <span className="text-cocoa">{c.selected}: </span>
            <span className="font-semibold">{span(...chosen)}</span>
            {chosen[0] !== chosen[1] && <span className="text-cocoa"> {fmt(c.nights, { n: daysBetween(...chosen).length })}</span>}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Amount
              id="specialPrice"
              label={fmt(c.pricePer, { currency: t.currency })}
              inputRef={price.ref}
              value={price.shown}
              onChange={price.onChange}
              onEnter={apply}
            />
            <Amount
              id="specialWeekendPrice"
              label={fmt(t.fields.weekendPrice, { currency: t.currency })}
              optional
              inputRef={weekendDraft.ref}
              value={weekendDraft.shown}
              onChange={weekendDraft.onChange}
              onEnter={apply}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={apply} className="btn-dark btn-sm">
              {c.apply}
            </button>
            <button type="button" onClick={() => save(null, null)} disabled={!hasRuleIn(rules, ...chosen)} className="btn-outline btn-sm">
              {c.useStandard}
            </button>
            <button type="button" onClick={() => select(null)} className="btn-sm cursor-pointer font-semibold text-cocoa hover:text-espresso">
              {c.cancel}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      <CalendarLegend
        items={[
          { label: c.standard, swatch: SWATCH.standard },
          { label: c.weekend, swatch: SWATCH.weekend },
          { label: c.special, swatch: SWATCH.special },
        ]}
      />

      <div className="border-t border-line pt-4">
        <p className="text-sm font-semibold">{c.listTitle}</p>
        {rules.length === 0 ? (
          <p className="mt-1 text-sm text-cocoa">{c.none}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {rules.map((r) => (
              <li key={r.from} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="font-semibold">{span(r.from, r.to)}</span>
                <span className="text-cocoa">
                  {amount(r.price)} {t.perNight}
                  {r.weekendPrice ? `${comma}${fmt(c.weekendRule, { price: amount(r.weekendPrice) })}` : null}
                </span>
                <span className="ms-auto flex gap-1">
                  <button type="button" onClick={() => select({ start: r.from, end: r.to })} className="btn-sm cursor-pointer font-semibold text-gold-deep hover:underline">
                    {c.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRules((all) => all.filter((x) => x !== r))}
                    className="btn-sm cursor-pointer font-semibold text-red-600 hover:underline"
                  >
                    {c.remove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input type="hidden" name="priceRules" value={JSON.stringify(rules)} />
    </div>
  );
}

/** A price box in the selection bar. Enter applies the price instead of sending the whole form. */
function Amount({
  id,
  label,
  optional,
  inputRef,
  value,
  onChange,
  onEnter,
}: {
  id: string;
  label: string;
  optional?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEnter: () => void;
}) {
  const t = useDict();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} {optional && <span className="font-normal text-cocoa">{t.optional}</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        className="field"
      />
    </div>
  );
}
