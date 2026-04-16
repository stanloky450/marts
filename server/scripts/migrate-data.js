import mongoose from 'mongoose';
import { PrismaClient } from '../generated/prisma-client/index.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Map MongoDB Models to Prisma Models
// This script assumes the schema.prisma is generated and uses `mongoId` for references.

async function migrate() {
  console.log('--- Starting Migration: MongoDB to PostgreSQL ---');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Mongoose Models (Import these based on your actual file paths)
    const { User } = await import('../src/models/User.js');
    const { Vendor } = await import('../src/models/Vendor.js');
    const { Product } = await import('../src/models/Product.js');
    const { Category } = await import('../src/models/Category.js');
    const { Location } = await import('../src/models/Location.js');
    const { Payment } = await import('../src/models/Payment.js');
    const { Promotion } = await import('../src/models/Promotion.js');
    const { Referral } = await import('../src/models/Referral.js');
    const { AdPlacement } = await import('../src/models/AdPlacement.js');
    const { AdminAssignment } = await import('../src/models/AdminAssignment.js');
    const { AuditLog } = await import('../src/models/AuditLog.js');
    const { Media } = await import('../src/models/Media.js');
    const { Setting } = await import('../src/models/Setting.js');
    const { Subdomain } = await import('../src/models/Subdomain.js');
    const { WebhookEvent } = await import('../src/models/WebhookEvent.js');

    // Helper to log progress
    const log = (model, count) => console.log(`Migrated ${count} records for model: ${model}`);

    // Order is important due to foreign key constraints!
    // 1. Independent Models
    
    // USERS
    const users = await User.find({}).lean();
    for (const u of users) {
      await prisma.user.upsert({
        where: { mongoId: u._id.toString() },
        update: {},
        create: {
          mongoId: u._id.toString(),
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role,
          status: u.status,
          profileFirstName: u.profile?.firstName,
          profileLastName: u.profile?.lastName,
          profilePhone: u.profile?.phone,
          profileRegion: u.profile?.region,
          profileNotes: u.profile?.notes,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        }
      });
    }
    log('User', users.length);

    // CATEGORIES (Handle parent/child carefully)
    const categories = await Category.find({}).lean();
    // Sort so parents come before children if possible, or use recursive or multi-pass
    // For simplicity, we use upsert which handles dependencies if keys exist
    for (const c of categories) {
      await prisma.category.upsert({
        where: { mongoId: c._id.toString() },
        update: {},
        create: {
          mongoId: c._id.toString(),
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          status: c.status,
          parentMongoId: c.parent?.toString(),
          createdByMongoId: c.createdBy?.toString(),
          updatedByMongoId: c.updatedBy?.toString(),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
      });
    }
    log('Category', categories.length);

    // LOCATIONS
    const locations = await Location.find({}).lean();
    for (const l of locations) {
      await prisma.location.upsert({
        where: { mongoId: l._id.toString() },
        update: {},
        create: {
          mongoId: l._id.toString(),
          region: l.region,
          areas: l.areas,
          registrationFee: l.registrationFee,
          isActive: l.isActive,
          createdByMongoId: l.createdBy?.toString(),
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        }
      });
    }
    log('Location', locations.length);

    // VENDORS (Depends on User)
    const vendors = await Vendor.find({}).lean();
    for (const v of vendors) {
      await prisma.vendor.upsert({
        where: { mongoId: v._id.toString() },
        update: {},
        create: {
          mongoId: v._id.toString(),
          ownerMongoId: v.owner.toString(),
          businessName: v.businessName,
          description: v.description,
          artisanCategory: v.artisanCategory,
          logo: v.logo,
          logoUrl: v.logoUrl,
          profilePhotoUrl: v.profilePhotoUrl,
          bannerImage: v.bannerImage,
          themeColor: v.themeColor,
          phoneNumber: v.phoneNumber,
          whatsappNumber: v.whatsappNumber,
          socials: v.socials,
          address: v.address,
          location: v.location,
          referralCodeUsed: v.referralCodeUsed,
          status: v.status,
          subdomain: v.subdomain,
          metaViews: v.meta?.views || 0,
          metaFollowers: v.meta?.followers || 0,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          // API Compatibility fields
          phone: v.phoneNumber,
          whatsapp: v.whatsappNumber,
        }
      });
    }
    log('Vendor', vendors.length);

    // PRODUCTS (Depends on Vendor and Category)
    const products = await Product.find({}).lean();
    for (const p of products) {
      await prisma.product.upsert({
        where: { mongoId: p._id.toString() },
        update: {},
        create: {
          mongoId: p._id.toString(),
          vendorMongoId: p.vendor.toString(),
          categoryMongoId: p.category.toString(),
          name: p.name,
          description: p.description,
          region: p.region,
          price: p.price,
          discountPrice: p.discountPrice,
          promoStart: p.promo?.start,
          promoEnd: p.promo?.end,
          sku: p.sku,
          stock: p.stock,
          images: p.images,
          tags: p.tags,
          variants: p.variants,
          status: p.status,
          rejectionNote: p.rejectionNote,
          metaViews: p.meta?.views || 0,
          metaSales: p.meta?.sales || 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }
      });
    }
    log('Product', products.length);

    // PAYMENTS (Depends on User and Vendor)
    const payments = await Payment.find({}).lean();
    for (const pay of payments) {
      await prisma.payment.upsert({
        where: { mongoId: pay._id.toString() },
        update: {},
        create: {
          mongoId: pay._id.toString(),
          type: pay.type,
          amount: pay.amount,
          currency: pay.currency,
          provider: pay.provider,
          reference: pay.reference,
          status: pay.status,
          userMongoId: pay.user?.toString(),
          vendorMongoId: pay.vendor?.toString(),
          metadata: pay.metadata,
          paidAt: pay.paidAt,
          createdAt: pay.createdAt,
          updatedAt: pay.updatedAt,
        }
      });
    }
    log('Payment', payments.length);

    // REFERRALS
    const referrals = await Referral.find({}).lean();
    for (const r of referrals) {
      await prisma.referral.upsert({
        where: { mongoId: r._id.toString() },
        update: {},
        create: {
          mongoId: r._id.toString(),
          code: r.code,
          label: r.label,
          maxUses: r.maxUses,
          usedCount: r.usedCount,
          expiresAt: r.expiresAt,
          discountPercent: r.discountPercent,
          createdByMongoId: r.createdBy?.toString(),
          status: r.status,
          lastUsedAt: r.lastUsedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }
      });
    }
    log('Referral', referrals.length);

    console.log('--- Migration Completed Successfully ---');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

migrate();
