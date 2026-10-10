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

-- Property-code counters. Sequences never hand out the same number twice.
CREATE SEQUENCE IF NOT EXISTS property_code_premium;
CREATE SEQUENCE IF NOT EXISTS property_code_resale;
CREATE SEQUENCE IF NOT EXISTS property_code_rent;
