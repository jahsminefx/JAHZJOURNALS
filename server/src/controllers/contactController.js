const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanString = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const hashIp = (ip) => {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(`${ip}:${process.env.CONTACT_IP_HASH_SECRET || process.env.JWT_SECRET || 'jahzjournals'}`)
    .digest('hex');
};

const createContactMessage = async (req, res) => {
  try {
    const name = cleanString(req.body.name, 120);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const subject = cleanString(req.body.subject, 160);
    const message = cleanString(req.body.message, 5000);
    const website = cleanString(req.body.website, 200);

    if (website) {
      return res.status(202).json({ message: 'Message received' });
    }

    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Name is required.' });
    if (!emailPattern.test(email)) errors.push({ field: 'email', message: 'A valid email is required.' });
    if (!subject) errors.push({ field: 'subject', message: 'Subject is required.' });
    if (message.length < 10) errors.push({ field: 'message', message: 'Message must be at least 10 characters.' });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to submit contact message.',
        errors,
      });
    }

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        status: 'NEW',
        ipHash: hashIp(req.ip),
        userId: req.user?.id || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Message received successfully.',
      id: contactMessage.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to submit contact message' });
  }
};

module.exports = {
  createContactMessage,
};
