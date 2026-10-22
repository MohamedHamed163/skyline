"use client";

import { useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { LimitedText } from "@/components/limited-text";
import { NumberField } from "@/components/number-field";
import { SpecialPrices } from "@/components/special-prices";
import type { Day } from "@/lib/availability";
import { hasDeveloperDescription } from "@/lib/descriptions";
import { locationLabel } from "@/lib/locations";
import { CODE_PATTERN, MAX_CODE_LENGTH } from "@/lib/property-codes";
import { MAX_KEYS, type RangeKey } from "@/lib/unit-ranges";
import { PROPERTY_LIMITS, TEXT_LIMITS, type NumberLimits } from "@/lib/validation";
import {
  FEATURES,
  LISTING_TYPES,
  PROPERTY_TYPES,
  PURPOSES,
  SELLER_TYPES,
  type ListingType,
  type Location,
  type Property,
  type Purpose,
} from "@/lib/types";

// Property + seller inputs shared by the public submission form and the admin forms.
// admin = true unlocks the rent purpose, the "Skyline (company)" seller, primary/resale and
// "show on home page". On /submit the seller picks primary/resale above these fields (PropertyForm)
// and passes it in as listingType.
// locations: the choices for the location field (see selectableLocations).
// today: today in Cairo, for the rental special-price calendar (admin forms only).
// onPurposeChange: told when the admin switches between sale and rent (the photo limit follows it).
export function PropertyFields({
  locations,
  defaults,
  admin = false,
  defaultPurpose = "sale",
  listingType,
  today,
  onPurposeChange,
}: {
  locations: Location[];
  defaults?: Property;
  admin?: boolean;
  defaultPurpose?: Purpose;
  listingType?: ListingType;
  today?: Day;
  onPurposeChange?: (purpose: Purpose) => void;
}) {
  const t = useDict();
  const f = t.fields;
  const d = defaults;
  const [purpose, setPurpose] = useState<Purpose>(d?.purpose ?? defaultPurpose);
  const [adminListingType, setAdminListingType] = useState<ListingType>(d?.listingType ?? "resale");
  // Primary listings get "About the project" and "About the developer" (docs/developer-description.md).
  const primary = hasDeveloperDescription({ purpose, listingType: (admin ? adminListingType : listingType) ?? "resale" });
  const [sellerType, setSellerType] = useState(d?.seller.type ?? (admin ? "company" : "broker"));
  // Rental prices as typed, so the special-price calendar shows each night's price live (docs/rental-pricing.md).
  const [standardPrice, setStandardPrice] = useState(d?.price ?? 0);
  const [weekendPrice, setWeekendPrice] = useState<number | null>(d?.weekendPrice ?? null);
  const rent = purpose === "rent";
  const company = admin && sellerType === "company";

  return (
    <>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-bold">{f.propertyInfo}</legend>
        {admin ? (
          <div>
            <label className="label" htmlFor="purpose">
              {f.purposeField}
            </label>
            <select
              id="purpose"
              name="purpose"
              value={purpose}
              onChange={(e) => {
                const next = e.target.value as Purpose;
                setPurpose(next);
                onPurposeChange?.(next);
              }}
              className="field"
            >
              {PURPOSES.map((v) => (
                <option key={v} value={v}>
                  {t.purposeBadge[v]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="purpose" value="sale" />
        )}
        {/* Rentals have no listing type to choose, and are always priced per night (docs/rental-pricing.md). */}
        {purpose === "rent" ? (
          <input type="hidden" name="listingType" value={d?.listingType ?? "resale"} />
        ) : admin ? (
          <div>
            <label className="label" htmlFor="listingType">
              {f.listingType}
            </label>
            <select id="listingType" name="listingType" required value={adminListingType} onChange={(e) => setAdminListingType(e.target.value as ListingType)} className="field">
              {LISTING_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t.listing[v]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {/* A new rental takes the code the admin types (docs/rental-codes.md); sales still get theirs
            on publishing. Kept mounted for sales, so switching back keeps the code; disabled, so it is
            neither sent nor required then. An existing listing's code can't be changed here. */}
        {admin && !d && (
          <fieldset className="min-w-0 sm:col-span-2" disabled={!rent} hidden={!rent}>
            <label className="label" htmlFor="code">
              {f.code}
            </label>
            <input
              id="code"
              name="code"
              required
              maxLength={MAX_CODE_LENGTH}
              pattern={CODE_PATTERN}
              title={fmt(f.codeHint, { max: MAX_CODE_LENGTH })}
              placeholder={f.codePlaceholder}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="auto"
              className="field font-mono uppercase placeholder:normal-case sm:max-w-sm"
            />
            <p className="mt-1 text-xs text-cocoa">{fmt(f.codeHint, { max: MAX_CODE_LENGTH })}</p>
          </fieldset>
        )}
        {admin && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ivory p-4 sm:col-span-2">
            <input type="checkbox" name="featured" defaultChecked={d?.featured} className="mt-0.5 h-5 w-5 shrink-0 accent-gold" />
            <span>
              <span className="block font-semibold">{f.featured}</span>
              <span className="block text-sm text-cocoa">{f.featuredHint}</span>
            </span>
          </label>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            {f.title}
          </label>
          <LimitedText id="title" name="title" max={TEXT_LIMITS.title} required defaultValue={d?.title} placeholder={f.titlePlaceholder} />
        </div>
        <div>
          <label className="label" htmlFor="type">
            {f.propertyType}
          </label>
          <select id="type" name="type" required defaultValue={d?.type} className="field">
            {PROPERTY_TYPES.map((v) => (
              <option key={v} value={v}>
                {t.type[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="location">
            {f.location}
          </label>
          <select id="location" name="location" required defaultValue={d?.location} className="field">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {locationLabel(t, l)} {l.archived && t.admin.locations.hiddenTag}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="compound">
            {f.compound} <span className="font-normal text-cocoa">{t.optional}</span>
          </label>
          <input id="compound" name="compound" maxLength={80} defaultValue={d?.compound} className="field" />
        </div>
        {/* Primary listings give each of these as a range across the project's units (docs/unit-ranges.md). */}
        {primary && <p className="text-sm text-cocoa sm:col-span-2">{f.rangeHint}</p>}
        <div className={`grid gap-4 sm:col-span-2 ${primary ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          <RangeField id="area" label={f.area} ranged={primary} grouped defaults={d} />
          <RangeField id="bedrooms" label={f.bedrooms} ranged={primary} defaults={d} />
          <RangeField id="bathrooms" label={f.bathrooms} ranged={primary} defaults={d} />
          <RangeField id="floor" label={f.floor} ranged={primary} optional placeholder={f.floorPlaceholder} defaults={d} />
        </div>
        <div className={rent ? undefined : "sm:col-span-2"}>
          <RangeField
            id="price"
            label={fmt(rent ? f.standardPrice : f.price, { currency: t.currency })}
            ranged={primary}
            grouped
            defaults={d}
            onFromChange={(v) => setStandardPrice(Number(v))}
          />
        </div>
        {/* Rental pricing stays mounted when it doesn't apply, so switching back keeps what was typed;
            disabled, so it is neither sent nor validated then. */}
        <fieldset className="min-w-0" disabled={!rent} hidden={!rent}>
          <label className="label" htmlFor="weekendPrice">
            {fmt(f.weekendPrice, { currency: t.currency })} <span className="font-normal text-cocoa">{t.optional}</span>
          </label>
          <NumberField
            id="weekendPrice"
            name="weekendPrice"
            limits={PROPERTY_LIMITS.price}
            required={false}
            grouped
            defaultValue={d?.weekendPrice ?? undefined}
            onValueChange={(v) => setWeekendPrice(v ? Number(v) : null)}
          />
          <p className="mt-1 text-xs text-cocoa">{f.weekendHint}</p>
        </fieldset>
        {admin && today && (
          <fieldset className="min-w-0 rounded-xl border border-line p-4 sm:col-span-2 sm:p-5" disabled={!rent} hidden={!rent}>
            <SpecialPrices standard={standardPrice} weekend={weekendPrice} defaults={d} today={today} />
          </fieldset>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">
            {primary ? f.projectDescription : f.description}
          </label>
          <LimitedText
            id="description"
            name="description"
            max={TEXT_LIMITS.description}
            multiline
            rows={4}
            defaultValue={d?.description}
            placeholder={primary ? f.projectDescriptionPlaceholder : undefined}
          />
        </div>
        {/* Kept mounted when the listing isn't Primary, so switching back keeps the text; disabled, so
            only a Primary listing sends it. */}
        <div className="sm:col-span-2" hidden={!primary}>
          <label className="label" htmlFor="developerDescription">
            {f.developerDescription}
          </label>
          <LimitedText
            id="developerDescription"
            name="developerDescription"
            max={TEXT_LIMITS.developerDescription}
            multiline
            rows={4}
            defaultValue={d?.developerDescription}
            placeholder={f.developerDescriptionPlaceholder}
            disabled={!primary}
          />
        </div>
        <div className="sm:col-span-2">
          <p className="label">
            {f.features} <span className="font-normal text-cocoa">{t.optional}</span>
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FEATURES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="features" value={v} defaultChecked={d?.features.includes(v)} className="h-4 w-4 accent-gold" />
                {t.feature[v]}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-lg font-bold">{f.sellerInfo}</legend>
        <p className="mb-2 text-sm text-cocoa sm:col-span-2">{f.sellerPrivate}</p>
        <div>
          <label className="label" htmlFor="sellerType">
            {f.sellerType}
          </label>
          <select id="sellerType" name="sellerType" required value={sellerType} onChange={(e) => setSellerType(e.target.value as typeof sellerType)} className="field">
            {SELLER_TYPES.filter((v) => admin || v !== "company").map((v) => (
              <option key={v} value={v}>
                {t.seller[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sellerName">
            {f.sellerName} {company && <span className="font-normal text-cocoa">{t.optional}</span>}
          </label>
          <input id="sellerName" name="sellerName" required={!company} maxLength={80} defaultValue={d?.seller.name} autoComplete="name" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="sellerPhone">
            {f.phone} {company && <span className="font-normal text-cocoa">{t.optional}</span>}
          </label>
          <input id="sellerPhone" name="sellerPhone" type="tel" required={!company} maxLength={20} defaultValue={d?.seller.phone} autoComplete="tel" placeholder={t.phonePlaceholder} dir="ltr" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="sellerWhatsapp">
            {f.whatsapp} <span className="font-normal text-cocoa">{t.optional}</span>
          </label>
          <input id="sellerWhatsapp" name="sellerWhatsapp" type="tel" maxLength={20} defaultValue={d?.seller.whatsapp} placeholder={t.phonePlaceholder} dir="ltr" className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sellerCompany">
            {f.company} <span className="font-normal text-cocoa">{t.ifApplicable}</span>
          </label>
          <input id="sellerCompany" name="sellerCompany" maxLength={80} defaultValue={d?.seller.company} autoComplete="organization" className="field" />
        </div>
      </fieldset>
    </>
  );
}

/**
 * One of the unit fields (area, bedrooms, bathrooms, floor, price). On Primary listings (`ranged`)
 * a "To" box sits beside it, so the seller can give the range across the project's units
 * (docs/unit-ranges.md); "To" is optional and can't go below "From". Otherwise the "To" box stays
 * mounted, so switching back keeps what was typed, but hidden and disabled, so it isn't sent.
 */
function RangeField({
  id,
  label,
  ranged,
  optional = false,
  grouped = false,
  placeholder,
  defaults,
  onFromChange,
}: {
  id: RangeKey;
  label: string;
  ranged: boolean;
  optional?: boolean;
  grouped?: boolean;
  placeholder?: string;
  defaults?: Property;
  onFromChange?: (digits: string) => void;
}) {
  const t = useDict();
  const f = t.fields;
  const limits: NumberLimits = PROPERTY_LIMITS[id];
  const toKey = MAX_KEYS[id];
  const [from, setFrom] = useState(defaults?.[id] == null ? "" : String(defaults[id]));
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        {label} {optional && <span className="font-normal text-cocoa">{t.optional}</span>}
      </label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <NumberField
            id={id}
            name={id}
            limits={limits}
            required={!optional}
            grouped={grouped}
            defaultValue={defaults?.[id] ?? undefined}
            placeholder={ranged ? f.rangeFrom : placeholder}
            onValueChange={(v) => {
              setFrom(v);
              onFromChange?.(v);
            }}
          />
        </div>
        <fieldset className="min-w-0 flex-1" disabled={!ranged} hidden={!ranged}>
          <label className="sr-only" htmlFor={toKey}>
            {fmt(f.rangeToField, { field: label })}
          </label>
          <NumberField
            id={toKey}
            name={toKey}
            limits={{ min: from ? Math.max(Number(from), limits.min) : limits.min, max: limits.max }}
            required={false}
            grouped={grouped}
            defaultValue={defaults?.[toKey] ?? undefined}
            placeholder={f.rangeTo}
          />
        </fieldset>
      </div>
    </div>
  );
}
