-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'vendor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('registration', 'order');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('paystack');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AdSlot" AS ENUM ('home_hero', 'mid_banner', 'sidebar', 'footer');

-- CreateEnum
CREATE TYPE "MediaProvider" AS ENUM ('cloudinary', 's3');

-- CreateEnum
CREATE TYPE "ThemeColor" AS ENUM ('black', 'deep_blue', 'green', 'purple_blue');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "profileFirstName" TEXT,
    "profileLastName" TEXT,
    "profilePhone" TEXT,
    "profileRegion" TEXT,
    "profileNotes" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "ownerMongoId" VARCHAR(24) NOT NULL,
    "businessName" TEXT,
    "description" TEXT,
    "artisanCategory" TEXT,
    "logo" TEXT,
    "logoUrl" TEXT,
    "profilePhotoUrl" TEXT,
    "bannerImage" TEXT,
    "themeColor" "ThemeColor" NOT NULL DEFAULT 'black',
    "phoneNumber" TEXT,
    "whatsappNumber" TEXT,
    "socialsFacebook" TEXT,
    "socialsInstagram" TEXT,
    "socialsX" TEXT,
    "referralCodeUsed" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'pending',
    "subdomain" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressCountry" TEXT,
    "addressPostalCode" TEXT,
    "locationRegion" TEXT,
    "locationArea" TEXT,
    "metaViews" INTEGER NOT NULL DEFAULT 0,
    "metaFollowers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" TEXT,
    "whatsapp" TEXT,
    "socials" JSONB,
    "address" JSONB,
    "location" JSONB,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentMongoId" VARCHAR(24),
    "icon" TEXT,
    "createdByMongoId" VARCHAR(24),
    "updatedByMongoId" VARCHAR(24),
    "status" "CategoryStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "vendorMongoId" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryMongoId" VARCHAR(24) NOT NULL,
    "region" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "discountPrice" DECIMAL(65,30),
    "promoStart" TIMESTAMP(3),
    "promoEnd" TIMESTAMP(3),
    "sku" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[],
    "tags" TEXT[],
    "variants" JSONB,
    "status" "ProductStatus" NOT NULL DEFAULT 'pending',
    "rejectionNote" TEXT,
    "metaViews" INTEGER NOT NULL DEFAULT 0,
    "metaSales" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "region" TEXT NOT NULL,
    "areas" TEXT[],
    "registrationFee" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByMongoId" VARCHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subdomain" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "vendorMongoId" VARCHAR(24) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subdomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacement" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "slot" "AdSlot" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdByMongoId" VARCHAR(24) NOT NULL,
    "updatedByMongoId" VARCHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAssignment" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "adminUserMongoId" VARCHAR(24) NOT NULL,
    "vendorMongoId" VARCHAR(24) NOT NULL,
    "region" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'paystack',
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "userMongoId" VARCHAR(24),
    "vendorMongoId" VARCHAR(24),
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TEXT NOT NULL DEFAULT '0',
    "discountPercent" INTEGER NOT NULL,
    "createdByMongoId" VARCHAR(24),
    "status" "ReferralStatus" NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "productMongoId" VARCHAR(24),
    "vendorMongoId" VARCHAR(24),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdByMongoId" VARCHAR(24) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "userMongoId" VARCHAR(24) NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "description" TEXT,
    "updatedByMongoId" VARCHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" UUID NOT NULL,
    "mongoId" VARCHAR(24) NOT NULL,
    "url" TEXT NOT NULL,
    "provider" "MediaProvider" NOT NULL DEFAULT 'cloudinary',
    "folder" TEXT,
    "ownerUserMongoId" VARCHAR(24) NOT NULL,
    "vendorMongoId" VARCHAR(24),
    "width" INTEGER,
    "height" INTEGER,
    "mime" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mongoId_key" ON "User"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_mongoId_key" ON "Vendor"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_subdomain_key" ON "Vendor"("subdomain");

-- CreateIndex
CREATE INDEX "Vendor_ownerMongoId_status_idx" ON "Vendor"("ownerMongoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Category_mongoId_key" ON "Category"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_mongoId_key" ON "Product"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_vendorMongoId_status_idx" ON "Product"("vendorMongoId", "status");

-- CreateIndex
CREATE INDEX "Product_categoryMongoId_status_idx" ON "Product"("categoryMongoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Location_mongoId_key" ON "Location"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_region_key" ON "Location"("region");

-- CreateIndex
CREATE UNIQUE INDEX "Subdomain_mongoId_key" ON "Subdomain"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Subdomain_name_key" ON "Subdomain"("name");

-- CreateIndex
CREATE INDEX "Subdomain_vendorMongoId_idx" ON "Subdomain"("vendorMongoId");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlacement_mongoId_key" ON "AdPlacement"("mongoId");

-- CreateIndex
CREATE INDEX "AdPlacement_slot_active_idx" ON "AdPlacement"("slot", "active");

-- CreateIndex
CREATE INDEX "AdPlacement_priority_idx" ON "AdPlacement"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAssignment_mongoId_key" ON "AdminAssignment"("mongoId");

-- CreateIndex
CREATE INDEX "AdminAssignment_adminUserMongoId_idx" ON "AdminAssignment"("adminUserMongoId");

-- CreateIndex
CREATE INDEX "AdminAssignment_vendorMongoId_idx" ON "AdminAssignment"("vendorMongoId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAssignment_adminUserMongoId_vendorMongoId_key" ON "AdminAssignment"("adminUserMongoId", "vendorMongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mongoId_key" ON "Payment"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_type_idx" ON "Payment"("type");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_userMongoId_idx" ON "Payment"("userMongoId");

-- CreateIndex
CREATE INDEX "Payment_vendorMongoId_status_idx" ON "Payment"("vendorMongoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_mongoId_key" ON "WebhookEvent"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_processed_idx" ON "WebhookEvent"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_mongoId_key" ON "Referral"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_mongoId_key" ON "Promotion"("mongoId");

-- CreateIndex
CREATE INDEX "Promotion_startsAt_endsAt_idx" ON "Promotion"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_active_idx" ON "Promotion"("active");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_mongoId_key" ON "AuditLog"("mongoId");

-- CreateIndex
CREATE INDEX "AuditLog_userMongoId_idx" ON "AuditLog"("userMongoId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_mongoId_key" ON "Setting"("mongoId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Media_mongoId_key" ON "Media"("mongoId");

-- CreateIndex
CREATE INDEX "Media_ownerUserMongoId_idx" ON "Media"("ownerUserMongoId");

-- CreateIndex
CREATE INDEX "Media_vendorMongoId_idx" ON "Media"("vendorMongoId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_ownerMongoId_fkey" FOREIGN KEY ("ownerMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentMongoId_fkey" FOREIGN KEY ("parentMongoId") REFERENCES "Category"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryMongoId_fkey" FOREIGN KEY ("categoryMongoId") REFERENCES "Category"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_createdByMongoId_fkey" FOREIGN KEY ("createdByMongoId") REFERENCES "User"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subdomain" ADD CONSTRAINT "Subdomain_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlacement" ADD CONSTRAINT "AdPlacement_createdByMongoId_fkey" FOREIGN KEY ("createdByMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlacement" ADD CONSTRAINT "AdPlacement_updatedByMongoId_fkey" FOREIGN KEY ("updatedByMongoId") REFERENCES "User"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAssignment" ADD CONSTRAINT "AdminAssignment_adminUserMongoId_fkey" FOREIGN KEY ("adminUserMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAssignment" ADD CONSTRAINT "AdminAssignment_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userMongoId_fkey" FOREIGN KEY ("userMongoId") REFERENCES "User"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_createdByMongoId_fkey" FOREIGN KEY ("createdByMongoId") REFERENCES "User"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productMongoId_fkey" FOREIGN KEY ("productMongoId") REFERENCES "Product"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdByMongoId_fkey" FOREIGN KEY ("createdByMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userMongoId_fkey" FOREIGN KEY ("userMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedByMongoId_fkey" FOREIGN KEY ("updatedByMongoId") REFERENCES "User"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_ownerUserMongoId_fkey" FOREIGN KEY ("ownerUserMongoId") REFERENCES "User"("mongoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_vendorMongoId_fkey" FOREIGN KEY ("vendorMongoId") REFERENCES "Vendor"("mongoId") ON DELETE SET NULL ON UPDATE CASCADE;
