import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import { v5 as uuidv5 } from "uuid";

import { User } from "../src/models/User.js";
import { Vendor } from "../src/models/Vendor.js";
import { Product } from "../src/models/Product.js";
import { Payment } from "../src/models/Payment.js";
import { Referral } from "../src/models/Referral.js";
import { WebhookEvent } from "../src/models/WebhookEvent.js";
import { Category } from "../src/models/Category.js";
import { Subdomain } from "../src/models/Subdomain.js";
import { Location } from "../src/models/Location.js";
import { AdminAssignment } from "../src/models/AdminAssignment.js";
import { AdPlacement } from "../src/models/AdPlacement.js";
import { Media } from "../src/models/Media.js";
import { Promotion } from "../src/models/Promotion.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Setting } from "../src/models/Setting.js";

const prisma = new PrismaClient();

// Deterministic mapping: same Mongo ObjectId string => same UUID.
// This preserves backward compatibility while avoiding client-visible ID changes.
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const toMongoId = (val) => (val == null ? null : val.toString());

function objectIdToUuid(mongoId) {
  // uuidv5 expects a string; mongoId is typically 24 hex chars.
  return uuidv5(mongoId, UUID_NAMESPACE);
}

function mustMongoId(val, label) {
  const s = toMongoId(val);
  if (!s) throw new Error(`Missing ${label}`);
  return s;
}

async function migrateInBatches({ model, mapFn, createManyFn, batchSize = 500 }) {
  let batch = [];
  const cursor = model.find({}).lean().cursor();

  for await (const doc of cursor) {
    batch.push(mapFn(doc));
    if (batch.length >= batchSize) {
      await createManyFn(batch);
      batch = [];
    }
  }

  if (batch.length) await createManyFn(batch);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  // 1) Users
  await migrateInBatches({
    model: User,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "User._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        email: d.email,
        passwordHash: d.passwordHash,
        role: d.role,
        status: d.status ?? "active",
        profileFirstName: d.profile?.firstName ?? null,
        profileLastName: d.profile?.lastName ?? null,
        profilePhone: d.profile?.phone ?? null,
        profileRegion: d.profile?.region ?? null,
        profileNotes: d.profile?.notes ?? null,
        lastLoginAt: d.lastLoginAt ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.user.createMany({ data, skipDuplicates: true }),
  });

  // 2) Categories (parent is self-ref: insert first without parent, then patch)
  const allCategories = [];
  for await (const d of Category.find({}).lean().cursor()) {
    allCategories.push(d);
  }

  await prisma.category.createMany({
    data: allCategories.map((d) => {
      const mongoId = mustMongoId(d._id, "Category._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        name: d.name,
        slug: d.slug,
        parentMongoId: null,
        icon: d.icon ?? null,
        createdByMongoId: toMongoId(d.createdBy),
        updatedByMongoId: toMongoId(d.updatedBy),
        status: d.status ?? "active",
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    }),
    skipDuplicates: true,
  });

  for (const d of allCategories) {
    if (!d.parent) continue;
    await prisma.category.update({
      where: { mongoId: d._id.toString() },
      data: { parentMongoId: d.parent.toString() },
    });
  }

  // 3) Locations
  await migrateInBatches({
    model: Location,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Location._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        region: d.region,
        areas: d.areas ?? [],
        registrationFee: d.registrationFee ?? 10000,
        isActive: d.isActive ?? true,
        createdByMongoId: toMongoId(d.createdBy),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.location.createMany({ data, skipDuplicates: true }),
  });

  // 4) Vendors
  await migrateInBatches({
    model: Vendor,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Vendor._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        ownerMongoId: mustMongoId(d.owner, "Vendor.owner"),
        businessName: d.businessName ?? null,
        description: d.description ?? null,
        artisanCategory: d.artisanCategory ?? null,
        logo: d.logo ?? null,
        logoUrl: d.logoUrl ?? null,
        profilePhotoUrl: d.profilePhotoUrl ?? null,
        bannerImage: d.bannerImage ?? null,
        themeColor: d.themeColor ?? "black",
        phoneNumber: d.phoneNumber ?? d.phone ?? null,
        whatsappNumber: d.whatsappNumber ?? d.whatsapp ?? null,
        phone: d.phone ?? d.phoneNumber ?? null,
        whatsapp: d.whatsapp ?? d.whatsappNumber ?? null,
        socialsFacebook: d.socials?.facebook ?? null,
        socialsInstagram: d.socials?.instagram ?? null,
        socialsX: d.socials?.x ?? null,
        socials: d.socials ?? null,
        address: d.address ?? null,
        location: d.location ?? null,
        referralCodeUsed: d.referralCodeUsed ?? null,
        status: d.status ?? "pending",
        subdomain: d.subdomain ?? null,
        addressStreet: d.address?.street ?? null,
        addressCity: d.address?.city ?? null,
        addressState: d.address?.state ?? null,
        addressCountry: d.address?.country ?? null,
        addressPostalCode: d.address?.postalCode ?? null,
        locationRegion: d.location?.region ?? null,
        locationArea: d.location?.area ?? null,
        metaViews: d.meta?.views ?? 0,
        metaFollowers: d.meta?.followers ?? 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.vendor.createMany({ data, skipDuplicates: true }),
  });

  // 5) Subdomains
  await migrateInBatches({
    model: Subdomain,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Subdomain._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        name: d.name,
        vendorMongoId: mustMongoId(d.vendor, "Subdomain.vendor"),
        active: d.active ?? true,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.subdomain.createMany({ data, skipDuplicates: true }),
  });

  // 6) Products
  await migrateInBatches({
    model: Product,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Product._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        vendorMongoId: mustMongoId(d.vendor, "Product.vendor"),
        name: d.name,
        description: d.description ?? null,
        categoryMongoId: mustMongoId(d.category, "Product.category"),
        region: d.region ?? null,
        price: d.price?.toString(),
        discountPrice: d.discountPrice != null ? d.discountPrice.toString() : null,
        promoStart: d.promo?.start ?? null,
        promoEnd: d.promo?.end ?? null,
        sku: d.sku ?? null,
        stock: d.stock ?? 0,
        images: d.images ?? [],
        tags: d.tags ?? [],
        variants: d.variants ?? null,
        status: d.status ?? "pending",
        rejectionNote: d.rejectionNote ?? null,
        metaViews: d.meta?.views ?? 0,
        metaSales: d.meta?.sales ?? 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.product.createMany({ data, skipDuplicates: true }),
  });

  // 7) Media
  await migrateInBatches({
    model: Media,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Media._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        url: d.url,
        provider: d.provider ?? "cloudinary",
        folder: d.folder ?? null,
        ownerUserMongoId: mustMongoId(d.ownerUser, "Media.ownerUser"),
        vendorMongoId: toMongoId(d.vendor),
        width: d.width ?? null,
        height: d.height ?? null,
        mime: d.mime ?? null,
        size: d.size ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.media.createMany({ data, skipDuplicates: true }),
  });

  // 8) AdPlacements
  await migrateInBatches({
    model: AdPlacement,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "AdPlacement._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        slot: d.slot,
        imageUrl: d.imageUrl,
        description: d.description,
        price: d.price?.toString(),
        startDate: d.startDate,
        endDate: d.endDate,
        targetUrl: d.targetUrl ?? null,
        active: d.active ?? true,
        priority: d.priority ?? 0,
        createdByMongoId: mustMongoId(d.createdBy, "AdPlacement.createdBy"),
        updatedByMongoId: toMongoId(d.updatedBy),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.adPlacement.createMany({ data, skipDuplicates: true }),
  });

  // 9) AdminAssignments
  await migrateInBatches({
    model: AdminAssignment,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "AdminAssignment._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        adminUserMongoId: mustMongoId(d.adminUser, "AdminAssignment.adminUser"),
        vendorMongoId: mustMongoId(d.vendor, "AdminAssignment.vendor"),
        region: d.region ?? null,
        notes: d.notes ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.adminAssignment.createMany({ data, skipDuplicates: true }),
  });

  // 10) Referrals
  await migrateInBatches({
    model: Referral,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Referral._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        code: d.code,
        label: d.label ?? null,
        maxUses: d.maxUses ?? null,
        usedCount: d.usedCount ?? 0,
        expiresAt: d.expiresAt ?? "0",
        discountPercent: d.discountPercent,
        createdByMongoId: toMongoId(d.createdBy),
        status: d.status ?? "active",
        lastUsedAt: d.lastUsedAt ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.referral.createMany({ data, skipDuplicates: true }),
  });

  // 11) Payments
  await migrateInBatches({
    model: Payment,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Payment._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        type: d.type,
        amount: d.amount?.toString(),
        currency: d.currency ?? "NGN",
        provider: d.provider ?? "paystack",
        reference: d.reference,
        status: d.status ?? "pending",
        userMongoId: toMongoId(d.user),
        vendorMongoId: toMongoId(d.vendor),
        metadata: d.metadata ?? null,
        paidAt: d.paidAt ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.payment.createMany({ data, skipDuplicates: true }),
  });

  // 12) Promotions
  await migrateInBatches({
    model: Promotion,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Promotion._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        title: d.title,
        description: d.description ?? null,
        productMongoId: toMongoId(d.product),
        vendorMongoId: toMongoId(d.vendor),
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        createdByMongoId: mustMongoId(d.createdBy, "Promotion.createdBy"),
        active: d.active ?? true,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.promotion.createMany({ data, skipDuplicates: true }),
  });

  // 13) AuditLogs
  await migrateInBatches({
    model: AuditLog,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "AuditLog._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        userMongoId: mustMongoId(d.user, "AuditLog.user"),
        action: d.action,
        resource: d.resource,
        resourceId: toMongoId(d.resourceId),
        changes: d.changes ?? null,
        ipAddress: d.ipAddress ?? null,
        userAgent: d.userAgent ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.auditLog.createMany({ data, skipDuplicates: true }),
  });

  // 14) Settings
  await migrateInBatches({
    model: Setting,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "Setting._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        key: d.key,
        value: d.value ?? null,
        description: d.description ?? null,
        updatedByMongoId: toMongoId(d.updatedBy),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.setting.createMany({ data, skipDuplicates: true }),
  });

  // 15) WebhookEvents
  await migrateInBatches({
    model: WebhookEvent,
    mapFn: (d) => {
      const mongoId = mustMongoId(d._id, "WebhookEvent._id");
      return {
        id: objectIdToUuid(mongoId),
        mongoId,
        provider: d.provider,
        eventId: d.eventId,
        eventType: d.eventType ?? null,
        payload: d.payload ?? null,
        processed: d.processed ?? false,
        processedAt: d.processedAt ?? null,
        error: d.error ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    },
    createManyFn: (data) => prisma.webhookEvent.createMany({ data, skipDuplicates: true }),
  });

  console.log("Mongo -> Postgres migration completed.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });

