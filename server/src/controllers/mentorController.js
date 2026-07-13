const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
      where: { studentId, mentorGroup: { mentorId: req.user.id } }
    });

    if (!isMentor && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view these trades.' });
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

module.exports = {
  createGroup,
  getMyGroups,
  inviteStudent,
  addTradeFeedback,
  getStudentTrades
};
