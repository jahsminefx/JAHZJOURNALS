-- AlterTable BlogPost: add notificationSent
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "notificationSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable BlogPostRead
CREATE TABLE IF NOT EXISTS "BlogPostRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable BlogPostReminderLog
CREATE TABLE IF NOT EXISTS "BlogPostReminderLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostReminderLog_pkey" PRIMARY KEY ("id")
);

-- Unique index so a user only has one read record per post
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPostRead_userId_blogPostId_key" ON "BlogPostRead"("userId", "blogPostId");
CREATE INDEX IF NOT EXISTS "BlogPostRead_userId_idx" ON "BlogPostRead"("userId");
CREATE INDEX IF NOT EXISTS "BlogPostRead_blogPostId_idx" ON "BlogPostRead"("blogPostId");

CREATE INDEX IF NOT EXISTS "BlogPostReminderLog_userId_blogPostId_idx" ON "BlogPostReminderLog"("userId", "blogPostId");
CREATE INDEX IF NOT EXISTS "BlogPostReminderLog_sentAt_idx" ON "BlogPostReminderLog"("sentAt");

-- Foreign key constraints
DO $$ BEGIN
    ALTER TABLE "BlogPostRead" ADD CONSTRAINT "BlogPostRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BlogPostRead" ADD CONSTRAINT "BlogPostRead_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
