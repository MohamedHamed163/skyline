-- Skyline database schema. Applied by `npm run db:setup` (safe to re-run).

CREATE TABLE IF NOT EXISTS properties (
  id              text PRIMARY KEY,
  code            text UNIQUE,              -- SKY-PRM-0001 / SKY-RES-0001, set on first approval
  title           text NOT NULL,
  listing_type    text NOT NULL,
  type            text NOT NULL,
  location        text NOT NULL,
  compound        text NOT NULL DEFAULT '',
  area            integer NOT NULL,
  bedrooms        integer NOT NULL,
  bathrooms       integer NOT NULL,
  price           bigint NOT NULL,
  description     text NOT NULL DEFAULT '',
  features        jsonb NOT NULL DEFAULT '[]',
  photos          jsonb NOT NULL DEFAULT '[]',
  seller_type     text NOT NULL,
  seller_name     text NOT NULL,
  seller_phone    text NOT NULL,
  seller_whatsapp text NOT NULL DEFAULT '',
  seller_company  text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'pending',
  previous_status text,
  admin_notes     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_status_idx ON properties (status);

CREATE TABLE IF NOT EXISTS leads (
  id             text PRIMARY KEY,
  property_id    text REFERENCES properties (id),
  property_code  text,
  property_title text,
  name           text NOT NULL,
  phone          text NOT NULL,
  whatsapp       text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  message        text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'new',
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Rentals (admin-only listings) share the table with sale properties.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'sale';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_period text;

-- Admin-picked listings shown first on the home page (docs/homepage.md).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Floor number, optional (docs/floor.md): 0 is the ground floor, NULL when not given.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor integer;

-- Brochure and payment plan sent with a Primary submission (docs/primary-documents.md):
-- [{ "kind": "brochure" | "paymentPlan", "url": "...", "name": "..." }]. Admin-only.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]';

-- Rental booking calendar (docs/rental-calendar.md): days already booked, as sorted
-- ["YYYY-MM-DD", ...] Cairo days. Set by the admin, shown on the property page. Always [] for sales.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS booked_dates jsonb NOT NULL DEFAULT '[]';

-- Property-code counters. Sequences never hand out the same number twice.
-- property_code_premium counts primary listings: it keeps its old name so the numbers carry on.
CREATE SEQUENCE IF NOT EXISTS property_code_premium;
CREATE SEQUENCE IF NOT EXISTS property_code_resale;
CREATE SEQUENCE IF NOT EXISTS property_code_rent;

-- Locations are managed by the admin (/admin/locations). properties.location holds the location id.
CREATE TABLE IF NOT EXISTS locations (
  id         text PRIMARY KEY,            -- slug of the English name, never changes (used in URLs)
  name_en    text NOT NULL,
  name_ar    text NOT NULL,
  cover      text,                        -- home-page cover photo URL
  archived   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The locations that used to be hard-coded. Inserted once; an admin's later edits or hiding are kept.
INSERT INTO locations (id, name_en, name_ar, cover) VALUES
  ('new-cairo', 'New Cairo', 'القاهرة الجديدة', '/listings/villa-1.jpg'),
  ('new-administrative-capital', 'New Administrative Capital', 'العاصمة الإدارية الجديدة', '/listings/villa-2.jpg'),
  ('giza', 'Giza', 'الجيزة', '/listings/villa-4.jpg'),
  ('alexandria', 'Alexandria', 'الإسكندرية', '/listings/building-1.jpg'),
  ('north-coast', 'North Coast', 'الساحل الشمالي', '/listings/villa-5.jpg'),
  ('ain-sokhna', 'Ain Sokhna', 'العين السخنة', '/listings/chalet-1.jpg'),
  ('future-city', 'Future City', 'مدينة المستقبل', '/listings/villa-3.jpg')
ON CONFLICT (id) DO NOTHING;

-- Older rows stored the English name; switch them to the id.
UPDATE properties p SET location = l.id FROM locations l WHERE p.location = l.name_en;

DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_location_fkey FOREIGN KEY (location) REFERENCES locations (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- "Premium" listings were renamed "Primary" (docs/listing-types.md). Codes (SKY-PRM-…) are unchanged.
UPDATE properties SET listing_type = 'primary' WHERE listing_type = 'premium';
