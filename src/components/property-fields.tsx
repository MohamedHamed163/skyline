"use client";

import { useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { LimitedText } from "@/components/limited-text";
import { NumberField } from "@/components/number-field";
import { SpecialPrices } from "@/components/special-prices";
import type { Day } from "@/lib/availability";
import { hasDeveloperDescription } from "@/lib/descriptions";
import { locationLabel } from "@/lib/locations";
import { PROPERTY_LIMITS, TEXT_LIMITS } from "@/lib/validation";
import {
  FEATURES,
  LISTING_TYPES,
  PROPERTY_TYPES,
  PURPOSES,
  RENT_PERIODS,
  SELLER_TYPES,
  type ListingType,
  type Location,
  type Property,
  type Purpose,
  type RentPeriod,
} from "@/lib/types";

// Property + seller inputs shared by the public submission form and the admin forms.
// admin = true unlocks the rent purpose, the "Skyline (company)" seller, primary/resale and
// "show on home page". On /submit the seller picks primary/resale above these fields (PropertyForm)
// and passes it in as listingType.
// locations: the choices for the location field (see selectableLocations).
// today: today in Cairo, for the rental special-price calendar (admin forms only).
export function PropertyFields({
  locations,
  defaults,
  admin = false,
  defaultPurpose = "sale",
  listingType,
  today,
}: {
  locations: Location[];
  defaults?: Property;
  admin?: boolean;
  defaultPurpose?: Purpose;
  listingType?: ListingType;
  today?: Day;
}) {
  const t = useDict();
  const f = t.fields;
  const d = defaults;
  const [purpose, setPurpose] = useState<Purpose>(d?.purpose ?? defaultPurpose);
  const [rentPeriod, setRentPeriod] = useState<RentPeriod>(d?.rentPeriod ?? "night");
  const [adminListingType, setAdminListingType] = useState<ListingType>(d?.listingType ?? "resale");
  // Primary listings get "About the project" and "About the developer" (docs/developer-description.md).
  const primary = hasDeveloperDescription({ purpose, listingType: (admin ? adminListingType : listingType) ?? "resale" });
  const [sellerType, setSellerType] = useState(d?.seller.type ?? (admin ? "company" : "broker"));
  // Rental prices as typed, so the special-price calendar shows each night's price live (docs/rental-pricing.md).
  const [standardPrice, setStandardPrice] = useState(d?.price ?? 0);
  const [weekendPrice, setWeekendPrice] = useState<number | null>(d?.weekendPrice ?? null);
  const rent = purpose === "rent";
  const nightly = rent && rentPeriod === "night";
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
            <select id="purpose" name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)} className="field">
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
        {purpose === "rent" ? (
          <div>
            <label className="label" htmlFor="rentPeriod">
              {f.rentPeriodField}
            </label>
            <select id="rentPeriod" name="rentPeriod" required value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value as RentPeriod)} className="field">
              {RENT_PERIODS.map((v) => (
                <option key={v} value={v}>
                  {t.rentPeriod[v]}
                </option>
              ))}
            </select>
            <input type="hidden" name="listingType" value={d?.listingType ?? "resale"} />
          </div>
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
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="area">
              {f.area}
            </label>
            <NumberField id="area" name="area" limits={PROPERTY_LIMITS.area} grouped defaultValue={d?.area} />
          </div>
          <div>
            <label className="label" htmlFor="bedrooms">
              {f.bedrooms}
            </label>
            <NumberField id="bedrooms" name="bedrooms" limits={PROPERTY_LIMITS.bedrooms} defaultValue={d?.bedrooms} />
          </div>
          <div>
            <label className="label" htmlFor="bathrooms">
              {f.bathrooms}
            </label>
            <NumberField id="bathrooms" name="bathrooms" limits={PROPERTY_LIMITS.bathrooms} defaultValue={d?.bathrooms} />
          </div>
          <div>
            <label className="label" htmlFor="floor">
              {f.floor} <span className="font-normal text-cocoa">{t.optional}</span>
            </label>
            <NumberField id="floor" name="floor" limits={PROPERTY_LIMITS.floor} required={false} defaultValue={d?.floor ?? undefined} placeholder={f.floorPlaceholder} />
          </div>
        </div>
        <div className={nightly ? undefined : "sm:col-span-2"}>
          <label className="label" htmlFor="price">
            {rent ? fmt(f.standardPrice, { period: t.rentPeriod[rentPeriod], currency: t.currency }) : fmt(f.price, { currency: t.currency })}
          </label>
          <NumberField id="price" name="price" limits={PROPERTY_LIMITS.price} grouped defaultValue={d?.price} onValueChange={(v) => setStandardPrice(Number(v))} />
        </div>
        {/* Rental pricing stays mounted when it doesn't apply, so switching back keeps what was typed;
            disabled, so it is neither sent nor validated then. */}
        <fieldset className="min-w-0" disabled={!nightly} hidden={!nightly}>
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
            <SpecialPrices unit={rentPeriod} standard={standardPrice} weekend={nightly ? weekendPrice : null} defaults={d} today={today} />
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
