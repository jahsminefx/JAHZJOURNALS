-- CreateTable CohortTradeShare
CREATE TABLE IF NOT EXISTS "CohortTradeShare" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "sourceTradeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "title" TEXT,
    "tradeSnapshot" JSONB NOT NULL,
    "setupThesis" TEXT,
    "entryReasoning" TEXT,
    "riskRationale" TEXT,
    "managementReasoning" TEXT,
    "outcomeLessons" TEXT,
    "generalNotes" TEXT,
    "attachments" JSONB,
    "isCaseStudy" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortTradeShare_pkey" PRIMARY KEY ("id")
);

-- Indexes for CohortTradeShare
CREATE INDEX IF NOT EXISTS "CohortTradeShare_mentorId_idx" ON "CohortTradeShare"("mentorId");
CREATE INDEX IF NOT EXISTS "CohortTradeShare_sourceTradeId_idx" ON "CohortTradeShare"("sourceTradeId");
CREATE INDEX IF NOT EXISTS "CohortTradeShare_status_publishedAt_idx" ON "CohortTradeShare"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "CohortTradeShare_status_pinned_publishedAt_idx" ON "CohortTradeShare"("status", "pinned", "publishedAt");

-- CreateTable CohortTradeShareTarget
CREATE TABLE IF NOT EXISTS "CohortTradeShareTarget" (
    "id" TEXT NOT NULL,
    "tradeShareId" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortTradeShareTarget_pkey" PRIMARY KEY ("id")
);

-- Unique index and indexes for CohortTradeShareTarget
CREATE UNIQUE INDEX IF NOT EXISTS "CohortTradeShareTarget_tradeShareId_mentorGroupId_key" ON "CohortTradeShareTarget"("tradeShareId", "mentorGroupId");
CREATE INDEX IF NOT EXISTS "CohortTradeShareTarget_mentorGroupId_idx" ON "CohortTradeShareTarget"("mentorGroupId");
CREATE INDEX IF NOT EXISTS "CohortTradeShareTarget_tradeShareId_idx" ON "CohortTradeShareTarget"("tradeShareId");

-- CreateTable CohortAnnouncement
CREATE TABLE IF NOT EXISTS "CohortAnnouncement" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "attachments" JSONB,
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortAnnouncement_pkey" PRIMARY KEY ("id")
);

-- Indexes for CohortAnnouncement
CREATE INDEX IF NOT EXISTS "CohortAnnouncement_mentorGroupId_status_publishedAt_idx" ON "CohortAnnouncement"("mentorGroupId", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "CohortAnnouncement_mentorGroupId_status_isPinned_publishedAt_idx" ON "CohortAnnouncement"("mentorGroupId", "status", "isPinned", "publishedAt");
CREATE INDEX IF NOT EXISTS "CohortAnnouncement_mentorId_idx" ON "CohortAnnouncement"("mentorId");

-- CreateTable CohortFeedReadState
CREATE TABLE IF NOT EXISTS "CohortFeedReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "tradeShareId" TEXT,
    "announcementId" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortFeedReadState_pkey" PRIMARY KEY ("id")
);

-- Unique indexes and indexes for CohortFeedReadState
CREATE UNIQUE INDEX IF NOT EXISTS "CohortFeedReadState_userId_itemType_tradeShareId_key" ON "CohortFeedReadState"("userId", "itemType", "tradeShareId");
CREATE UNIQUE INDEX IF NOT EXISTS "CohortFeedReadState_userId_itemType_announcementId_key" ON "CohortFeedReadState"("userId", "itemType", "announcementId");
CREATE INDEX IF NOT EXISTS "CohortFeedReadState_userId_idx" ON "CohortFeedReadState"("userId");
CREATE INDEX IF NOT EXISTS "CohortFeedReadState_tradeShareId_idx" ON "CohortFeedReadState"("tradeShareId");
CREATE INDEX IF NOT EXISTS "CohortFeedReadState_announcementId_idx" ON "CohortFeedReadState"("announcementId");

-- CreateTable MentorDirectMessage
CREATE TABLE IF NOT EXISTS "MentorDirectMessage" (
    "id" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tradeShareId" TEXT,
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorDirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MentorDirectMessage_mentorGroupId_mentorId_studentId_createdAt_idx" ON "MentorDirectMessage"("mentorGroupId", "mentorId", "studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "MentorDirectMessage_mentorId_isRead_idx" ON "MentorDirectMessage"("mentorId", "isRead");
CREATE INDEX IF NOT EXISTS "MentorDirectMessage_studentId_isRead_idx" ON "MentorDirectMessage"("studentId", "isRead");

-- Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorDirectMessage_mentorGroupId_fkey') THEN
        ALTER TABLE "MentorDirectMessage" ADD CONSTRAINT "MentorDirectMessage_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorDirectMessage_mentorId_fkey') THEN
        ALTER TABLE "MentorDirectMessage" ADD CONSTRAINT "MentorDirectMessage_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorDirectMessage_studentId_fkey') THEN
        ALTER TABLE "MentorDirectMessage" ADD CONSTRAINT "MentorDirectMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorDirectMessage_senderId_fkey') THEN
        ALTER TABLE "MentorDirectMessage" ADD CONSTRAINT "MentorDirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortTradeShare_mentorId_fkey') THEN
        ALTER TABLE "CohortTradeShare" ADD CONSTRAINT "CohortTradeShare_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortTradeShare_sourceTradeId_fkey') THEN
        ALTER TABLE "CohortTradeShare" ADD CONSTRAINT "CohortTradeShare_sourceTradeId_fkey" FOREIGN KEY ("sourceTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortTradeShareTarget_tradeShareId_fkey') THEN
        ALTER TABLE "CohortTradeShareTarget" ADD CONSTRAINT "CohortTradeShareTarget_tradeShareId_fkey" FOREIGN KEY ("tradeShareId") REFERENCES "CohortTradeShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortTradeShareTarget_mentorGroupId_fkey') THEN
        ALTER TABLE "CohortTradeShareTarget" ADD CONSTRAINT "CohortTradeShareTarget_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortAnnouncement_mentorId_fkey') THEN
        ALTER TABLE "CohortAnnouncement" ADD CONSTRAINT "CohortAnnouncement_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortAnnouncement_mentorGroupId_fkey') THEN
        ALTER TABLE "CohortAnnouncement" ADD CONSTRAINT "CohortAnnouncement_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortFeedReadState_userId_fkey') THEN
        ALTER TABLE "CohortFeedReadState" ADD CONSTRAINT "CohortFeedReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortFeedReadState_tradeShareId_fkey') THEN
        ALTER TABLE "CohortFeedReadState" ADD CONSTRAINT "CohortFeedReadState_tradeShareId_fkey" FOREIGN KEY ("tradeShareId") REFERENCES "CohortTradeShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CohortFeedReadState_announcementId_fkey') THEN
        ALTER TABLE "CohortFeedReadState" ADD CONSTRAINT "CohortFeedReadState_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CohortAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
