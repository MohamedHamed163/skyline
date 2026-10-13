"use client";

import { useEffect, useState, type ChangeEvent, type RefObject } from "react";
import { CalendarLegend, CalendarMonths, dayNumber } from "@/components/availability-calendar";
import { useDigits } from "@/components/number-field";
import { lastBookableDay, type Day } from "@/lib/availability";
import { formatCalendarDay, formatMonth, formatPrice } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import {
  countKeys,
  hasRuleIn,
  monthNights,
  monthQuote,
  nightQuote,
  pricedMonths,
  ruleCovering,
  setPriceRule,
  tidyPriceRules,
  type PriceKind,
  type Pricing,
} from "@/lib/pricing";
import type { PriceRule, Property, RentPeriod } from "@/lib/types";
import { checkWholeNumber, groupDigits, PROPERTY_LIMITS } from "@/lib/validation";

const ordered = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

// Cell colours by where the price comes from, and the matching legend swatches.
const TONE: Record<PriceKind, string> = {
  standard: "bg-white text-espresso hover:bg-gold/15",
  weekend: "bg-line/60 text-espresso hover:bg-gold/20",
  special: "bg-gold/30 text-espresso hover:bg-gold/45",
};
const SWATCH: Record<PriceKind, string> = { standard: "border border-line bg-white", weekend: "bg-line/60", special: "bg-gold/30" };
const SELECTED = "ring-2 ring-inset ring-espresso";

type Selection = { unit: RentPeriod; start: string; end: string | null };

/**
 * Special prices on the rental form (docs/rental-pricing.md). Nightly rentals get a calendar showing
 * each night's price, monthly rentals a grid of months. Click a month's name (nights) or a first and
 * a last night/month, enter the price and Apply. The list underneath shows every special price. The
 * prices are sent with the form as JSON in `priceRules`, so they're saved with Publish / Save changes.
 */
export function SpecialPrices({
  unit,
  standard,
  weekend,
  defaults,
  today,
}: {
  unit: RentPeriod;
  /** The standard and weekend prices as typed on the form (0 / null while empty). */
  standard: number;
  weekend: number | null;
  defaults?: Pick<Property, "rentPeriod" | "priceRules">;
  today: Day;
}) {
  const t = useDict();
  const c = t.admin.pricing;
  // Each rent period keeps its own list, so switching "Price is per" back and forth loses nothing.
  // Only the current one is sent.
  const [rules, setRules] = useState<Record<RentPeriod, PriceRule[]>>(() => ({
    night: defaults?.rentPeriod === "night" ? tidyPriceRules(defaults.priceRules ?? [], "night", today) : [],
    month: defaults?.rentPeriod === "month" ? tidyPriceRules(defaults.priceRules ?? [], "month", today) : [],
  }));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState("");
  const price = useDigits("", PROPERTY_LIMITS.price, true);
  const weekendDraft = useDigits("", PROPERTY_LIMITS.price, true);

  const current = rules[unit];
  const active = selection?.unit === unit ? selection : null;
  const chosen = active && ordered(active.start, active.end ?? active.start);
  const preview = active && ordered(active.start, active.end ?? hover ?? active.start);
  const pricing: Pricing = { price: standard, purpose: "rent", rentPeriod: unit, weekendPrice: weekend, priceRules: current };
  const last = lastBookableDay(today);

  // A typed but unapplied price stops the form from being sent, so it can't be lost by mistake. A
  // special price opened with Edit and left as it was is already saved, so it doesn't.
  const covering = chosen ? ruleCovering(current, ...chosen) : undefined;
  const unchanged = covering && price.digits === String(covering.price) && weekendDraft.digits === String(covering.weekendPrice ?? "");
  const unapplied = Boolean(chosen && price.digits && !unchanged);
  useEffect(() => price.ref.current?.setCustomValidity(unapplied ? c.notApplied : ""), [price.ref, unapplied, active, c.notApplied]);

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
    const rule = ruleCovering(rules[next.unit], ...ordered(next.start, next.end ?? next.start));
    price.setDigits(rule ? String(rule.price) : "");
    weekendDraft.setDigits(rule?.weekendPrice ? String(rule.weekendPrice) : "");
  };

  const pick = (key: string) => (active && !active.end ? select({ unit, start: active.start, end: key }, true) : select({ unit, start: key, end: null }));

  const save = (value: number | null, weekendValue: number | null) => {
    if (!chosen) return;
    const [from, to] = chosen;
    setRules((r) => ({ ...r, [unit]: setPriceRule(r[unit], unit, from, to, value, weekendValue, today) }));
    select(null);
  };

  const apply = () => {
    const { min, max } = PROPERTY_LIMITS.price;
    const range = { min: groupDigits(String(min)), max: groupDigits(String(max)) };
    if (checkWholeNumber(price.digits, PROPERTY_LIMITS.price)) return setError(fmt(c.badPrice, range));
    if (unit === "night" && checkWholeNumber(weekendDraft.digits, PROPERTY_LIMITS.price, false)) return setError(fmt(c.badWeekend, range));
    save(Number(price.digits), unit === "night" && weekendDraft.digits ? Number(weekendDraft.digits) : null);
  };

  const name = (key: string) => (unit === "night" ? formatCalendarDay(key, t.locale) : formatMonth(key, t.locale));
  const span = (from: string, to: string) => (from === to ? name(from) : `${name(from)} – ${name(to)}`);
  const amount = (n: number) => formatPrice(n, t.currency);
  const label = (key: string, n: number) => fmt(c.keyPrice, { key: name(key), price: n ? amount(n) : t.none });
  const comma = t.locale === "ar" ? "، " : ", ";

  const cells =
    unit === "night" ? (
      <CalendarMonths
        today={today}
        title={(m, monthName) => {
          const nights = monthNights(m, today);
          return (
            <button
              type="button"
              disabled={!nights}
              onClick={() => nights && select({ unit, start: nights[0], end: nights[1] })}
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
    ) : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {pricedMonths(today).map((m) => {
          const q = monthQuote(pricing, m);
          const selected = Boolean(preview && m >= preview[0] && m <= preview[1]);
          return (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              onMouseEnter={() => setHover(m)}
              aria-pressed={selected}
              aria-label={label(m, q.price)}
              className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-line px-2 py-3 transition-colors ${TONE[q.kind]} ${selected ? SELECTED : ""}`}
            >
              <span className="text-sm font-semibold">{name(m)}</span>
              <span className={`text-xs tabular-nums ${q.kind === "special" ? "font-semibold" : "text-cocoa"}`}>{q.price ? groupDigits(String(q.price)) : t.none}</span>
            </button>
          );
        })}
      </div>
    );

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
        <p className="text-sm text-cocoa">{c.hint[unit]}</p>
        {!standard && unit === "night" && <p className="mt-1 text-sm font-medium text-gold-deep">{c.standardFirst}</p>}
      </div>

      {cells}

      {chosen && (
        <div className="space-y-3 rounded-xl border border-gold/50 bg-ivory p-3 sm:p-4">
          <p className="text-sm">
            <span className="text-cocoa">{c.selected}: </span>
            <span className="font-semibold">{span(...chosen)}</span>
            {countKeys(unit, ...chosen) > 1 && <span className="text-cocoa"> {fmt(unit === "night" ? c.nights : c.months, { n: countKeys(unit, ...chosen) })}</span>}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Amount
              id="specialPrice"
              label={fmt(c.pricePer, { period: t.rentPeriod[unit], currency: t.currency })}
              inputRef={price.ref}
              value={price.shown}
              onChange={price.onChange}
              onEnter={apply}
            />
            {unit === "night" && (
              <Amount
                id="specialWeekendPrice"
                label={fmt(t.fields.weekendPrice, { currency: t.currency })}
                optional
                inputRef={weekendDraft.ref}
                value={weekendDraft.shown}
                onChange={weekendDraft.onChange}
                onEnter={apply}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={apply} className="btn-dark btn-sm">
              {c.apply}
            </button>
            <button type="button" onClick={() => save(null, null)} disabled={!hasRuleIn(current, ...chosen)} className="btn-outline btn-sm">
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
          ...(unit === "night" ? [{ label: c.weekend, swatch: SWATCH.weekend }] : []),
          { label: c.special, swatch: SWATCH.special },
        ]}
      />

      <div className="border-t border-line pt-4">
        <p className="text-sm font-semibold">{c.listTitle}</p>
        {current.length === 0 ? (
          <p className="mt-1 text-sm text-cocoa">{c.none[unit]}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {current.map((r) => (
              <li key={r.from} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="font-semibold">{span(r.from, r.to)}</span>
                <span className="text-cocoa">
                  {amount(r.price)} {fmt(t.per, { period: t.rentPeriod[unit] })}
                  {r.weekendPrice ? `${comma}${fmt(c.weekendRule, { price: amount(r.weekendPrice) })}` : null}
                </span>
                <span className="ms-auto flex gap-1">
                  <button type="button" onClick={() => select({ unit, start: r.from, end: r.to })} className="btn-sm cursor-pointer font-semibold text-gold-deep hover:underline">
                    {c.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRules((all) => ({ ...all, [unit]: all[unit].filter((x) => x !== r) }))}
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

      <input type="hidden" name="priceRules" value={JSON.stringify(current)} />
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
