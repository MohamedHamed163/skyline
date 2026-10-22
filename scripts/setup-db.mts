// Creates the tables and, if the database is empty, loads the sample data.
// Run with `npm run db:setup` (reads DATABASE_URL from .env.local).
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { seedCounters, seedLeads, seedProperties } from "../src/lib/seed.ts";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `vercel env pull` first.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

await sql.unsafe(fs.readFileSync(path.join(import.meta.dirname, "../src/lib/schema.sql"), "utf8"));
console.log("Schema is up to date.");

const [{ count }] = await sql`SELECT count(*)::int AS count FROM properties`;
if (count > 0) {
  console.log(`Database already has ${count} properties — sample data not loaded.`);
} else {
  for (const p of seedProperties()) {
    await sql`INSERT INTO properties ${sql({
      id: p.id,
      code: p.code,
      title: p.title,
      listing_type: p.listingType,
      featured: p.featured,
      type: p.type,
      location: p.location,
      compound: p.compound,
      area: p.area,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      price: p.price,
      area_max: p.areaMax,
      bedrooms_max: p.bedroomsMax,
      bathrooms_max: p.bathroomsMax,
      floor_max: p.floorMax,
      price_max: p.priceMax,
      description: p.description,
      developer_description: p.developerDescription,
      features: sql.json(p.features),
      photos: sql.json(p.photos),
      seller_type: p.seller.type,
      seller_name: p.seller.name,
      seller_phone: p.seller.phone,
      seller_whatsapp: p.seller.whatsapp,
      seller_company: p.seller.company,
      status: p.status,
      previous_status: p.previousStatus,
      admin_notes: p.adminNotes,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })}`;
  }
  for (const l of seedLeads()) {
    await sql`INSERT INTO leads ${sql({
      id: l.id,
      property_id: l.propertyId,
      property_code: l.propertyCode,
      property_title: l.propertyTitle,
      name: l.name,
      phone: l.phone,
      whatsapp: l.whatsapp,
      email: l.email,
      message: l.message,
      status: l.status,
      notes: l.notes,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
    })}`;
  }
  // Continue the code counters after the sample codes.
  const counters = seedCounters();
  await sql`SELECT setval('property_code_premium', ${counters.primary}), setval('property_code_resale', ${counters.resale})`;
  console.log("Sample data loaded.");
}

await sql.end();
