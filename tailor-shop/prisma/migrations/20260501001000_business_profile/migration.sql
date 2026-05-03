CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL DEFAULT 'Tailor Shop',
    "ownerName" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "logoUrl" TEXT,
    "logoPath" TEXT,
    "brandColor" TEXT,
    "receiptFooterNote" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'ORD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessProfile_active_idx" ON "BusinessProfile"("active");
