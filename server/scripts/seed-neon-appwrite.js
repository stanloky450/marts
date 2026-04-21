import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";

const { Client } = pg;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function mongoId() {
  return crypto.randomBytes(12).toString("hex");
}

async function createUser(client, { email, password, role, firstName, lastName }) {
  const existing = await client.query(`SELECT id, "mongoId", email FROM "User" WHERE email = $1`, [email]);
  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await client.query(
    `INSERT INTO "User" ("id", "mongoId", email, "passwordHash", role, status, "profileFirstName", "profileLastName", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4::"UserRole", 'active'::"UserStatus", $5, $6, NOW(), NOW())
     RETURNING id, "mongoId", email`,
    [mongoId(), email, hashedPassword, role, firstName, lastName]
  );

  return result.rows[0];
}

async function createSettings(client) {
  const settings = [
    ["site.name", "Commm Storefront", "Global site name"],
    ["site.currency", "NGN", "Default currency"],
    ["site.supportEmail", "support@example.com", "Support contact"],
  ];

  for (const [key, value, description] of settings) {
    await client.query(
      `INSERT INTO "Setting" ("id", "mongoId", key, value, description, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, NOW(), NOW())
       ON CONFLICT (key) DO NOTHING`,
      [mongoId(), key, JSON.stringify(value), description]
    );
  }
}

async function createCategories(client, superAdminMongoId) {
  const categories = [
    ["Electronics", "electronics"],
    ["Fashion", "fashion"],
    ["Home & Garden", "home-garden"],
    ["Sports & Outdoors", "sports-outdoors"],
    ["Books", "books"],
    ["Toys & Games", "toys-games"],
    ["Health & Beauty", "health-beauty"],
    ["Food & Beverages", "food-beverages"],
  ];

  for (const [name, slug] of categories) {
    await client.query(
      `INSERT INTO "Category" ("id", "mongoId", name, slug, "createdByMongoId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active'::"CategoryStatus", NOW(), NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [mongoId(), name, slug, superAdminMongoId]
    );
  }

  const result = await client.query(`SELECT "mongoId", slug FROM "Category"`);
  return Object.fromEntries(result.rows.map((row) => [row.slug, row.mongoId]));
}

async function createVendorBundle(client, entry) {
  const user = await createUser(client, entry.user);

  const existingVendor = await client.query(
    `SELECT id, "mongoId", subdomain FROM "Vendor" WHERE "ownerMongoId" = $1 LIMIT 1`,
    [user.mongoId]
  );

  let vendor = existingVendor.rows[0];
  if (!vendor) {
    const createdVendor = await client.query(
      `INSERT INTO "Vendor" (
         "id", "mongoId", "ownerMongoId", "businessName", description, phone, status, subdomain, address, "createdAt", "updatedAt"
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6::"VendorStatus", $7, $8::jsonb, NOW(), NOW()
       )
       RETURNING id, "mongoId", subdomain`,
      [
        mongoId(),
        user.mongoId,
        entry.vendor.businessName,
        entry.vendor.description,
        entry.vendor.phone,
        entry.vendor.status,
        entry.vendor.subdomain,
        JSON.stringify(entry.vendor.address),
      ]
    );
    vendor = createdVendor.rows[0];
  }

  if (entry.vendor.subdomain) {
    await client.query(
      `INSERT INTO "Subdomain" ("id", "mongoId", name, "vendorMongoId", active, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, TRUE, NOW(), NOW())
       ON CONFLICT (name) DO NOTHING`,
      [mongoId(), entry.vendor.subdomain, vendor.mongoId]
    );
  }

  const paymentRef = `REG-${vendor.mongoId.slice(0, 6)}-${Date.now().toString().slice(-6)}`;
  await client.query(
    `INSERT INTO "Payment" (
       "id", "mongoId", type, amount, currency, provider, reference, status, "userMongoId", "vendorMongoId", metadata, "paidAt", "createdAt", "updatedAt"
     )
     SELECT gen_random_uuid(), $1::varchar, 'registration'::"PaymentType", 5000, 'NGN', 'paystack'::"PaymentProvider", $2::text, 'success'::"PaymentStatus", $3::varchar, $4::varchar, $5::jsonb, NOW(), NOW(), NOW()
     WHERE NOT EXISTS (SELECT 1 FROM "Payment" WHERE "vendorMongoId" = $4::varchar AND type = 'registration'::"PaymentType")`,
    [mongoId(), paymentRef, user.mongoId, vendor.mongoId, JSON.stringify({ note: "Seeded registration payment" })]
  );

  return { user, vendor };
}

async function createProducts(client, vendorMongoId, categoryMap) {
  const products = [
    ["Wireless Headphones", "Noise-cancelling over-ear headphones", "electronics", "199.99", 50, ["audio", "wireless"]],
    ["Fitness Tracker", "Waterproof fitness band with heart rate monitor", "electronics", "69.99", 120, ["fitness", "wearable"]],
    ["Casual T-Shirt", "100% cotton unisex tee", "fashion", "19.99", 200, ["clothing"]],
  ];

  for (const [name, description, categorySlug, price, stock, tags] of products) {
    await client.query(
      `INSERT INTO "Product" (
         "id", "mongoId", "vendorMongoId", name, description, "categoryMongoId", price, stock, tags, status, "createdAt", "updatedAt"
       )
       SELECT gen_random_uuid(), $1::varchar, $2::varchar, $3::text, $4::text, $5::varchar, $6::decimal, $7::integer, $8::text[], 'approved'::"ProductStatus", NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE "vendorMongoId" = $2::varchar AND name = $3::text)`,
      [mongoId(), vendorMongoId, name, description, categoryMap[categorySlug], price, stock, tags]
    );
  }
}

async function main() {
  const connectionString = requireEnv("DATABASE_URL");
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    const superAdmin = await createUser(client, {
      email: "superadmin@ecommerce.com",
      password: "SuperAdmin123!",
      role: "super_admin",
      firstName: "Super",
      lastName: "Admin",
    });

    await createUser(client, {
      email: "adminweb@ecommerce.com",
      password: "Admin123!",
      role: "admin",
      firstName: "Web",
      lastName: "Admin",
    });

    await createSettings(client);
    const categoryMap = await createCategories(client, superAdmin.mongoId);

    const vendors = [
      {
        user: {
          email: "vendor1@example.com",
          password: "Vendor123!",
          role: "vendor",
          firstName: "Alice",
          lastName: "Vendor",
        },
        vendor: {
          businessName: "Alice Electronics",
          description: "Quality gadgets and electronics",
          phone: "+1-555-1001",
          status: "active",
          subdomain: "alice-electronics",
          address: { city: "Lagos", country: "NG" },
        },
      },
      {
        user: {
          email: "vendor2@example.com",
          password: "Vendor123!",
          role: "vendor",
          firstName: "Bob",
          lastName: "Vendor",
        },
        vendor: {
          businessName: "Bob Fashion House",
          description: "Trendy fashion and accessories",
          phone: "+1-555-1002",
          status: "active",
          subdomain: "bob-fashion",
          address: { city: "Abuja", country: "NG" },
        },
      },
    ];

    for (const entry of vendors) {
      const { vendor } = await createVendorBundle(client, entry);
      await createProducts(client, vendor.mongoId, categoryMap);
    }

    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "User")::int AS users,
        (SELECT COUNT(*) FROM "Vendor")::int AS vendors,
        (SELECT COUNT(*) FROM "Category")::int AS categories,
        (SELECT COUNT(*) FROM "Product")::int AS products,
        (SELECT COUNT(*) FROM "Payment")::int AS payments
    `);

    console.log(JSON.stringify(summary.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
