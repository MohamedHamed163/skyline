import type { Location, Property } from "@/lib/types";

// Builders for unit tests: sensible defaults, override only what a test cares about.

export const makeLocation = (o: Partial<Location> = {}): Location => ({
  id: "new-cairo",
  nameEn: "New Cairo",
  nameAr: "القاهرة الجديدة",
  cover: null,
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...o,
});

export const makeProperty = (o: Partial<Property> = {}): Property => ({
  id: "p1",
  code: "SKY-RES-0001",
  title: "Sample apartment",
  listingType: "resale",
  featured: false,
  purpose: "sale",
  rentPeriod: null,
  type: "apartment",
  location: "new-cairo",
  locationName: { en: "New Cairo", ar: "القاهرة الجديدة" },
  compound: "",
  area: 100,
  bedrooms: 2,
  bathrooms: 1,
  floor: null,
  price: 1_000_000,
  weekendPrice: null,
  priceRules: [],
  description: "",
  developerDescription: "",
  features: [],
  photos: ["/listings/villa-1.jpg"],
  documents: [],
  bookedDates: [],
  seller: { type: "owner", name: "Owner", phone: "+20 100 000 0000", whatsapp: "", company: "" },
  status: "published",
  previousStatus: "pending",
  adminNotes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...o,
});
