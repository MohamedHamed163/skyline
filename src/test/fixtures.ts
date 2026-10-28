import type { Host, Location, Property, SubLocation } from "@/lib/types";

// Builders for unit tests: sensible defaults, override only what a test cares about.

export const makeHost = (o: Partial<Host> = {}): Host => ({
  id: "h1",
  username: "ahmed",
  sessionVersion: 0,
  temporaryPassword: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...o,
});

export const makeLocation = (o: Partial<Location> = {}): Location => ({
  id: "new-cairo",
  nameEn: "New Cairo",
  nameAr: "القاهرة الجديدة",
  cover: null,
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  subLocations: [],
  ...o,
});

export const makeSubLocation = (o: Partial<SubLocation> = {}): SubLocation => ({
  id: "new-cairo--fifth-settlement",
  locationId: "new-cairo",
  nameEn: "Fifth Settlement",
  nameAr: "التجمع الخامس",
  sortOrder: 10,
  archived: false,
  ...o,
});

export const makeProperty = (o: Partial<Property> = {}): Property => ({
  id: "p1",
  code: "SKY-RES-0001",
  title: "Sample apartment",
  listingType: "resale",
  featured: false,
  purpose: "sale",
  type: "apartment",
  location: "new-cairo",
  locationName: { en: "New Cairo", ar: "القاهرة الجديدة" },
  subLocation: null,
  subLocationName: null,
  subLocationCustom: "",
  compound: "",
  area: 100,
  bedrooms: 2,
  bathrooms: 1,
  floor: null,
  areaMax: null,
  bedroomsMax: null,
  bathroomsMax: null,
  floorMax: null,
  price: 1_000_000,
  priceMax: null,
  weekendPrice: null,
  priceRules: [],
  description: "",
  developerDescription: "",
  features: [],
  photos: ["/listings/villa-1.jpg"],
  documents: [],
  bookedDates: [],
  seller: { type: "owner", name: "Owner", phone: "+20 100 000 0000", whatsapp: "", company: "" },
  hostId: null,
  pendingEdit: null,
  editOutcome: null,
  status: "published",
  previousStatus: "pending",
  adminNotes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...o,
});
