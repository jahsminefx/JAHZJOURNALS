-- AlterTable User: Mentor Tier limits
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorTier" TEXT DEFAULT 'PRIVATE_COHORT';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorMaxStudents" INTEGER DEFAULT 50;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorMaxCohorts" INTEGER DEFAULT 2;

-- AlterTable TradingAccount: Student Privacy
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "isSharedWithMentor" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable MentorGroup: Risk Guard Rules & Fee
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "enforceRiskGuard" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "maxRiskPerTradePercent" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "maxDailyLossPercent" DOUBLE PRECISION DEFAULT 3.0;
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "maxDailyTrades" INTEGER DEFAULT 5;
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "allowedPairs" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MentorGroup" ADD COLUMN IF NOT EXISTS "requireStopLoss" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MentorGroup" ALTER COLUMN "platformFeePercent" SET DEFAULT 1.5;

-- AlterTable MentorStudent: Shared Account Isolation & Uniqueness
ALTER TABLE "MentorStudent" ADD COLUMN IF NOT EXISTS "sharedAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX IF NOT EXISTS "MentorStudent_mentorGroupId_studentId_key" ON "MentorStudent"("mentorGroupId", "studentId");
CREATE INDEX IF NOT EXISTS "MentorStudent_studentId_idx" ON "MentorStudent"("studentId");
CREATE INDEX IF NOT EXISTS "MentorStudent_mentorGroupId_idx" ON "MentorStudent"("mentorGroupId");

-- AlterTable MentorFeedback: Replies & Resolution
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "isViolationWarning" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "violationDetails" JSONB;
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "studentReply" TEXT;
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "studentRepliedAt" TIMESTAMP(3);
ALTER TABLE "MentorFeedback" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MentorFeedback_tradeId_idx" ON "MentorFeedback"("tradeId");
CREATE INDEX IF NOT EXISTS "MentorFeedback_mentorId_idx" ON "MentorFeedback"("mentorId");

-- CreateTable MentorInvitation
CREATE TABLE IF NOT EXISTS "MentorInvitation" (
    "id" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MentorInvitation_token_key" ON "MentorInvitation"("token");
CREATE INDEX IF NOT EXISTS "MentorInvitation_email_idx" ON "MentorInvitation"("email");
CREATE INDEX IF NOT EXISTS "MentorInvitation_token_idx" ON "MentorInvitation"("token");
CREATE INDEX IF NOT EXISTS "MentorInvitation_mentorGroupId_idx" ON "MentorInvitation"("mentorGroupId");
CREATE INDEX IF NOT EXISTS "MentorInvitation_mentorId_idx" ON "MentorInvitation"("mentorId");

-- AddForeignKey MentorInvitation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorInvitation_mentorGroupId_fkey') THEN
        ALTER TABLE "MentorInvitation" ADD CONSTRAINT "MentorInvitation_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorInvitation_mentorId_fkey') THEN
        ALTER TABLE "MentorInvitation" ADD CONSTRAINT "MentorInvitation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable MentorAssignment
CREATE TABLE IF NOT EXISTS "MentorAssignment" (
    "id" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "targetStudentId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MentorAssignment_mentorGroupId_idx" ON "MentorAssignment"("mentorGroupId");
CREATE INDEX IF NOT EXISTS "MentorAssignment_mentorId_idx" ON "MentorAssignment"("mentorId");

-- AddForeignKey MentorAssignment
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorAssignment_mentorGroupId_fkey') THEN
        ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorAssignment_mentorId_fkey') THEN
        ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable MentorAssignmentSubmission
CREATE TABLE IF NOT EXISTS "MentorAssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tradeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentorFeedback" TEXT,
    "grade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorAssignmentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MentorAssignmentSubmission_assignmentId_studentId_key" ON "MentorAssignmentSubmission"("assignmentId", "studentId");
CREATE INDEX IF NOT EXISTS "MentorAssignmentSubmission_studentId_idx" ON "MentorAssignmentSubmission"("studentId");
CREATE INDEX IF NOT EXISTS "MentorAssignmentSubmission_assignmentId_idx" ON "MentorAssignmentSubmission"("assignmentId");

-- AddForeignKey MentorAssignmentSubmission
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorAssignmentSubmission_assignmentId_fkey') THEN
        ALTER TABLE "MentorAssignmentSubmission" ADD CONSTRAINT "MentorAssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MentorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorAssignmentSubmission_studentId_fkey') THEN
        ALTER TABLE "MentorAssignmentSubmission" ADD CONSTRAINT "MentorAssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable MentorCoachingSummary
CREATE TABLE IF NOT EXISTS "MentorCoachingSummary" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mentorGroupId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metricsSnapshot" JSONB,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorCoachingSummary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MentorCoachingSummary_studentId_idx" ON "MentorCoachingSummary"("studentId");
CREATE INDEX IF NOT EXISTS "MentorCoachingSummary_mentorId_idx" ON "MentorCoachingSummary"("mentorId");

-- AddForeignKey MentorCoachingSummary
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorCoachingSummary_mentorId_fkey') THEN
        ALTER TABLE "MentorCoachingSummary" ADD CONSTRAINT "MentorCoachingSummary_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorCoachingSummary_studentId_fkey') THEN
        ALTER TABLE "MentorCoachingSummary" ADD CONSTRAINT "MentorCoachingSummary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorCoachingSummary_mentorGroupId_fkey') THEN
        ALTER TABLE "MentorCoachingSummary" ADD CONSTRAINT "MentorCoachingSummary_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
