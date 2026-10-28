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

-- Unit ranges on Primary listings (docs/unit-ranges.md): area, bedrooms, bathrooms, floor and price
-- hold the "from" values and these the "to" values. NULL when every unit has the same value, and
-- always NULL on Resale listings and rentals.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS area_max integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms_max integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms_max integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_max integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_max bigint;

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

-- Sub-locations (docs/sub-locations.md): areas inside a location (New Cairo → Fifth Settlement). Two
-- levels only. `id` is "<location>--<slug>": globally unique and stable, so it is used in URLs, while
-- the slug only has to be unique inside its location (Lasirena exists on three coasts).
CREATE TABLE IF NOT EXISTS sub_locations (
  id          text PRIMARY KEY,
  location_id text NOT NULL REFERENCES locations (id),
  slug        text NOT NULL,
  name_en     text NOT NULL,
  name_ar     text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,  -- the forms and filters list them by this, then by name
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, slug),
  UNIQUE (id, location_id)                 -- target of the composite foreign key on properties
);

-- A property picks one from the list (sub_location) or types its own (sub_location_custom), never both.
-- The composite key guarantees the picked one belongs to the property's location.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sub_location text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sub_location_custom text NOT NULL DEFAULT '';
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_sub_location_fkey
    FOREIGN KEY (sub_location, location) REFERENCES sub_locations (id, location_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_sub_location_one
    CHECK (sub_location IS NULL OR sub_location_custom = '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Ready for when search moves to SQL (docs/sub-locations.md, "Scale").
CREATE INDEX IF NOT EXISTS properties_place_idx ON properties (status, location, sub_location);

-- New regions, hidden until the admin restores them with a photo. Inserted once; later edits are kept.
INSERT INTO locations (id, name_en, name_ar, archived) VALUES
  ('cairo', 'Cairo', 'القاهرة', true),
  ('ras-sudr', 'Ras Sudr', 'رأس سدر', true),
  ('marsa-matrouh', 'Marsa Matrouh', 'مطروح', true),
  ('hurghada', 'Hurghada', 'الغردقة', true),
  ('el-gouna', 'El Gouna', 'الجونة', true),
  ('sharm-el-sheikh', 'Sharm El Sheikh', 'شرم الشيخ', true),
  ('dahab', 'Dahab', 'دهب', true)
ON CONFLICT (id) DO NOTHING;

-- The business owner's list, in the order given (kilometre order along the coasts). Inserted once.
INSERT INTO sub_locations (id, location_id, slug, name_en, name_ar, sort_order) VALUES
  ('north-coast--amoun', 'north-coast', 'amoun', 'Amoun', 'آمون', 10),
  ('north-coast--el-shorouk', 'north-coast', 'el-shorouk', 'El Shorouk', 'الشروق', 20),
  ('north-coast--ramses', 'north-coast', 'ramses', 'Ramses', 'رمسيس', 30),
  ('north-coast--venus-1', 'north-coast', 'venus-1', 'Venus 1', 'فينوس 1', 40),
  ('north-coast--venus-2', 'north-coast', 'venus-2', 'Venus 2', 'فينوس 2', 50),
  ('north-coast--maraqia', 'north-coast', 'maraqia', 'Maraqia', 'مراقيا', 60),
  ('north-coast--granada', 'north-coast', 'granada', 'Granada', 'غرناطة', 70),
  ('north-coast--zomoroda', 'north-coast', 'zomoroda', 'Zomoroda', 'زمردة', 80),
  ('north-coast--nice-1', 'north-coast', 'nice-1', 'Nice 1', 'نيس 1', 90),
  ('north-coast--nice-2', 'north-coast', 'nice-2', 'Nice 2', 'نيس 2', 100),
  ('north-coast--marbella', 'north-coast', 'marbella', 'Marbella', 'ماربيلا', 110),
  ('north-coast--diamora', 'north-coast', 'diamora', 'Diamora', 'ديامورا', 120),
  ('north-coast--marseilia-beach-1', 'north-coast', 'marseilia-beach-1', 'Marseilia Beach 1', 'مارسيليا بيتش 1', 130),
  ('north-coast--mina-3-4-5', 'north-coast', 'mina-3-4-5', 'Mina 3, 4 & 5', 'مينا 3 و 4 و 5', 140),
  ('north-coast--aida', 'north-coast', 'aida', 'Aida', 'عايدة', 150),
  ('north-coast--rosana', 'north-coast', 'rosana', 'Rosana', 'روزانا', 160),
  ('north-coast--lotus', 'north-coast', 'lotus', 'Lotus', 'اللوتس', 170),
  ('north-coast--marina', 'north-coast', 'marina', 'Marina', 'مارينا', 180),
  ('north-coast--marina-el-alamein', 'north-coast', 'marina-el-alamein', 'Marina El Alamein', 'مارينا العلمين', 190),
  ('north-coast--porto-marina', 'north-coast', 'porto-marina', 'Porto Marina', 'بورتو مارينا', 200),
  ('north-coast--golf-porto-marina', 'north-coast', 'golf-porto-marina', 'Golf Porto Marina', 'جولف بورتو مارينا', 210),
  ('north-coast--new-alamein-towers', 'north-coast', 'new-alamein-towers', 'New Alamein Towers', 'أبراج العلمين الجديدة', 220),
  ('north-coast--lazurde-bay', 'north-coast', 'lazurde-bay', 'Lazurde Bay', 'لازوردي باي', 230),
  ('north-coast--marseilia-beach-4', 'north-coast', 'marseilia-beach-4', 'Marseilia Beach 4', 'مارسيليا بيتش 4', 240),
  ('north-coast--zahra-memaar-al-morshedy', 'north-coast', 'zahra-memaar-al-morshedy', 'Zahra (Memaar Al Morshedy)', 'زهرة (معمار المرشدي)', 250),
  ('north-coast--hacienda-bay', 'north-coast', 'hacienda-bay', 'Hacienda Bay', 'هاسيندا باي', 260),
  ('north-coast--marassi', 'north-coast', 'marassi', 'Marassi', 'مراسي', 270),
  ('north-coast--stella-heights', 'north-coast', 'stella-heights', 'Stella Heights', 'ستيلا هايتس', 280),
  ('north-coast--seashell', 'north-coast', 'seashell', 'Seashell', 'سي شيل', 290),
  ('north-coast--bianchi', 'north-coast', 'bianchi', 'Bianchi', 'بيانكي', 300),
  ('north-coast--amwaj', 'north-coast', 'amwaj', 'Amwaj', 'أمواج', 310),
  ('north-coast--hacienda-white', 'north-coast', 'hacienda-white', 'Hacienda White', 'هاسيندا وايت', 320),
  ('north-coast--telal-alamein', 'north-coast', 'telal-alamein', 'Telal Alamein', 'تلال العلمين', 330),
  ('north-coast--lasirena', 'north-coast', 'lasirena', 'Lasirena', 'لاسيرينا', 340),
  ('north-coast--d-bay', 'north-coast', 'd-bay', 'D-Bay', 'دي باي', 350),
  ('north-coast--la-vista-bay-bay-east', 'north-coast', 'la-vista-bay-bay-east', 'La Vista Bay / Bay East', 'لافيستا باي / باي إيست', 360),
  ('north-coast--jefaira', 'north-coast', 'jefaira', 'Jefaira', 'جيفيرا', 370),
  ('north-coast--the-med', 'north-coast', 'the-med', 'The Med', 'ذا ميد', 380),
  ('north-coast--swan-lake', 'north-coast', 'swan-lake', 'Swan Lake', 'سوان ليك', 390),
  ('north-coast--mountain-view-ras-el-hekma', 'north-coast', 'mountain-view-ras-el-hekma', 'Mountain View Ras El Hekma', 'ماونتن فيو رأس الحكمة', 400),
  ('north-coast--hacienda-west', 'north-coast', 'hacienda-west', 'Hacienda West', 'هاسيندا ويست', 410),
  ('north-coast--caesar-sodic', 'north-coast', 'caesar-sodic', 'Caesar (Sodic)', 'سيزر سوديك', 420),
  ('north-coast--royal-beach', 'north-coast', 'royal-beach', 'Royal Beach', 'رويال بيتش', 430),
  ('north-coast--fouka-bay', 'north-coast', 'fouka-bay', 'Fouka Bay', 'فوكا باي', 440),
  ('north-coast--jumeirah-bay-fouka', 'north-coast', 'jumeirah-bay-fouka', 'Jumeirah Bay (Fouka)', 'جميرا باي (خليج فوكة)', 450),
  ('ain-sokhna--el-ein-bay', 'ain-sokhna', 'el-ein-bay', 'El Ein Bay', 'عين باي', 10),
  ('ain-sokhna--blumar', 'ain-sokhna', 'blumar', 'Blumar', 'بلومار السخنة', 20),
  ('ain-sokhna--azha', 'ain-sokhna', 'azha', 'Azha', 'أزها', 30),
  ('ain-sokhna--marina-wadi-degla', 'ain-sokhna', 'marina-wadi-degla', 'Marina Wadi Degla', 'مارينا وادي دجلة', 40),
  ('ain-sokhna--little-venice', 'ain-sokhna', 'little-venice', 'Little Venice', 'ليتل فينيس', 50),
  ('ain-sokhna--tulip', 'ain-sokhna', 'tulip', 'Tulip', 'توليب السخنة', 60),
  ('ain-sokhna--stella-di-mare', 'ain-sokhna', 'stella-di-mare', 'Stella Di Mare', 'ستيلا دي ماري', 70),
  ('ain-sokhna--palm-beach', 'ain-sokhna', 'palm-beach', 'Palm Beach', 'بالم بيتش', 80),
  ('ain-sokhna--sokhna-hills', 'ain-sokhna', 'sokhna-hills', 'Sokhna Hills', 'السخنة هيلز', 90),
  ('ain-sokhna--blue-bay-asia', 'ain-sokhna', 'blue-bay-asia', 'Blue Bay Asia', 'بلو باي آسيا', 100),
  ('ain-sokhna--laguna-bay', 'ain-sokhna', 'laguna-bay', 'Laguna Bay', 'لاجونا باي', 110),
  ('ain-sokhna--lasirena', 'ain-sokhna', 'lasirena', 'Lasirena', 'لاسيرينا السخنة', 120),
  ('ain-sokhna--lasirena-mini-egypt', 'ain-sokhna', 'lasirena-mini-egypt', 'Lasirena Mini Egypt', 'لاسيرينا ميني إيجيبت', 130),
  ('ain-sokhna--cancun-resort', 'ain-sokhna', 'cancun-resort', 'Cancun Resort', 'كانكون', 140),
  ('ain-sokhna--orlando-1-2', 'ain-sokhna', 'orlando-1-2', 'Orlando 1 & 2', 'أورلاندو 1 و 2', 150),
  ('ain-sokhna--la-vista-1-7', 'ain-sokhna', 'la-vista-1-7', 'La Vista 1–7', 'لافيستا 1–7', 160),
  ('ain-sokhna--il-monte-galala', 'ain-sokhna', 'il-monte-galala', 'Il Monte Galala', 'المونت جلالة', 170),
  ('ain-sokhna--the-groove', 'ain-sokhna', 'the-groove', 'The Groove', 'ذا جروف', 180),
  ('ain-sokhna--jebal-resort', 'ain-sokhna', 'jebal-resort', 'Jebal Resort', 'جبال ريزورت', 190),
  ('ain-sokhna--baymount', 'ain-sokhna', 'baymount', 'Baymount', 'باي ماونت', 200),
  ('ain-sokhna--porto-sokhna', 'ain-sokhna', 'porto-sokhna', 'Porto Sokhna', 'بورتو السخنة', 210),
  ('ain-sokhna--bella-vento', 'ain-sokhna', 'bella-vento', 'Bella Vento', 'بيلا فينتو الجلالة', 220),
  ('ain-sokhna--majesty-bay', 'ain-sokhna', 'majesty-bay', 'Majesty Bay', 'ماجيستي باي الجلالة', 230),
  ('ain-sokhna--sky-city', 'ain-sokhna', 'sky-city', 'Sky City', 'سكاي سيتي الجلالة', 240),
  ('ain-sokhna--carnelia', 'ain-sokhna', 'carnelia', 'Carnelia', 'كارنيليا السخنة', 250),
  ('ain-sokhna--majada', 'ain-sokhna', 'majada', 'Majada', 'ماجادا', 260),
  ('ain-sokhna--telal-sokhna-telal-shores', 'ain-sokhna', 'telal-sokhna-telal-shores', 'Telal Sokhna & Telal Shores', 'تلال السخنة', 270),
  ('ain-sokhna--palm-hills-sokhna', 'ain-sokhna', 'palm-hills-sokhna', 'Palm Hills Sokhna', 'بالم هيلز السخنة', 280),
  ('ain-sokhna--la-vista-ray', 'ain-sokhna', 'la-vista-ray', 'La Vista Ray', 'لافيستا راي', 290),
  ('ain-sokhna--la-vista-gardens', 'ain-sokhna', 'la-vista-gardens', 'La Vista Gardens', 'لافيستا جاردنز', 300),
  ('ain-sokhna--la-vista-topaz', 'ain-sokhna', 'la-vista-topaz', 'La Vista Topaz', 'لافيستا توباز', 310),
  ('ain-sokhna--blue-blue', 'ain-sokhna', 'blue-blue', 'Blue Blue', 'بلو بلو السخنة', 320),
  ('ain-sokhna--bellagio', 'ain-sokhna', 'bellagio', 'Bellagio', 'بلاجيو', 330),
  ('ras-sudr--la-vento-oyoun-mousa', 'ras-sudr', 'la-vento-oyoun-mousa', 'La Vento Oyoun Mousa', 'لافينتو عيون موسى', 10),
  ('ras-sudr--remas', 'ras-sudr', 'remas', 'Remas', 'ريماس', 20),
  ('ras-sudr--coral-beach', 'ras-sudr', 'coral-beach', 'Coral Beach', 'كورال بيتش', 30),
  ('ras-sudr--mousa-coast', 'ras-sudr', 'mousa-coast', 'Mousa Coast', 'موسى كوست', 40),
  ('ras-sudr--paradise', 'ras-sudr', 'paradise', 'Paradise', 'بارادايس رأس سدر', 50),
  ('ras-sudr--matarma-bay', 'ras-sudr', 'matarma-bay', 'Matarma Bay', 'مطارمة باي', 60),
  ('ras-sudr--matarma-residence', 'ras-sudr', 'matarma-residence', 'Matarma Residence', 'مطارمة ريزيدينس', 70),
  ('ras-sudr--la-hacienda', 'ras-sudr', 'la-hacienda', 'La Hacienda', 'لا هاسيندا', 80),
  ('ras-sudr--bay-side', 'ras-sudr', 'bay-side', 'Bay Side', 'باي سايد', 90),
  ('ras-sudr--blue-lagoon', 'ras-sudr', 'blue-lagoon', 'Blue Lagoon', 'بلو لاجون', 100),
  ('ras-sudr--nuzha-beach', 'ras-sudr', 'nuzha-beach', 'Nuzha Beach', 'النزهة بيتش', 110),
  ('ras-sudr--la-playa', 'ras-sudr', 'la-playa', 'La Playa', 'لابلايا', 120),
  ('ras-sudr--lasirena', 'ras-sudr', 'lasirena', 'Lasirena', 'لاسيرينا', 130),
  ('ras-sudr--ladera-red-sea', 'ras-sudr', 'ladera-red-sea', 'Ladera Red Sea', 'لاديرا ريد سي', 140),
  ('ras-sudr--sian', 'ras-sudr', 'sian', 'Sian', 'سيان', 150),
  ('ras-sudr--valley-red-sea', 'ras-sudr', 'valley-red-sea', 'Valley Red Sea', 'فالي ريد سي', 160),
  ('ras-sudr--tavera', 'ras-sudr', 'tavera', 'Tavera', 'تافيرا', 170),
  ('ras-sudr--fantasia', 'ras-sudr', 'fantasia', 'Fantasia', 'فانتازيا', 180),
  ('ras-sudr--white-bay', 'ras-sudr', 'white-bay', 'White Bay', 'وايت باي', 190),
  ('cairo--zamalek', 'cairo', 'zamalek', 'Zamalek', 'الزمالك', 10),
  ('cairo--garden-city', 'cairo', 'garden-city', 'Garden City', 'جاردن سيتي', 20),
  ('cairo--downtown', 'cairo', 'downtown', 'Downtown', 'وسط البلد', 30),
  ('cairo--maadi', 'cairo', 'maadi', 'Maadi', 'المعادي', 40),
  ('cairo--heliopolis', 'cairo', 'heliopolis', 'Heliopolis', 'مصر الجديدة', 50),
  ('cairo--nasr-city', 'cairo', 'nasr-city', 'Nasr City', 'مدينة نصر', 60),
  ('cairo--mokattam', 'cairo', 'mokattam', 'Mokattam', 'المقطم', 70),
  ('cairo--manial', 'cairo', 'manial', 'Manial', 'المنيل', 80),
  ('new-cairo--fifth-settlement', 'new-cairo', 'fifth-settlement', 'Fifth Settlement', 'التجمع الخامس', 10),
  ('new-cairo--first-settlement', 'new-cairo', 'first-settlement', 'First Settlement', 'التجمع الأول', 20),
  ('new-cairo--third-settlement', 'new-cairo', 'third-settlement', 'Third Settlement', 'التجمع الثالث', 30),
  ('new-cairo--rehab', 'new-cairo', 'rehab', 'Rehab', 'الرحاب', 40),
  ('new-cairo--madinaty', 'new-cairo', 'madinaty', 'Madinaty', 'مدينتي', 50),
  ('new-cairo--el-shorouk', 'new-cairo', 'el-shorouk', 'El Shorouk', 'الشروق', 60),
  ('giza--mohandessin', 'giza', 'mohandessin', 'Mohandessin', 'المهندسين', 10),
  ('giza--dokki', 'giza', 'dokki', 'Dokki', 'الدقي', 20),
  ('giza--agouza', 'giza', 'agouza', 'Agouza', 'العجوزة', 30),
  ('giza--haram-pyramids', 'giza', 'haram-pyramids', 'Haram & Pyramids', 'الهرم', 40),
  ('giza--faisal', 'giza', 'faisal', 'Faisal', 'فيصل', 50),
  ('giza--hadayek-el-ahram', 'giza', 'hadayek-el-ahram', 'Hadayek El Ahram', 'حدائق الأهرام', 60),
  ('giza--sheikh-zayed', 'giza', 'sheikh-zayed', 'Sheikh Zayed', 'الشيخ زايد', 70),
  ('giza--6th-of-october', 'giza', '6th-of-october', '6th of October', 'السادس من أكتوبر', 80)
ON CONFLICT (id) DO NOTHING;
