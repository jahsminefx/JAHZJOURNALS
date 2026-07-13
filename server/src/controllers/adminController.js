const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Administrative clearance required.' });
  }
  next();
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        isDisabled: true,
        createdAt: true,
        _count: {
          select: { tradingAccounts: true, trades: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Safe batch limit
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch platform users.' });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { suspend } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isDisabled: Boolean(suspend) },
      select: { id: true, email: true, isDisabled: true }
    });

    res.json({ message: `User ${suspend ? 'suspended' : 'restored'} successfully.`, user });
  } catch (error) {
    res.status(500).json({ message: 'Could not modify user access thresholds.' });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, subscriptionPlan: true } }
      }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch platform CRM instances.' });
  }
};

const resolveContactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body; // e.g. 'RESOLVED', 'SPAM', 'IN_PROGRESS'

    const message = await prisma.contactMessage.update({
      where: { id: messageId },
      data: { status }
    });

    res.json({ message: 'Enquiry state updated.', messageState: message });
  } catch (error) {
    res.status(500).json({ message: 'Could not resolve client enquiry.' });
  }
};

module.exports = {
  requireAdmin,
  getUsers,
  suspendUser,
  getContactMessages,
  resolveContactMessage
};
