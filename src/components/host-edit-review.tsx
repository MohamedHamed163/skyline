import { ActionForm } from "@/components/action-form";
import { Photo } from "@/components/property-card";
import { approveHostEdit, rejectHostEdit } from "@/lib/actions";
import { floorText, formatDate, formatPrice } from "@/lib/format";
import { fmt, type Dict } from "@/lib/i18n";
import { diffEdit, photoChanges, type DiffField, type FieldValue } from "@/lib/listing-edits";
import { locationLabel } from "@/lib/locations";
import type { Host, ListingType, Location, Property, PropertyType, SellerType } from "@/lib/types";

// The admin's view of a host's waiting edit (docs/host-edit-approval.md): every changed field's live
// and proposed value side by side, photos included, with Approve and Reject. Server component.

function label(t: Dict, field: DiffField) {
  const f = t.fields;
  const labels: Record<DiffField, string> = {
    listingType: f.listingType,
    title: f.title,
    type: f.propertyType,
    location: f.location,
    compound: f.compound,
    area: f.area,
    areaMax: fmt(f.rangeToField, { field: f.area }),
    bedrooms: f.bedrooms,
    bedroomsMax: fmt(f.rangeToField, { field: f.bedrooms }),
    bathrooms: f.bathrooms,
    bathroomsMax: fmt(f.rangeToField, { field: f.bathrooms }),
    floor: f.floor,
    floorMax: fmt(f.rangeToField, { field: f.floor }),
    price: fmt(f.price, { currency: t.currency }),
    priceMax: fmt(f.rangeToField, { field: fmt(f.price, { currency: t.currency }) }),
    description: f.description,
    developerDescription: f.developerDescription,
    features: f.features,
    sellerType: f.sellerType,
    sellerName: f.sellerName,
    sellerPhone: f.phone,
    sellerWhatsapp: f.whatsapp,
    sellerCompany: f.company,
    photos: t.submit.images,
  };
  return labels[field];
}

function Value({ t, field, value, locations }: { t: Dict; field: DiffField; value: FieldValue; locations: Location[] }) {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return <span className="text-cocoa">{t.none}</span>;
  if (Array.isArray(value)) return <>{value.map((f) => t.feature[f as keyof Dict["feature"]] ?? f).join(", ")}</>;
  switch (field) {
    case "listingType":
      return <>{t.listing[value as ListingType]}</>;
    case "type":
      return <>{t.type[value as PropertyType]}</>;
    case "sellerType":
      return <>{t.seller[value as SellerType]}</>;
    case "location": {
      const place = locations.find((l) => l.id === value);
      return <>{place ? locationLabel(t, place) : value}</>;
    }
    case "price":
    case "priceMax":
      return <span dir="ltr">{formatPrice(Number(value), t.currency)}</span>;
    case "area":
    case "areaMax":
      return <>{fmt(t.sqm, { n: value })}</>;
    case "floor":
    case "floorMax":
      return <>{floorText(t, Number(value))}</>;
    case "sellerPhone":
    case "sellerWhatsapp":
      return <span dir="ltr">{value}</span>;
    default:
      return (
        <span className="whitespace-pre-line" dir="auto">
          {value}
        </span>
      );
  }
}

/** Thumbnails, with the photos the edit adds or drops outlined and labelled. */
function Photos({ t, photos, marked, tone, tag }: { t: Dict; photos: string[]; marked: string[]; tone: string; tag: string }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((src, i) => (
        <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative block">
          <Photo src={src} alt={fmt(t.photoAlt, { n: i + 1 })} className={`aspect-square w-full rounded-lg bg-line ${marked.includes(src) ? `ring-2 ${tone}` : ""}`} />
          {marked.includes(src) && <span className="absolute start-1 top-1 rounded bg-white/90 px-1 text-[10px] font-semibold">{tag}</span>}
        </a>
      ))}
    </div>
  );
}

export function HostEditReview({ t, property, host, locations }: { t: Dict; property: Property; host?: Host; locations: Location[] }) {
  const edit = property.pendingEdit;
  if (!edit) return null;
  const e = t.admin.hostEdit;
  const changes = diffEdit(property, edit.values);

  return (
    <section className="card border-gold p-5 ring-1 ring-gold">
      <h2 className="font-bold">{e.title}</h2>
      <p className="text-sm text-cocoa">{fmt(e.intro, { username: host?.username ?? t.none, date: formatDate(edit.submittedAt, t.locale) })}</p>

      {changes.length === 0 ? (
        <p className="mt-3 text-sm text-cocoa">{e.noChanges}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-cocoa">
              <tr>
                <th className="w-40 py-2 pe-3 text-start font-semibold">{e.field}</th>
                <th className="py-2 pe-3 text-start font-semibold">{e.current}</th>
                <th className="py-2 text-start font-semibold">{e.proposed}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {changes.map(({ field, before, after }) => {
                const photos = field === "photos" ? photoChanges(before as string[], after as string[]) : null;
                return (
                  <tr key={field}>
                    <th scope="row" className="py-2 pe-3 text-start font-medium text-cocoa">
                      {label(t, field)}
                    </th>
                    <td className="min-w-48 py-2 pe-3 text-red-800/80">
                      {photos ? <Photos t={t} photos={before as string[]} marked={photos.removed} tone="ring-red-500" tag={e.removed} /> : <Value t={t} field={field} value={before} locations={locations} />}
                    </td>
                    <td className="min-w-48 py-2 font-medium text-success-deep">
                      {photos ? <Photos t={t} photos={after as string[]} marked={photos.added} tone="ring-success" tag={e.added} /> : <Value t={t} field={field} value={after} locations={locations} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <ActionForm action={approveHostEdit.bind(null, property.id, edit.submittedAt)} confirm={e.approveConfirm}>
          <button type="submit" className="btn btn-sm bg-success text-deep hover:bg-success-dark">
            {e.approve}
          </button>
        </ActionForm>
        <ActionForm action={rejectHostEdit.bind(null, property.id, edit.submittedAt)} confirm={e.rejectConfirm} className="space-y-2">
          <textarea name="editNote" rows={2} maxLength={1000} placeholder={e.notePlaceholder} aria-label={e.notePlaceholder} className="field" />
          <button type="submit" className="btn-outline btn-sm">
            {e.reject}
          </button>
        </ActionForm>
      </div>
    </section>
  );
}
