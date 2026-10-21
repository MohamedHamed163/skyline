-- Skyline database schema. Applied by `npm run db:setup` (safe to re-run).

CREATE TABLE IF NOT EXISTS properties (
  id              text PRIMARY KEY,
  code            text UNIQUE,              -- SKY-PRM-0001 / SKY-RES-0001, set on first approval; rentals: typed by the admin
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

-- Rental prices that change by date (docs/rental-pricing.md). weekend_price: Thursday, Friday and Saturday
-- nights, NULL = the standard price. price_rules: special prices for runs of nights,
-- [{ "from", "to", "price", "weekendPrice" }]. Always NULL and [] for sales.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS weekend_price bigint;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_rules jsonb NOT NULL DEFAULT '[]';

-- Rentals are priced per night only (docs/rental-pricing.md). Monthly rentals become nightly and lose
-- their special prices, which were for whole months. The price itself is kept as it was.
UPDATE properties
SET rent_period = 'night', price_rules = CASE WHEN rent_period = 'month' THEN '[]'::jsonb ELSE price_rules END
WHERE purpose = 'rent' AND rent_period IS DISTINCT FROM 'night';

-- "About the developer" text on Primary listings (docs/developer-description.md). '' when not given.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS developer_description text NOT NULL DEFAULT '';

-- Property-code counters. Sequences never hand out the same number twice.
-- property_code_premium counts primary listings: it keeps its old name so the numbers carry on.
-- New rentals take a code typed by the admin (docs/rental-codes.md); property_code_rent is only used
-- when a listing without a code is published as a rental.
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

-- Host accounts (docs/host-accounts.md): brokers and owners create one with a username and password
-- the first time they list a property, then see and edit their listings at /account. Usernames are
-- stored in lower case; password_hash is "scrypt$<salt>$<hash>" (src/lib/passwords.ts).
CREATE TABLE IF NOT EXISTS hosts (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Password changes (docs/host-accounts.md). session_version is signed into the session cookie and
-- moves on with every password change, which signs out the account's other sessions.
-- password_temporary: the admin set the password, so /account asks the host to choose their own.
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS password_temporary boolean NOT NULL DEFAULT false;

-- Admin impersonation audit (docs/host-impersonation.md): one row each time the admin enters a host's
-- account for support. The single shared admin login (ADMIN_PASSWORD) has no per-person identity, so a
-- row records which account was entered and when, not which staff member did it. Append-only; kept
-- even if the host is later removed is not a concern because hosts are never deleted.
CREATE TABLE IF NOT EXISTS impersonation_log (
  id         text PRIMARY KEY,
  host_id    text NOT NULL REFERENCES hosts (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS impersonation_log_host_idx ON impersonation_log (host_id, created_at DESC);

-- Forgot-password requests (docs/password-help.md): a host who can't sign in leaves their username
-- and a phone number; the admin checks it's them and sets a new password on /admin/accounts.
-- host_id: the account with that username, NULL when there is none. resolved_at: set when the
-- admin resets the account's password or dismisses the request; open requests have NULL.
CREATE TABLE IF NOT EXISTS password_requests (
  id          text PRIMARY KEY,
  username    text NOT NULL,
  host_id     text REFERENCES hosts (id),
  phone       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_requests_open_idx ON password_requests (created_at DESC) WHERE resolved_at IS NULL;

-- The account that listed a property. NULL for properties the admin added and those sent before
-- accounts existed.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS host_id text REFERENCES hosts (id);
CREATE INDEX IF NOT EXISTS properties_host_idx ON properties (host_id);

-- Host edits to published listings wait for the admin (docs/host-edit-approval.md). pending_edit:
-- { "values": {title, listingType, …, seller, photos}, "submittedAt" }, NULL when none; the live
-- columns are untouched until the admin approves it. edit_outcome: the admin's last decision,
-- { "result": "approved" | "rejected", "note", "at" }, shown to the host on /account.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pending_edit jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS edit_outcome jsonb;

-- Rentals never wait in Pending Approvals (docs/pending-approvals.md): Skyline lists them itself.
-- Publishes any rental still pending, giving it a SKY-RNT code if it has none.
UPDATE properties SET
  previous_status = status,
  status = 'published',
  code = COALESCE(code, 'SKY-RNT-' || lpad(nextval('property_code_rent')::text, 4, '0')),
  updated_at = now()
WHERE purpose = 'rent' AND status = 'pending';

-- Leads have three statuses only (docs/lead-statuses.md): leads already past "Contacted" stay contacted.
UPDATE leads SET status = 'contacted'
WHERE status IN ('interested', 'viewing_scheduled', 'negotiating', 'closed');
