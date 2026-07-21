const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (req.user.role !== 'MENTOR' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only authorized mentors can create groups.' });
    }

    const group = await prisma.mentorGroup.create({
      data: {
        mentorId: req.user.id,
        name,
        description,
      }
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create mentor group.' });
  }
};

const getMyGroups = async (req, res) => {
  try {
    const groups = await prisma.mentorGroup.findMany({
      where: { mentorId: req.user.id },
      include: {
        students: {
          include: { student: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load groups.' });
  }
};

const inviteStudent = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    const group = await prisma.mentorGroup.findFirst({ where: { id: groupId, mentorId: req.user.id } });
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const studentUser = await prisma.user.findUnique({ where: { email } });
    if (!studentUser) return res.status(404).json({ message: 'We couldn\'t find a user with that email.' });

    const existing = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: studentUser.id }
    });

    if (existing) {
      return res.status(400).json({ message: 'Student is already in this group.' });
    }

    const membership = await prisma.mentorStudent.create({
      data: {
        mentorGroupId: groupId,
        studentId: studentUser.id,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({ message: 'Student added successfully!', student: membership });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add student.' });
  }
};

const addTradeFeedback = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { feedback, grade, recommendation } = req.body;

    // Verify mentor has access to this student's trade
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: { tradingAccount: { select: { userId: true } } }
    });

    if (!trade) return res.status(404).json({ message: 'Trade not found.' });

    const studentId = trade.tradingAccount.userId;
    const isMentor = await prisma.mentorStudent.findFirst({
      where: {
        studentId,
        mentorGroup: { mentorId: req.user.id }
      }
    });

    if (!isMentor && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'You do not have permission to review this trade.' });
    }

    const mentorFeedback = await prisma.mentorFeedback.create({
      data: {
        mentorId: req.user.id,
        tradeId,
        feedback,
        grade,
        recommendation
      }
    });

    res.status(201).json(mentorFeedback);
  } catch (error) {
    res.status(500).json({ message: 'Could not post feedback.' });
  }
};

const getStudentTrades = async (req, res) => {
  try {
    const { studentId } = req.params;

    const isMentor = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id } },
      include: { student: { select: { userSettings: { select: { shareTradesWithMentor: true } } } } }
    });

    if (!isMentor && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view these trades.' });
    }

    if (isMentor && isMentor.student.userSettings?.shareTradesWithMentor === false && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'This student has disabled trade sharing with mentors.' });
    }

    const trades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: studentId } },
      orderBy: { entryTime: 'desc' },
      take: 50,
      include: { mentorFeedbacks: true }
    });

    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load student trades.' });
  }
};

const draftMentorSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    const membership = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id } },
      include: { 
         student: { 
            include: { userSettings: true } 
         } 
      }
    });

    if (!membership && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to mentor this student.' });
    }

    if (membership && membership.student.userSettings?.shareTradesWithMentor === false && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Student has disabled trade sharing.' });
    }

    const recentTrades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: studentId } },
      orderBy: { entryTime: 'desc' },
      take: 20,
      include: { ruleViolations: true }
    });

    let wins = 0;
    let losses = 0;
    let violations = 0;

    recentTrades.forEach(t => {
       if (t.result === 'WIN') wins++;
       if (t.result === 'LOSS') losses++;
       violations += t.ruleViolations.length;
    });

    const provider = getProvider();
    const systemPrompt = `You are the executive drafting assistant for an elite trading mentor. 
Draft a professional, authoritative, but encouraging performance review letter comparing the student's recent execution.`;

    const userPrompt = `Student Name: ${membership.student.name}
Recent Trades (last 20 limit): ${wins} Wins, ${losses} Losses.
Total Rule Violations recorded during this period: ${violations}.

Draft a short markdown letter addressed to the student highlighting their focus and recommending discipline steps.`;

    const MentorSchema = z.object({
      draftTitle: z.string(),
      markdownLetter: z.string()
    });

    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, MentorSchema, 1);

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to draft AI summary.' });
    }

    // Optionally save Request 
    await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType: 'MENTOR_SUMMARY',
        status: 'COMPLETED',
        provider: result.provider,
        model: result.model,
        promptVersion: '1.0',
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        structuredOutput: result.data
      }
    });

    res.json(result.data);
  } catch (error) {
    console.error('Draft Summary Error:', error);
    res.status(500).json({ message: 'Failed to draft the AI summary.' });
  }
};

const sendMentorSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { markdownLetter } = req.body;

    const membership = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id } }
    });

    if (!membership && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to mentor this student.' });
    }

    // Since we don't have a global "direct message" model, we'll attach this AI draft feedback
    // to the student's MOST RECENT trade so they can see it when reviewing their journal.
    const latestTrade = await prisma.trade.findFirst({
      where: { tradingAccount: { userId: studentId } },
      orderBy: { entryTime: 'desc' }
    });

    if (!latestTrade) {
       return res.status(400).json({ message: 'Student has no trades to attach the summary to.' });
    }

    const mentorFeedback = await prisma.mentorFeedback.create({
      data: {
        mentorId: req.user.id,
        tradeId: latestTrade.id,
        feedback: markdownLetter,
        grade: 'A', // placeholder or parsed
        recommendation: 'General Monthly Summary'
      }
    });

    res.json({ message: 'Summary sent to student successfully', mentorFeedback });
  } catch (error) {
    console.error('Send Summary Error:', error);
    res.status(500).json({ message: 'Failed to send summary.' });
  }
};

module.exports = {
  createGroup,
  getMyGroups,
  inviteStudent,
  addTradeFeedback,
  getStudentTrades,
  draftMentorSummary,
  sendMentorSummary
};
