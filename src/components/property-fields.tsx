"use client";

import { useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { locationLabel } from "@/lib/locations";
import {
  FEATURES,
  LISTING_TYPES,
  PROPERTY_TYPES,
  PURPOSES,
  RENT_PERIODS,
  SELLER_TYPES,
  type Location,
  type Property,
  type Purpose,
  type RentPeriod,
} from "@/lib/types";

// Property + seller inputs shared by the public submission form and the admin forms.
// admin = true unlocks the rent purpose, the "Skyline (company)" seller, premium/resale and
// "show on home page". Public submissions arrive as resale; the admin decides afterwards.
// locations: the choices for the location field (see selectableLocations).
export function PropertyFields({ locations, defaults, admin = false, defaultPurpose = "sale" }: { locations: Location[]; defaults?: Property; admin?: boolean; defaultPurpose?: Purpose }) {
  const t = useDict();
  const f = t.fields;
  const d = defaults;
  const [purpose, setPurpose] = useState<Purpose>(d?.purpose ?? defaultPurpose);
  const [rentPeriod, setRentPeriod] = useState<RentPeriod>(d?.rentPeriod ?? "night");
  const [sellerType, setSellerType] = useState(d?.seller.type ?? (admin ? "company" : "broker"));
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
            <select id="listingType" name="listingType" required defaultValue={d?.listingType ?? "resale"} className="field">
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
          <input id="title" name="title" required maxLength={120} defaultValue={d?.title} placeholder={f.titlePlaceholder} className="field" />
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
        <div className="grid grid-cols-3 gap-4 sm:col-span-2">
          <div>
            <label className="label" htmlFor="area">
              {f.area}
            </label>
            <input id="area" name="area" type="number" min={1} required defaultValue={d?.area} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="bedrooms">
              {f.bedrooms}
            </label>
            <input id="bedrooms" name="bedrooms" type="number" min={0} max={50} required defaultValue={d?.bedrooms} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="bathrooms">
              {f.bathrooms}
            </label>
            <input id="bathrooms" name="bathrooms" type="number" min={0} max={50} required defaultValue={d?.bathrooms} className="field" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="price">
            {fmt(f.price, { currency: t.currency })}
            {purpose === "rent" && <span className="font-normal text-cocoa"> — {f.rentPeriodField.toLowerCase()} {t.rentPeriod[rentPeriod]}</span>}
          </label>
          <input id="price" name="price" type="number" min={1} required defaultValue={d?.price} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">
            {f.description}
          </label>
          <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={d?.description} className="field" />
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
