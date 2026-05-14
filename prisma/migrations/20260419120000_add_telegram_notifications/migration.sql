-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "telegramRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "telegramReminderHour" INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN "lastTelegramDigestSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "telegram_connections" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "telegramFirstName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_link_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_reminder_deliveries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramConnectionId" TEXT NOT NULL,
  "reminderType" "ReminderEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "callbackToken" TEXT NOT NULL,
  "telegramMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "actionTaken" TEXT,
  "actionTakenAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "telegram_reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_state" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "lastUpdateId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "telegram_bot_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connections_userId_key" ON "telegram_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connections_telegramChatId_key" ON "telegram_connections"("telegramChatId");

-- CreateIndex
CREATE INDEX "telegram_connections_telegramUserId_idx" ON "telegram_connections"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_tokens_token_key" ON "telegram_link_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_link_tokens_userId_idx" ON "telegram_link_tokens"("userId");

-- CreateIndex
CREATE INDEX "telegram_link_tokens_expiresAt_idx" ON "telegram_link_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_reminder_deliveries_callbackToken_key" ON "telegram_reminder_deliveries"("callbackToken");

-- CreateIndex
CREATE INDEX "telegram_reminder_deliveries_userId_sentAt_idx" ON "telegram_reminder_deliveries"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "telegram_reminder_deliveries_entityId_reminderType_idx" ON "telegram_reminder_deliveries"("entityId", "reminderType");

-- CreateIndex
CREATE INDEX "telegram_reminder_deliveries_telegramConnectionId_idx" ON "telegram_reminder_deliveries"("telegramConnectionId");

-- AddForeignKey
ALTER TABLE "telegram_connections"
  ADD CONSTRAINT "telegram_connections_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_link_tokens"
  ADD CONSTRAINT "telegram_link_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_reminder_deliveries"
  ADD CONSTRAINT "telegram_reminder_deliveries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_reminder_deliveries"
  ADD CONSTRAINT "telegram_reminder_deliveries_telegramConnectionId_fkey"
  FOREIGN KEY ("telegramConnectionId") REFERENCES "telegram_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
