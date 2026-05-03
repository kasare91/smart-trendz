CREATE TABLE "OrderNotificationLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "windowDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderNotificationLog_orderId_reminderType_windowDate_key" ON "OrderNotificationLog"("orderId", "reminderType", "windowDate");
CREATE INDEX "OrderNotificationLog_orderId_idx" ON "OrderNotificationLog"("orderId");
CREATE INDEX "OrderNotificationLog_reminderType_idx" ON "OrderNotificationLog"("reminderType");
CREATE INDEX "OrderNotificationLog_windowDate_idx" ON "OrderNotificationLog"("windowDate");

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "OrderNotificationLog" ADD CONSTRAINT "OrderNotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
