const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../ai/utils/validateStructuredOutput');
const { z } = require('zod');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');

const streamUpload = (file, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (result) resolve(result);
    else reject(error);
  });

  streamifier.createReadStream(file.buffer).pipe(stream);
});

const createGroup = async (req, res) => {
  try {
    const { 
      name, description, logoUrl, academyName, benefits, targetMarkets, 
      skillLevel, duration, telegramLink, discordLink, customBadge, 
      isPaid, price, currency, billingCycle 
    } = req.body;

    const isAuthorized = req.user.role === 'MENTOR' || req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.subscriptionPlan === 'MENTOR';
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Only authorized mentors can create cohorts.' });
    }

    const cleanBenefits = Array.isArray(benefits) 
      ? benefits.filter(b => typeof b === 'string' && b.trim().length > 0)
      : [];

    const group = await prisma.mentorGroup.create({
      data: {
        mentorId: req.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        academyName: academyName?.trim() || null,
        benefits: cleanBenefits,
        targetMarkets: targetMarkets?.trim() || null,
        skillLevel: skillLevel?.trim() || null,
        duration: duration?.trim() || null,
        telegramLink: telegramLink?.trim() || null,
        discordLink: discordLink?.trim() || null,
        customBadge: customBadge?.trim() || null,
        isPaid: Boolean(isPaid),
        price: isPaid ? parseFloat(price) || 0 : 0,
        currency: currency || 'USD',
        billingCycle: billingCycle || 'ONE_TIME',
        platformFeePercent: 5.0, // 5% platform commission
      }
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create cohort.' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      name, description, logoUrl, academyName, benefits, targetMarkets, 
      skillLevel, duration, telegramLink, discordLink, customBadge, 
      isPaid, price, currency, billingCycle 
    } = req.body;

    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    const cleanBenefits = benefits !== undefined
      ? (Array.isArray(benefits) ? benefits.filter(b => typeof b === 'string' && b.trim().length > 0) : [])
      : group.benefits;

    const updated = await prisma.mentorGroup.update({
      where: { id: groupId },
      data: {
        name: name ? name.trim() : group.name,
        description: description !== undefined ? description?.trim() || null : group.description,
        logoUrl: logoUrl !== undefined ? logoUrl?.trim() || null : group.logoUrl,
        academyName: academyName !== undefined ? academyName?.trim() || null : group.academyName,
        benefits: cleanBenefits,
        targetMarkets: targetMarkets !== undefined ? targetMarkets?.trim() || null : group.targetMarkets,
        skillLevel: skillLevel !== undefined ? skillLevel?.trim() || null : group.skillLevel,
        duration: duration !== undefined ? duration?.trim() || null : group.duration,
        telegramLink: telegramLink !== undefined ? telegramLink?.trim() || null : group.telegramLink,
        discordLink: discordLink !== undefined ? discordLink?.trim() || null : group.discordLink,
        customBadge: customBadge !== undefined ? customBadge?.trim() || null : group.customBadge,
        isPaid: isPaid !== undefined ? Boolean(isPaid) : group.isPaid,
        price: price !== undefined ? parseFloat(price) || 0 : group.price,
        currency: currency || group.currency,
        billingCycle: billingCycle || group.billingCycle,
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update cohort.' });
  }
};

const getPayoutSettings = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        mentorBankName: true,
        mentorAccountNumber: true,
        mentorAccountName: true,
        mentorBankCode: true,
        mentorSubaccountCode: true,
      }
    });
    res.json(user || {});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payout settings.' });
  }
};

const updatePayoutSettings = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, bankCode } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        mentorBankName: bankName?.trim() || null,
        mentorAccountNumber: accountNumber?.trim() || null,
        mentorAccountName: accountName?.trim() || null,
        mentorBankCode: bankCode?.trim() || null,
      },
      select: {
        mentorBankName: true,
        mentorAccountNumber: true,
        mentorAccountName: true,
        mentorBankCode: true,
        mentorSubaccountCode: true,
      }
    });
    res.json({ message: 'Settlement bank details saved successfully!', payoutSettings: updated });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update payout settings.' });
  }
};

const checkoutPaidGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { paymentMethod } = req.body; // 'CARD', 'PAYSTACK', 'FLUTTERWAVE', 'DEV_MOCK'

    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: { mentor: { select: { id: true, name: true, email: true, mentorBankName: true, mentorAccountNumber: true } } }
    });

    if (!group) return res.status(404).json({ message: 'Cohort not found.' });
    if (group.mentorId === req.user.id) {
      return res.status(400).json({ message: 'You are the mentor of this cohort.' });
    }

    // Check if student is already enrolled
    const existing = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: req.user.id }
    });

    if (existing && existing.status === 'ACTIVE') {
      return res.status(200).json({ message: `You are already enrolled in ${group.name}!`, alreadyEnrolled: true, group });
    }

    const price = group.isPaid ? group.price : 0;
    const platformFeePercent = group.platformFeePercent || 5.0;
    const platformFeeAmount = price > 0 ? (price * (platformFeePercent / 100)) : 0;
    const mentorPayoutAmount = price > 0 ? (price - platformFeeAmount) : 0;
    const paymentReference = `JAHZ-MENTOR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Ensure student has shareTradesWithMentor turned on
    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { shareTradesWithMentor: true },
      create: { userId: req.user.id, shareTradesWithMentor: true }
    });

    // Create or update MentorStudent membership
    let membership;
    if (existing) {
      membership = await prisma.mentorStudent.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          paidAmount: price,
          currency: group.currency,
          platformFeeAmount,
          mentorPayoutAmount,
          paymentReference,
          paidAt: new Date(),
        }
      });
    } else {
      membership = await prisma.mentorStudent.create({
        data: {
          mentorGroupId: groupId,
          studentId: req.user.id,
          status: 'ACTIVE',
          paidAmount: price,
          currency: group.currency,
          platformFeeAmount,
          mentorPayoutAmount,
          paymentReference,
          paidAt: new Date(),
        }
      });
    }

    // If paid, create a Payment log record
    if (price > 0) {
      await prisma.payment.create({
        data: {
          userId: req.user.id,
          amount: price,
          currency: group.currency,
          provider: paymentMethod || 'PAYSTACK_SPLIT',
          reference: paymentReference,
          status: 'COMPLETED',
          paidAt: new Date(),
        }
      });
    }

    res.status(201).json({
      message: `Successfully enrolled in ${group.name}!`,
      group,
      membership,
      receipt: {
        paymentReference,
        paidAmount: price,
        currency: group.currency,
        platformFeeAmount,
        mentorPayoutAmount,
        paidAt: new Date(),
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Failed to process mentorship enrollment payment.' });
  }
};

const getMyGroups = async (req, res) => {
  try {
    const groups = await prisma.mentorGroup.findMany({
      where: { mentorId: req.user.id },
      include: {
        students: {
          include: { 
            student: { 
              select: { 
                id: true, 
                name: true, 
                email: true,
                avatarUrl: true,
                userSettings: {
                  select: { shareTradesWithMentor: true }
                },
                tradingAccounts: {
                  select: {
                    id: true,
                    _count: { select: { trades: true } }
                  }
                }
              } 
            } 
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load groups.' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Group not found or unauthorized.' });
    }
    await prisma.mentorGroup.delete({ where: { id: groupId } });
    res.json({ message: 'Cohort removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete cohort.' });
  }
};

const removeStudent = async (req, res) => {
  try {
    const { groupId, studentId } = req.params;
    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Group not found or unauthorized.' });
    }
    await prisma.mentorStudent.deleteMany({
      where: { mentorGroupId: groupId, studentId }
    });
    res.json({ message: 'Student removed from cohort.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove student.' });
  }
};

const inviteStudent = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    const group = await prisma.mentorGroup.findFirst({ where: { id: groupId, mentorId: req.user.id } });
    if (!group && req.user.role !== 'SUPER_ADMIN') return res.status(404).json({ message: 'Group not found.' });

    const studentUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!studentUser) return res.status(404).json({ message: 'We couldn\'t find a registered user with that email.' });

    const existing = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: studentUser.id }
    });

    if (existing) {
      return res.status(400).json({ message: 'Student is already enrolled in this cohort.' });
    }

    const membership = await prisma.mentorStudent.create({
      data: {
        mentorGroupId: groupId,
        studentId: studentUser.id,
        status: 'ACTIVE'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            userSettings: { select: { shareTradesWithMentor: true } },
            tradingAccounts: { select: { id: true, _count: { select: { trades: true } } } }
          }
        }
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

    if (!isMentor && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You do not have permission to review this trade.' });
    }

    const mentorFeedback = await prisma.mentorFeedback.create({
      data: {
        mentorId: req.user.id,
        tradeId,
        feedback,
        grade,
        recommendation
      },
      include: {
        mentor: { select: { id: true, name: true } }
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

    if (!isMentor && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view these trades.' });
    }

    if (isMentor && isMentor.student.userSettings?.shareTradesWithMentor === false && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This student has paused trade sharing with mentors.' });
    }

    const trades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: studentId } },
      orderBy: { entryTime: 'desc' },
      take: 50,
      include: { 
        mentorFeedbacks: {
          include: { mentor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        screenshots: true,
        ruleViolations: {
          include: { tradeRule: true }
        },
        strategy: true,
        setup: true
      }
    });

    res.json(trades);
  } catch (error) {
    console.error('getStudentTrades error:', error);
    res.status(500).json({ message: 'Failed to load student trades.' });
  }
};

const getPublicGroupInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true, tradingStyle: true } },
        _count: { select: { students: true } }
      }
    });
    if (!group) return res.status(404).json({ message: 'Cohort not found or link has expired.' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load cohort details.' });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: { mentor: { select: { name: true } } }
    });
    if (!group) return res.status(404).json({ message: 'Cohort not found.' });

    // Prevent mentor from joining their own group as a student
    if (group.mentorId === req.user.id) {
      return res.status(400).json({ message: 'You are the mentor of this cohort.' });
    }

    // Check if student is already enrolled
    const existing = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: req.user.id }
    });

    if (existing) {
      return res.status(200).json({ message: `You are already enrolled in ${group.name}!`, alreadyEnrolled: true, group });
    }

    // Ensure student has shareTradesWithMentor turned on or default to true
    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { shareTradesWithMentor: true },
      create: { userId: req.user.id, shareTradesWithMentor: true }
    });

    const membership = await prisma.mentorStudent.create({
      data: {
        mentorGroupId: groupId,
        studentId: req.user.id,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({ message: `Successfully enrolled in ${group.name}!`, group, membership });
  } catch (error) {
    res.status(500).json({ message: 'Failed to join cohort.' });
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

const uploadMentorLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const result = await streamUpload(req.file, {
        folder: 'mentor_logos',
        public_id: `mentor_${req.user.id}_${Date.now()}`,
        resource_type: 'image',
        transformation: [{ width: 512, height: 512, crop: 'limit' }],
      });
      return res.json({ logoUrl: result.secure_url, message: 'Academy logo uploaded successfully!' });
    } else {
      // Local Base64 Data URL fallback if Cloudinary credentials are not configured in local environment
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return res.json({ logoUrl: dataUrl, message: 'Academy logo uploaded successfully!' });
    }
  } catch (error) {
    console.error('Error uploading mentor logo:', error);
    res.status(500).json({ message: 'Failed to upload logo image.' });
  }
};

module.exports = {
  createGroup,
  updateGroup,
  getMyGroups,
  deleteGroup,
  removeStudent,
  inviteStudent,
  getPublicGroupInfo,
  joinGroup,
  checkoutPaidGroup,
  getPayoutSettings,
  updatePayoutSettings,
  addTradeFeedback,
  getStudentTrades,
  draftMentorSummary,
  sendMentorSummary,
  uploadMentorLogo
};
