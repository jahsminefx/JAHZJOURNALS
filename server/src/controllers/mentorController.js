const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../ai/utils/validateStructuredOutput');
const { z } = require('zod');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const { getEffectivePlanKey, getMentorTierConfig, buildLimitReachedPayload } = require('../config/plans');
const notificationService = require('../services/communications/notificationService');
const { sendEmail } = require('../services/emailService');
const { getPaystackSecret, resolveClientUrl } = require('./subscriptionController');

const streamUpload = (file, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (result) resolve(result);
    else reject(error);
  });

  streamifier.createReadStream(file.buffer).pipe(stream);
});

// ==========================================
// 1. COHORT MANAGEMENT & CAPACITY ENFORCEMENT
// ==========================================

const createGroup = async (req, res) => {
  try {
    const { 
      name, description, logoUrl, academyName, benefits, targetMarkets, 
      skillLevel, duration, telegramLink, discordLink, customBadge, 
      isPaid, price, currency, billingCycle,
      enforceRiskGuard, maxRiskPerTradePercent, maxDailyLossPercent,
      maxDailyTrades, allowedPairs, requireStopLoss
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Cohort name is required.' });
    }

    // Check mentor cohort tier capacity
    const mentorTier = req.user.mentorTier || 'PRIVATE_COHORT';
    const tierConfig = getMentorTierConfig(mentorTier);
    const maxCohorts = req.user.mentorMaxCohorts || tierConfig.maxCohorts;

    const currentCohortsCount = await prisma.mentorGroup.count({
      where: { mentorId: req.user.id }
    });

    if (currentCohortsCount >= maxCohorts && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'cohorts',
        current: currentCohortsCount,
        limit: maxCohorts,
        userPlan: 'MENTOR',
        requiredPlan: mentorTier === 'PRIVATE_COHORT' ? 'GROWTH' : 'MEGA',
        customMessage: `You have reached your cohort limit of ${maxCohorts} for the ${tierConfig.name} tier. Upgrade your mentor tier to create more cohorts.`
      }));
    }

    const cleanBenefits = Array.isArray(benefits) 
      ? benefits.filter(b => typeof b === 'string' && b.trim().length > 0)
      : [];

    const cleanAllowedPairs = Array.isArray(allowedPairs)
      ? allowedPairs.map(p => typeof p === 'string' ? p.trim().toUpperCase() : '').filter(Boolean)
      : typeof allowedPairs === 'string'
      ? allowedPairs.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
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
        price: isPaid ? Math.max(0, parseFloat(price) || 0) : 0,
        currency: currency || 'NGN',
        billingCycle: billingCycle || 'ONE_TIME',
        platformFeePercent: 1.5, // 1.5% platform commission
        enforceRiskGuard: enforceRiskGuard !== undefined ? Boolean(enforceRiskGuard) : true,
        maxRiskPerTradePercent: maxRiskPerTradePercent !== undefined ? parseFloat(maxRiskPerTradePercent) || 1.0 : 1.0,
        maxDailyLossPercent: maxDailyLossPercent !== undefined ? parseFloat(maxDailyLossPercent) || 3.0 : 3.0,
        maxDailyTrades: maxDailyTrades !== undefined ? parseInt(maxDailyTrades, 10) || 5 : 5,
        allowedPairs: cleanAllowedPairs,
        requireStopLoss: requireStopLoss !== undefined ? Boolean(requireStopLoss) : true,
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('createGroup error:', error);
    res.status(500).json({ message: 'Unable to create cohort.' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      name, description, logoUrl, academyName, benefits, targetMarkets, 
      skillLevel, duration, telegramLink, discordLink, customBadge, 
      isPaid, price, currency, billingCycle,
      enforceRiskGuard, maxRiskPerTradePercent, maxDailyLossPercent,
      maxDailyTrades, allowedPairs, requireStopLoss
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

    const cleanAllowedPairs = allowedPairs !== undefined
      ? (Array.isArray(allowedPairs)
          ? allowedPairs.map(p => typeof p === 'string' ? p.trim().toUpperCase() : '').filter(Boolean)
          : typeof allowedPairs === 'string'
          ? allowedPairs.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
          : [])
      : group.allowedPairs;

    const updated = await prisma.mentorGroup.update({
      where: { id: groupId },
      data: {
        name: name !== undefined ? name.trim() : group.name,
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
        price: price !== undefined ? (isPaid ? Math.max(0, parseFloat(price) || 0) : 0) : group.price,
        currency: currency !== undefined ? currency : group.currency,
        billingCycle: billingCycle !== undefined ? billingCycle : group.billingCycle,
        enforceRiskGuard: enforceRiskGuard !== undefined ? Boolean(enforceRiskGuard) : group.enforceRiskGuard,
        maxRiskPerTradePercent: maxRiskPerTradePercent !== undefined ? parseFloat(maxRiskPerTradePercent) || 1.0 : group.maxRiskPerTradePercent,
        maxDailyLossPercent: maxDailyLossPercent !== undefined ? parseFloat(maxDailyLossPercent) || 3.0 : group.maxDailyLossPercent,
        maxDailyTrades: maxDailyTrades !== undefined ? parseInt(maxDailyTrades, 10) || 5 : group.maxDailyTrades,
        allowedPairs: cleanAllowedPairs,
        requireStopLoss: requireStopLoss !== undefined ? Boolean(requireStopLoss) : group.requireStopLoss,
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('updateGroup error:', error);
    res.status(500).json({ message: 'Failed to update cohort.' });
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
                tradingExperience: true,
                mainTradingPairs: true,
                userSettings: {
                  select: {
                    shareTradesWithMentor: true,
                    shareScreenshots: true,
                    shareEmotions: true,
                    shareWeeklyReviews: true,
                  }
                },
                tradingAccounts: {
                  select: {
                    id: true,
                    name: true,
                    accountCategory: true,
                    isSharedWithMentor: true,
                    startingBalance: true,
                    currentBalance: true,
                    currency: true,
                    _count: { select: { trades: true } }
                  }
                }
              }
            }
          }
        },
        invitations: {
          where: { status: 'PENDING' },
          select: { id: true, email: true, expiresAt: true, createdAt: true }
        },
        assignments: {
          select: { id: true, title: true, dueDate: true, status: true, _count: { select: { submissions: true } } }
        },
        _count: {
          select: { students: true, invitations: true, assignments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mentorTier = req.user.mentorTier || 'PRIVATE_COHORT';
    const tierConfig = getMentorTierConfig(mentorTier);
    const maxStudents = req.user.mentorMaxStudents || tierConfig.maxStudents;
    const maxCohorts = req.user.mentorMaxCohorts || tierConfig.maxCohorts;

    const totalActiveStudents = groups.reduce((acc, g) => acc + (g.students?.filter(s => s.status === 'ACTIVE').length || 0), 0);

    res.json({
      groups,
      tier: {
        key: mentorTier,
        name: tierConfig.name,
        maxStudents,
        maxCohorts,
        currentCohorts: groups.length,
        totalActiveStudents,
        isAtStudentCapacity: totalActiveStudents >= maxStudents,
        isAtCohortCapacity: groups.length >= maxCohorts,
      }
    });
  } catch (error) {
    console.error('getMyGroups error:', error);
    res.status(500).json({ message: 'Failed to retrieve mentor groups.' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }
    await prisma.mentorGroup.delete({ where: { id: groupId } });
    res.json({ message: 'Cohort removed successfully.' });
  } catch (error) {
    console.error('deleteGroup error:', error);
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
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    await prisma.mentorStudent.deleteMany({
      where: { mentorGroupId: groupId, studentId }
    });

    // Notify student that they were removed
    notificationService.sendManualNotification(
      'Academy Membership Update',
      `You have been removed from the cohort "${group.name}". Your personal trading journal and records remain completely intact.`,
      [studentId],
      'MENTOR_UPDATE',
      req.user.id,
      '/student-cohorts'
    ).catch(err => console.warn('Notification warning:', err?.message));

    res.json({ message: 'Student removed from cohort successfully.' });
  } catch (error) {
    console.error('removeStudent error:', error);
    res.status(500).json({ message: 'Failed to remove student.' });
  }
};

// ==========================================
// 2. STUDENT COHORT HUB & LEAVE COHORT
// ==========================================

const getStudentEnrolledCohorts = async (req, res) => {
  try {
    const memberships = await prisma.mentorStudent.findMany({
      where: { studentId: req.user.id, status: 'ACTIVE' },
      include: {
        mentorGroup: {
          include: {
            mentor: {
              select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true }
            },
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                submissions: {
                  where: { studentId: req.user.id }
                }
              },
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // If user is a Mentor who owns cohorts, include their owned cohorts so they can preview & interact in My Academies Hub
    const ownedGroups = await prisma.mentorGroup.findMany({
      where: { mentorId: req.user.id },
      include: {
        mentor: {
          select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            submissions: true
          },
          orderBy: { dueDate: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enrolledGroupIds = new Set(memberships.map((m) => m.mentorGroupId));
    const combinedMemberships = [
      ...memberships,
      ...ownedGroups
        .filter((g) => !enrolledGroupIds.has(g.id))
        .map((g) => ({
          id: `owner-${g.id}`,
          mentorGroupId: g.id,
          studentId: req.user.id,
          status: 'ACTIVE',
          isMentorOwner: true,
          createdAt: g.createdAt,
          mentorGroup: g,
        })),
    ];

    // Also fetch student's sharing settings and trading accounts
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: {
        shareTradesWithMentor: true,
        shareScreenshots: true,
        shareEmotions: true,
        shareWeeklyReviews: true,
      }
    });

    const tradingAccounts = await prisma.tradingAccount.findMany({
      where: { userId: req.user.id },
      select: { id: true, name: true, accountCategory: true, currency: true, isSharedWithMentor: true }
    });

    res.json({
      memberships: combinedMemberships,
      settings: settings || {
        shareTradesWithMentor: true,
        shareScreenshots: true,
        shareEmotions: false,
        shareWeeklyReviews: false,
      },
      tradingAccounts,
    });
  } catch (error) {
    console.error('getStudentEnrolledCohorts error:', error);
    res.status(500).json({ message: 'Failed to load enrolled cohorts.' });
  }
};

const leaveCohort = async (req, res) => {
  try {
    const { groupId } = req.params;

    const membership = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: req.user.id },
      include: { mentorGroup: { include: { mentor: { select: { id: true, name: true } } } } }
    });

    if (!membership) {
      return res.status(404).json({ message: 'You are not enrolled in this cohort.' });
    }

    // Delete membership so mentor access is immediately revoked
    await prisma.mentorStudent.delete({
      where: { id: membership.id }
    });

    // Notify mentor that student left
    notificationService.sendManualNotification(
      'Student Left Cohort',
      `Student ${req.user.name || req.user.email} has left the cohort "${membership.mentorGroup.name}".`,
      [membership.mentorGroup.mentorId],
      'MENTOR_UPDATE',
      req.user.id,
      `/mentor-workspace?tab=roster&cohortId=${membership.mentorGroupId}`
    ).catch(err => console.warn('Leave notification warning:', err?.message));

    res.json({
      success: true,
      message: `You have successfully left ${membership.mentorGroup.name}. Your personal trading journal, accounts, and private history are preserved.`,
    });
  } catch (error) {
    console.error('leaveCohort error:', error);
    res.status(500).json({ message: 'Failed to leave cohort.' });
  }
};

// ==========================================
// 3. INVITATION WORKFLOWS & CAPACITY CHECKS
// ==========================================

const inviteStudent = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Recipient email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();

    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id },
      include: { mentor: { select: { id: true, name: true, mentorTier: true, mentorMaxStudents: true } } }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    // Check mentor capacity
    const mentorTier = group.mentor?.mentorTier || req.user.mentorTier || 'PRIVATE_COHORT';
    const tierConfig = getMentorTierConfig(mentorTier);
    const maxStudents = group.mentor?.mentorMaxStudents || req.user.mentorMaxStudents || tierConfig.maxStudents;

    const totalActiveStudents = await prisma.mentorStudent.count({
      where: { mentorGroup: { mentorId: req.user.id }, status: 'ACTIVE' }
    });

    if (totalActiveStudents >= maxStudents && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'students',
        current: totalActiveStudents,
        limit: maxStudents,
        userPlan: 'MENTOR',
        requiredPlan: mentorTier === 'PRIVATE_COHORT' ? 'GROWTH' : 'MEGA',
        customMessage: `You have reached your academy limit of ${maxStudents} students for the ${tierConfig.name} tier. Upgrade your tier to invite more students.`
      }));
    }

    // Check if student is already enrolled
    const studentUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (studentUser) {
      const alreadyEnrolled = await prisma.mentorStudent.findFirst({
        where: { mentorGroupId: groupId, studentId: studentUser.id, status: 'ACTIVE' }
      });
      if (alreadyEnrolled) {
        return res.status(400).json({ message: 'This student is already actively enrolled in this cohort.' });
      }
    }

    // Check if a pending invitation already exists for this email
    const existingInvite = await prisma.mentorInvitation.findFirst({
      where: {
        mentorGroupId: groupId,
        email: cleanEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    const token = existingInvite ? existingInvite.token : crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let invitation;
    if (existingInvite) {
      invitation = await prisma.mentorInvitation.update({
        where: { id: existingInvite.id },
        data: { expiresAt, updatedAt: new Date() }
      });
    } else {
      invitation = await prisma.mentorInvitation.create({
        data: {
          mentorGroupId: groupId,
          mentorId: req.user.id,
          email: cleanEmail,
          token,
          expiresAt,
          status: 'PENDING'
        }
      });
    }

    // Send invitation email
    const clientUrl = resolveClientUrl(req);
    const inviteUrl = `${clientUrl}/cohorts/join/${groupId}?token=${token}`;

    const emailSubject = `Invitation to join ${group.academyName || group.name} on JAHZJOURNALS`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">You're Invited to Join an Academy Cohort!</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          <strong>${req.user.name || 'Your Mentor'}</strong> has invited you to join <strong>${group.name}</strong> on JAHZJOURNALS.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Inside this cohort, you will get direct feedback on your trades, strategy risk rule verification, and personalized coaching to accelerate your trading discipline.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${inviteUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
          This invitation link expires in 7 days. If you don't have an account yet, you will be prompted to create your free trader journal when accepting.
        </p>
      </div>
    `;

    sendEmail({
      to: cleanEmail,
      subject: emailSubject,
      html: emailHtml,
      text: `You have been invited by ${req.user.name} to join ${group.name} on JAHZJOURNALS. Accept your invitation here: ${inviteUrl}`
    }).catch(err => console.warn('Email send warning in inviteStudent:', err?.message));

    // If recipient is already a registered user, send an in-app notification
    if (studentUser) {
      notificationService.sendManualNotification(
        'New Academy Invitation',
        `${req.user.name || 'A mentor'} invited you to join the trading cohort "${group.name}".`,
        [studentUser.id],
        'INVITATION',
        req.user.id,
        `/cohorts/join/${groupId}?token=${token}`
      ).catch(err => console.warn('In-app notification warning:', err?.message));
    }

    res.status(201).json({
      message: `Invitation successfully sent to ${cleanEmail}!`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviteUrl,
      }
    });
  } catch (error) {
    console.error('inviteStudent error:', error);
    res.status(500).json({ message: 'Failed to send student invitation.' });
  }
};

const getGroupInvitations = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });
    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    const invitations = await prisma.mentorInvitation.findMany({
      where: { mentorGroupId: groupId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invitations);
  } catch (error) {
    console.error('getGroupInvitations error:', error);
    res.status(500).json({ message: 'Failed to load invitations.' });
  }
};

const resendInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await prisma.mentorInvitation.findUnique({
      where: { id: invitationId },
      include: {
        mentorGroup: true,
        mentor: { select: { id: true, name: true } }
      }
    });

    if (!invitation || (invitation.mentorId !== req.user.id && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(404).json({ message: 'Invitation not found or unauthorized.' });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await prisma.mentorInvitation.update({
      where: { id: invitationId },
      data: { status: 'PENDING', expiresAt, updatedAt: new Date() }
    });

    const clientUrl = resolveClientUrl(req);
    const inviteUrl = `${clientUrl}/cohorts/join/${invitation.mentorGroupId}?token=${updated.token}`;

    sendEmail({
      to: updated.email,
      subject: `Reminder: Invitation to join ${invitation.mentorGroup.name} on JAHZJOURNALS`,
      html: `
        <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2>Reminder: You're Invited to Join ${invitation.mentorGroup.name}</h2>
          <p>Your invitation has been refreshed by ${invitation.mentor.name}. Click below to join:</p>
          <div style="margin: 20px 0;"><a href="${inviteUrl}" style="background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Join Cohort</a></div>
        </div>
      `,
      text: `Reminder: Join ${invitation.mentorGroup.name} on JAHZJOURNALS: ${inviteUrl}`
    }).catch(err => console.warn('Resend email warning:', err?.message));

    res.json({ message: 'Invitation resent successfully!', invitation: updated });
  } catch (error) {
    console.error('resendInvitation error:', error);
    res.status(500).json({ message: 'Failed to resend invitation.' });
  }
};

const revokeInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await prisma.mentorInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation || (invitation.mentorId !== req.user.id && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(404).json({ message: 'Invitation not found or unauthorized.' });
    }

    const updated = await prisma.mentorInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED', updatedAt: new Date() }
    });

    res.json({ message: 'Invitation revoked successfully.', invitation: updated });
  } catch (error) {
    console.error('revokeInvitation error:', error);
    res.status(500).json({ message: 'Failed to revoke invitation.' });
  }
};

const getInvitationDetails = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.mentorInvitation.findUnique({
      where: { token },
      include: {
        mentorGroup: {
          include: {
            mentor: { select: { id: true, name: true, avatarUrl: true, tradingStyle: true } }
          }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invalid or expired invitation token.' });
    }

    const isExpired = new Date(invitation.expiresAt) < new Date();
    if (isExpired || invitation.status !== 'PENDING') {
      return res.status(410).json({
        message: isExpired ? 'This invitation has expired.' : `This invitation is no longer valid (${invitation.status.toLowerCase()}).`,
        status: invitation.status,
        isExpired
      });
    }

    res.json({
      valid: true,
      email: invitation.email,
      group: invitation.mentorGroup,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('getInvitationDetails error:', error);
    res.status(500).json({ message: 'Failed to verify invitation.' });
  }
};

const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.mentorInvitation.findUnique({
      where: { token },
      include: { mentorGroup: true }
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invalid invitation token.' });
    }

    if (invitation.status !== 'PENDING' || new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'This invitation has expired or has already been used.' });
    }

    const group = invitation.mentorGroup;

    // Check capacity
    const mentor = await prisma.user.findUnique({
      where: { id: group.mentorId },
      select: { id: true, mentorTier: true, mentorMaxStudents: true }
    });
    const tierConfig = getMentorTierConfig(mentor?.mentorTier || 'PRIVATE_COHORT');
    const maxStudents = mentor?.mentorMaxStudents || tierConfig.maxStudents;

    const currentCount = await prisma.mentorStudent.count({
      where: { mentorGroup: { mentorId: group.mentorId }, status: 'ACTIVE' }
    });

    if (currentCount >= maxStudents) {
      return res.status(403).json({
        message: 'This academy has reached its maximum student capacity. Please contact the mentor.'
      });
    }

    // Enable trade sharing with mentor if not set
    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { shareTradesWithMentor: true },
      create: { userId: req.user.id, shareTradesWithMentor: true }
    });

    // Upsert membership
    const membership = await prisma.mentorStudent.upsert({
      where: {
        mentorGroupId_studentId: {
          mentorGroupId: group.id,
          studentId: req.user.id
        }
      },
      update: { status: 'ACTIVE' },
      create: {
        mentorGroupId: group.id,
        studentId: req.user.id,
        status: 'ACTIVE'
      }
    });

    // Mark invitation accepted
    await prisma.mentorInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() }
    });

    // Notify mentor
    notificationService.sendManualNotification(
      'New Student Accepted Invitation',
      `${req.user.name || req.user.email} has accepted your invitation and joined ${group.name}!`,
      [group.mentorId],
      'MENTOR_UPDATE',
      req.user.id,
      `/mentor-workspace?tab=roster&cohortId=${group.id}`
    ).catch(err => console.warn('Accept notification warning:', err?.message));

    res.json({
      success: true,
      message: `You have successfully joined ${group.name}!`,
      group,
      membership
    });
  } catch (error) {
    console.error('acceptInvitation error:', error);
    res.status(500).json({ message: 'Failed to accept invitation.' });
  }
};

// ==========================================
// 4. PAID COHORT ENROLLMENT & PAYSTACK FLOW
// ==========================================

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
      include: { mentor: { select: { id: true, name: true, mentorTier: true, mentorMaxStudents: true } } }
    });
    if (!group) return res.status(404).json({ message: 'Cohort not found.' });

    if (group.mentorId === req.user.id) {
      return res.status(400).json({ message: 'You are the mentor of this cohort.' });
    }

    if (group.isPaid && group.price > 0) {
      return res.status(402).json({
        message: 'This is a paid cohort. Please complete checkout to enroll.',
        requiresPayment: true,
        price: group.price,
        currency: group.currency
      });
    }

    // Check capacity
    const tierConfig = getMentorTierConfig(group.mentor?.mentorTier || 'PRIVATE_COHORT');
    const maxStudents = group.mentor?.mentorMaxStudents || tierConfig.maxStudents;
    const currentCount = await prisma.mentorStudent.count({
      where: { mentorGroup: { mentorId: group.mentorId }, status: 'ACTIVE' }
    });

    if (currentCount >= maxStudents) {
      return res.status(403).json({ message: 'This academy has reached its maximum student capacity.' });
    }

    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { shareTradesWithMentor: true },
      create: { userId: req.user.id, shareTradesWithMentor: true }
    });

    const membership = await prisma.mentorStudent.upsert({
      where: {
        mentorGroupId_studentId: {
          mentorGroupId: groupId,
          studentId: req.user.id
        }
      },
      update: { status: 'ACTIVE' },
      create: {
        mentorGroupId: groupId,
        studentId: req.user.id,
        status: 'ACTIVE'
      }
    });

    notificationService.sendManualNotification(
      'New Student Enrolled',
      `${req.user.name || req.user.email} joined your free cohort "${group.name}".`,
      [group.mentorId],
      'MENTOR_UPDATE',
      req.user.id,
      `/mentor-workspace?tab=roster&cohortId=${groupId}`
    ).catch(err => console.warn('Enrollment notification warning:', err?.message));

    res.status(201).json({ message: `Successfully enrolled in ${group.name}!`, group, membership });
  } catch (error) {
    console.error('joinGroup error:', error);
    res.status(500).json({ message: 'Failed to join cohort.' });
  }
};

const checkoutPaidGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { paymentMethod } = req.body || {};

    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            mentorBankName: true,
            mentorAccountNumber: true,
            mentorAccountName: true,
            mentorBankCode: true,
            mentorSubaccountCode: true,
            mentorTier: true,
            mentorMaxStudents: true
          }
        }
      }
    });

    if (!group) return res.status(404).json({ message: 'Cohort not found.' });
    if (group.mentorId === req.user.id) {
      return res.status(400).json({ message: 'You are the mentor of this cohort.' });
    }

    if (!group.isPaid || group.price <= 0) {
      return res.status(400).json({ message: 'This cohort is free. You can join directly without payment.' });
    }

    // Capacity check
    const tierConfig = getMentorTierConfig(group.mentor?.mentorTier || 'PRIVATE_COHORT');
    const maxStudents = group.mentor?.mentorMaxStudents || tierConfig.maxStudents;
    const currentCount = await prisma.mentorStudent.count({
      where: { mentorGroup: { mentorId: group.mentorId }, status: 'ACTIVE' }
    });

    if (currentCount >= maxStudents) {
      return res.status(403).json({ message: 'This academy has reached its maximum student capacity.' });
    }

    // Check if already active
    const existing = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: req.user.id, status: 'ACTIVE' }
    });
    if (existing) {
      return res.status(200).json({ message: `You are already enrolled in ${group.name}!`, alreadyEnrolled: true, group });
    }

    const usdToNgnRate = Number(process.env.PAYSTACK_USD_NGN_RATE) || 1600;
    const priceNgn = group.currency === 'USD'
      ? Math.round(group.price * usdToNgnRate)
      : Math.round(group.price);
    const amountInKobo = priceNgn * 100;
    const feePercent = 1.5;
    const secret = getPaystackSecret();
    const clientUrl = resolveClientUrl(req);

    if (secret && secret !== 'sk_test_example') {
      const basePayload = {
        email: req.user.email,
        amount: amountInKobo,
        currency: 'NGN',
        callback_url: `${clientUrl}/cohorts/join/${groupId}?payment=verify`,
        channels: paymentMethod === 'CARD' ? ['card'] : ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata: {
          paymentType: 'COHORT_ENROLLMENT',
          groupId: group.id,
          studentId: req.user.id,
          studentEmail: req.user.email,
          mentorId: group.mentorId,
          cohortName: group.name,
          price: priceNgn,
          platformFeePercent: feePercent,
        }
      };

      let initPayload = { ...basePayload };
      if (group.mentor?.mentorSubaccountCode) {
        initPayload.subaccount = group.mentor.mentorSubaccountCode;
        initPayload.transaction_charge = Math.round(amountInKobo * (feePercent / 100));
        initPayload.bearer = 'account';
      }

      let response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initPayload)
      });

      let data = await response.json();

      // Fallback if subaccount code was from another Paystack environment/mode
      if (!data.status && initPayload.subaccount) {
        response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(basePayload)
        });
        data = await response.json();
      }

      if (data.status && data.data?.authorization_url) {
        // Record pending payment
        await prisma.payment.upsert({
          where: { reference: data.data.reference },
          update: { amount: priceNgn, currency: 'NGN', status: 'PENDING' },
          create: {
            userId: req.user.id,
            amount: priceNgn,
            currency: 'NGN',
            provider: 'PAYSTACK',
            reference: data.data.reference,
            status: 'PENDING'
          }
        }).catch(err => console.warn('Pending payment recording warning:', err?.message));

        return res.json({
          success: true,
          authorization_url: data.data.authorization_url,
          reference: data.data.reference,
          message: 'Paystack payment initialized successfully!'
        });
      }

      return res.status(400).json({ message: data.message || 'Unable to initialize Paystack checkout.' });
    }

    // In environment where Paystack secret is not configured:
    return res.status(503).json({
      message: 'Paystack payment integration is not configured on this environment. Contact support.',
      errorCode: 'PAYSTACK_NOT_CONFIGURED'
    });
  } catch (error) {
    console.error('checkoutPaidGroup error:', error);
    res.status(500).json({ message: 'Failed to initiate cohort checkout.' });
  }
};

const verifyCohortEnrollment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Transaction reference is required.' });
    }

    const secret = getPaystackSecret();
    if (!secret || secret === 'sk_test_example') {
      return res.status(503).json({ message: 'Paystack payment gateway is not configured.' });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });

    const data = await response.json();
    if (!data.status || !data.data || String(data.data.status).toLowerCase() !== 'success') {
      return res.status(400).json({ message: 'Transaction was not successful or could not be verified by Paystack.' });
    }

    const txData = data.data;
    const metadata = txData.metadata || {};

    if (metadata.groupId && metadata.groupId !== groupId) {
      return res.status(400).json({ message: 'Transaction does not match this cohort.' });
    }

    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: { mentor: { select: { id: true, name: true } } }
    });

    if (!group) return res.status(404).json({ message: 'Cohort not found.' });

    const paidAmount = txData.amount / 100;
    const feePercent = 1.5;
    const platformFeeAmount = paidAmount * (feePercent / 100);
    const mentorPayoutAmount = paidAmount - platformFeeAmount;

    // Record payment success
    await prisma.payment.upsert({
      where: { reference },
      update: {
        amount: paidAmount,
        currency: (txData.currency || 'NGN').toUpperCase(),
        provider: 'PAYSTACK',
        status: 'SUCCESS',
        paidAt: txData.paid_at ? new Date(txData.paid_at) : new Date(),
      },
      create: {
        userId: req.user.id,
        amount: paidAmount,
        currency: (txData.currency || 'NGN').toUpperCase(),
        provider: 'PAYSTACK',
        reference,
        status: 'SUCCESS',
        paidAt: txData.paid_at ? new Date(txData.paid_at) : new Date(),
      }
    });

    // Turn on trade sharing for the enrolled student
    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { shareTradesWithMentor: true },
      create: { userId: req.user.id, shareTradesWithMentor: true }
    });

    // Create or update membership
    const membership = await prisma.mentorStudent.upsert({
      where: {
        mentorGroupId_studentId: {
          mentorGroupId: groupId,
          studentId: req.user.id
        }
      },
      update: {
        status: 'ACTIVE',
        paidAmount,
        currency: (txData.currency || 'NGN').toUpperCase(),
        platformFeeAmount,
        mentorPayoutAmount,
        paymentReference: reference,
        paidAt: new Date()
      },
      create: {
        mentorGroupId: groupId,
        studentId: req.user.id,
        status: 'ACTIVE',
        paidAmount,
        currency: (txData.currency || 'NGN').toUpperCase(),
        platformFeeAmount,
        mentorPayoutAmount,
        paymentReference: reference,
        paidAt: new Date()
      }
    });

    // Notify mentor of paid enrollment
    notificationService.sendManualNotification(
      'Student Enrolled (Paid)',
      `${req.user.name || req.user.email} paid ₦${paidAmount.toLocaleString()} and joined ${group.name}!`,
      [group.mentorId],
      'PAYMENT',
      req.user.id,
      `/mentor-workspace?tab=roster&cohortId=${groupId}`
    ).catch(err => console.warn('Payment notification warning:', err?.message));

    res.json({
      success: true,
      message: `Payment verified! You are now enrolled in ${group.name}.`,
      membership
    });
  } catch (error) {
    console.error('verifyCohortEnrollment error:', error);
    res.status(500).json({ message: 'Failed to verify cohort enrollment.' });
  }
};

// ==========================================
// 5. STUDENT JOURNAL REVIEW & PRIVACY SCOPING
// ==========================================

const getStudentTrades = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check mentor-student relationship
    const membership = await prisma.mentorStudent.findFirst({
      where: {
        studentId,
        mentorGroup: { mentorId: req.user.id },
        status: 'ACTIVE'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            userSettings: {
              select: {
                shareTradesWithMentor: true,
                shareScreenshots: true,
                shareEmotions: true,
                shareWeeklyReviews: true,
              }
            }
          }
        },
        mentorGroup: true,
      }
    });

    if (!membership && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You are not authorized to view this student\'s journal.' });
    }

    const studentSettings = membership?.student?.userSettings;
    if (membership && studentSettings?.shareTradesWithMentor === false && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This student has paused trade sharing with mentors.' });
    }

    const group = membership?.mentorGroup;
    const sharedAccountIds = membership?.sharedAccountIds || [];

    // Filter trades by accounts marked isSharedWithMentor: true AND cohort-scoped account IDs
    const accountFilter = {
      userId: studentId,
      isSharedWithMentor: true,
    };

    if (sharedAccountIds.length > 0) {
      accountFilter.id = { in: sharedAccountIds };
    }

    const shouldIncludeScreenshots = studentSettings?.shareScreenshots !== false;
    const shouldIncludeEmotions = studentSettings?.shareEmotions === true;

    const trades = await prisma.trade.findMany({
      where: { tradingAccount: accountFilter },
      orderBy: { entryTime: 'desc' },
      take: 100,
      include: {
        tradingAccount: {
          select: { id: true, name: true, startingBalance: true, currentBalance: true, currency: true }
        },
        mentorFeedbacks: {
          include: { mentor: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' }
        },
        screenshots: shouldIncludeScreenshots,
        ruleViolations: {
          include: { tradeRule: true }
        },
        emotionLogs: shouldIncludeEmotions ? { orderBy: { createdAt: 'desc' } } : false,
        strategy: true,
        setup: true
      }
    });

    // Risk Guard Evaluation
    const enforceRules = group?.enforceRiskGuard ?? true;
    const maxRisk = group?.maxRiskPerTradePercent !== null && group?.maxRiskPerTradePercent !== undefined ? group.maxRiskPerTradePercent : 1.0;
    const maxDailyTrades = group?.maxDailyTrades !== null && group?.maxDailyTrades !== undefined ? group.maxDailyTrades : 5;
    const allowedPairsList = (group?.allowedPairs || []).map(p => p.trim().toUpperCase()).filter(Boolean);
    const requireSL = group?.requireStopLoss ?? true;

    const tradesByDay = {};
    trades.forEach(t => {
      const dayKey = t.entryTime ? new Date(t.entryTime).toISOString().split('T')[0] : 'undated';
      tradesByDay[dayKey] = (tradesByDay[dayKey] || 0) + 1;
    });

    const enrichedTrades = trades.map(trade => {
      const violations = [];
      const balance = trade.tradingAccount?.startingBalance || trade.tradingAccount?.currentBalance || 0;

      let calculatedRiskPercent = null;
      if (trade.riskAmount && balance > 0) {
        calculatedRiskPercent = Number(((trade.riskAmount / balance) * 100).toFixed(2));
      } else if (trade.profitLossPercent !== null && trade.profitLossPercent !== undefined) {
        calculatedRiskPercent = trade.profitLossPercent < 0 ? Math.abs(Number(trade.profitLossPercent.toFixed(2))) : null;
      }

      if (enforceRules && group) {
        // 1. Excessive risk per trade
        if (calculatedRiskPercent !== null && maxRisk > 0 && calculatedRiskPercent > maxRisk) {
          const excess = Number((calculatedRiskPercent - maxRisk).toFixed(2));
          violations.push({
            type: 'EXCESSIVE_RISK',
            severity: 'CRITICAL',
            title: 'Excessive Risk Breach',
            ruleLimit: `${maxRisk}%`,
            actualValue: `${calculatedRiskPercent}%`,
            message: `Risked ${calculatedRiskPercent}% on ${trade.pair} — Exceeded your academy rule of ${maxRisk}% by +${excess}%!`,
            evidence: trade.riskAmount 
              ? `$${trade.riskAmount.toLocaleString()} risked on $${balance.toLocaleString()} balance` 
              : `${calculatedRiskPercent}% drawdown on single trade`
          });
        }

        // 2. Missing stop loss
        if (requireSL && (trade.stopLoss === null || trade.stopLoss === undefined)) {
          violations.push({
            type: 'NO_STOP_LOSS',
            severity: 'HIGH',
            title: 'No Stop Loss Attached',
            ruleLimit: 'Mandatory Stop Loss',
            actualValue: 'None',
            message: `Trade executed without a Stop Loss (Direct breach of Academy Capital Protection Policy).`,
            evidence: 'Stop Loss field not set'
          });
        }

        // 3. Unauthorized pair
        if (allowedPairsList.length > 0 && trade.pair) {
          const cleanPair = trade.pair.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const isAllowed = allowedPairsList.some(p => {
            const cleanAllowed = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return cleanPair.includes(cleanAllowed) || cleanAllowed.includes(cleanPair);
          });
          if (!isAllowed) {
            violations.push({
              type: 'UNAUTHORIZED_PAIR',
              severity: 'MEDIUM',
              title: 'Unauthorized Focus Pair',
              ruleLimit: allowedPairsList.join(', '),
              actualValue: trade.pair,
              message: `Traded ${trade.pair} which is outside your academy's approved focus list (${allowedPairsList.join(', ')}).`,
              evidence: `Pair ${trade.pair} not in cohort curriculum`
            });
          }
        }

        // 4. Overtrading
        const dayKey = trade.entryTime ? new Date(trade.entryTime).toISOString().split('T')[0] : null;
        if (maxDailyTrades > 0 && dayKey && (tradesByDay[dayKey] || 0) > maxDailyTrades) {
          violations.push({
            type: 'OVERTRADING',
            severity: 'MEDIUM',
            title: 'Daily Trade Limit Exceeded',
            ruleLimit: `${maxDailyTrades} trades/day`,
            actualValue: `${tradesByDay[dayKey]} trades logged`,
            message: `Overtrading: Student logged ${tradesByDay[dayKey]} trades on this date (Exceeded your limit of ${maxDailyTrades} trades/day).`,
            evidence: `${tradesByDay[dayKey]} executions in 24 hours`
          });
        }
      }

      return {
        ...trade,
        calculatedRiskPercent,
        riskGuardViolations: violations,
        screenshots: shouldIncludeScreenshots ? (trade.screenshots || []) : [],
        emotionLogs: shouldIncludeEmotions ? (trade.emotionLogs || []) : [],
        cohortRules: group ? {
          enforceRiskGuard: group.enforceRiskGuard,
          maxRiskPerTradePercent: maxRisk,
          maxDailyLossPercent: group.maxDailyLossPercent,
          maxDailyTrades: maxDailyTrades,
          allowedPairs: group.allowedPairs,
          requireStopLoss: requireSL,
        } : null
      };
    });

    res.json(enrichedTrades);
  } catch (error) {
    console.error('getStudentTrades error:', error);
    res.status(500).json({ message: 'Failed to load student trades.' });
  }
};

// ==========================================
// 6. TRADE FEEDBACK & TWO-WAY INTERACTION
// ==========================================

const addTradeFeedback = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const feedbackText = (req.body.feedback || req.body.comment || '').trim();
    const gradeVal = req.body.grade !== undefined && req.body.grade !== null 
      ? String(req.body.grade).trim() 
      : (req.body.rating !== undefined && req.body.rating !== null ? String(req.body.rating).trim() : null);
    const { recommendation, isViolationWarning, violationDetails } = req.body;

    if (!feedbackText) {
      return res.status(400).json({ message: 'Feedback text is required.' });
    }

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        tradingAccount: {
          select: { userId: true, user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!trade) return res.status(404).json({ message: 'Trade not found.' });

    const studentId = trade.tradingAccount.userId;
    const isMentor = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id }, status: 'ACTIVE' }
    });

    if (!isMentor && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You do not have permission to review this student trade.' });
    }

    const mentorFeedback = await prisma.mentorFeedback.create({
      data: {
        mentorId: req.user.id,
        tradeId,
        feedback: feedbackText,
        grade: gradeVal,
        recommendation: recommendation?.trim() || null,
        isViolationWarning: Boolean(isViolationWarning),
        violationDetails: violationDetails || null,
        status: 'ACTIVE'
      },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Notify student of new feedback
    notificationService.sendManualNotification(
      isViolationWarning ? '⚠️ Mentor Risk Warning on Trade' : '📝 New Feedback on Your Trade',
      `Your mentor ${req.user.name} reviewed your trade on ${trade.pair}: "${feedbackText.slice(0, 100)}${feedbackText.length > 100 ? '...' : ''}"`,
      [studentId],
      isViolationWarning ? 'RISK_WARNING' : 'MENTOR_FEEDBACK',
      req.user.id,
      '/student-cohorts?tab=my_reviews'
    ).catch(err => console.warn('Feedback notification warning:', err?.message));

    res.status(201).json(mentorFeedback);
  } catch (error) {
    console.error('addTradeFeedback error:', error);
    res.status(500).json({ message: 'Could not post feedback.' });
  }
};

const replyToTradeFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    const feedback = await prisma.mentorFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        trade: {
          include: { tradingAccount: { select: { userId: true } } }
        },
        mentor: { select: { id: true, name: true } }
      }
    });

    if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });

    // Ensure only the student who owns the trade (or admin) can reply
    const studentId = feedback.trade.tradingAccount.userId;
    if (studentId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only the student who logged this trade can reply.' });
    }

    const updated = await prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: {
        studentReply: reply.trim(),
        studentRepliedAt: new Date()
      },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Notify mentor of student's reply
    notificationService.sendManualNotification(
      'Student Replied to Feedback',
      `${req.user.name || 'Your student'} replied to your feedback on ${feedback.trade.pair}: "${reply.slice(0, 100)}"`,
      [feedback.mentorId],
      'STUDENT_REPLY',
      req.user.id,
      '/mentor-workspace?tab=roster'
    ).catch(err => console.warn('Reply notification warning:', err?.message));

    res.json(updated);
  } catch (error) {
    console.error('replyToTradeFeedback error:', error);
    res.status(500).json({ message: 'Failed to post reply.' });
  }
};

const toggleFeedbackResolved = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { status } = req.body; // 'RESOLVED' or 'ACTIVE'

    const feedback = await prisma.mentorFeedback.findUnique({
      where: { id: feedbackId },
      include: { trade: { include: { tradingAccount: { select: { userId: true } } } } }
    });

    if (!feedback) return res.status(404).json({ message: 'Feedback record not found.' });
    if (feedback.mentorId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to resolve this feedback.' });
    }

    const targetStatus = status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE';
    const updated = await prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: {
        status: targetStatus,
        resolvedAt: targetStatus === 'RESOLVED' ? new Date() : null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('toggleFeedbackResolved error:', error);
    res.status(500).json({ message: 'Failed to update feedback status.' });
  }
};

const deleteTradeFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const feedback = await prisma.mentorFeedback.findUnique({ where: { id: feedbackId } });

    if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
    if (feedback.mentorId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to delete this feedback.' });
    }

    await prisma.mentorFeedback.delete({ where: { id: feedbackId } });
    res.json({ message: 'Feedback deleted successfully.' });
  } catch (error) {
    console.error('deleteTradeFeedback error:', error);
    res.status(500).json({ message: 'Failed to delete feedback.' });
  }
};

// ==========================================
// 7. REVIEW ASSIGNMENTS & TASKS
// ==========================================

const createAssignment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, instructions, targetStudentId, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Assignment title is required.' });
    }
    if (!instructions || !instructions.trim()) {
      return res.status(400).json({ message: 'Assignment instructions are required.' });
    }

    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id },
      include: { students: { where: { status: 'ACTIVE' }, select: { studentId: true } } }
    });

    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    const assignment = await prisma.mentorAssignment.create({
      data: {
        mentorGroupId: groupId,
        mentorId: req.user.id,
        title: title.trim(),
        instructions: instructions.trim(),
        targetStudentId: targetStudentId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'ACTIVE'
      }
    });

    // Notify cohort students
    const targetRecipients = targetStudentId ? [targetStudentId] : group.students.map(s => s.studentId);
    if (targetRecipients.length > 0) {
      notificationService.sendManualNotification(
        'New Assignment Assigned',
        `New trading task in ${group.name}: "${title.trim()}". Check instructions and submit your review.`,
        targetRecipients,
        'ASSIGNMENT',
        req.user.id,
        `/student-cohorts?tab=assignments&cohortId=${groupId}`
      ).catch(err => console.warn('Assignment notification warning:', err?.message));
    }

    res.status(201).json(assignment);
  } catch (error) {
    console.error('createAssignment error:', error);
    res.status(500).json({ message: 'Failed to create assignment.' });
  }
};

const getGroupAssignments = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Check authorization: mentor of group OR enrolled student
    const isMentor = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id }
    });

    const isStudent = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: groupId, studentId: req.user.id, status: 'ACTIVE' }
    });

    if (!isMentor && !isStudent && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to view assignments for this cohort.' });
    }

    const assignments = await prisma.mentorAssignment.findMany({
      where: {
        mentorGroupId: groupId,
        ...(isStudent && !isMentor ? {
          OR: [
            { targetStudentId: null },
            { targetStudentId: req.user.id }
          ]
        } : {})
      },
      include: {
        submissions: {
          include: {
            student: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(assignments);
  } catch (error) {
    console.error('getGroupAssignments error:', error);
    res.status(500).json({ message: 'Failed to load assignments.' });
  }
};

const submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { content, tradeIds } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Submission content is required.' });
    }

    const assignment = await prisma.mentorAssignment.findUnique({
      where: { id: assignmentId },
      include: { mentorGroup: true }
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    // Verify student is enrolled in the cohort
    const enrolled = await prisma.mentorStudent.findFirst({
      where: { mentorGroupId: assignment.mentorGroupId, studentId: req.user.id, status: 'ACTIVE' }
    });

    if (!enrolled) {
      return res.status(403).json({ message: 'You are not actively enrolled in this cohort.' });
    }

    const cleanTradeIds = Array.isArray(tradeIds) ? tradeIds.filter(Boolean) : [];

    const submission = await prisma.mentorAssignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: req.user.id
        }
      },
      update: {
        content: content.trim(),
        tradeIds: cleanTradeIds,
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      create: {
        assignmentId,
        studentId: req.user.id,
        content: content.trim(),
        tradeIds: cleanTradeIds,
        status: 'SUBMITTED'
      }
    });

    // Notify mentor
    notificationService.sendManualNotification(
      'Assignment Submitted',
      `${req.user.name || 'Student'} submitted their work for "${assignment.title}".`,
      [assignment.mentorId],
      'SUBMISSION',
      req.user.id,
      `/mentor-workspace?tab=roster&cohortId=${assignment.mentorGroupId}`
    ).catch(err => console.warn('Submission notification warning:', err?.message));

    res.status(201).json(submission);
  } catch (error) {
    console.error('submitAssignment error:', error);
    res.status(500).json({ message: 'Failed to submit assignment.' });
  }
};

const reviewAssignmentSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { mentorFeedback, grade, status } = req.body;

    const submission = await prisma.mentorAssignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: true,
        student: { select: { id: true, name: true } }
      }
    });

    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    if (submission.assignment.mentorId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to review this submission.' });
    }

    const updated = await prisma.mentorAssignmentSubmission.update({
      where: { id: submissionId },
      data: {
        mentorFeedback: mentorFeedback !== undefined ? mentorFeedback?.trim() || null : submission.mentorFeedback,
        grade: grade !== undefined ? grade?.trim() || null : submission.grade,
        status: status || 'REVIEWED',
        reviewedAt: new Date()
      }
    });

    // Notify student
    notificationService.sendManualNotification(
      'Assignment Reviewed',
      `Your submission for "${submission.assignment.title}" has been reviewed by your mentor.${grade ? ` Grade: ${grade}` : ''}`,
      [submission.studentId],
      'ASSIGNMENT_REVIEW',
      req.user.id,
      '/student-cohorts?tab=assignments'
    ).catch(err => console.warn('Review notification warning:', err?.message));

    res.json(updated);
  } catch (error) {
    console.error('reviewAssignmentSubmission error:', error);
    res.status(500).json({ message: 'Failed to save submission review.' });
  }
};

// ==========================================
// 8. INDEPENDENT COACHING SUMMARIES
// ==========================================

const draftMentorSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    const membership = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id }, status: 'ACTIVE' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            userSettings: { select: { shareTradesWithMentor: true } }
          }
        }
      }
    });

    if (!membership && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized to mentor this student.' });
    }

    if (membership && membership.student.userSettings?.shareTradesWithMentor === false && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Student has disabled trade sharing.' });
    }

    const recentTrades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: studentId, isSharedWithMentor: true } },
      orderBy: { entryTime: 'desc' },
      take: 25,
      include: { ruleViolations: true }
    });

    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let violations = 0;
    let totalPnl = 0;

    recentTrades.forEach(t => {
      if (t.result === 'WIN') wins++;
      else if (t.result === 'LOSS') losses++;
      else breakeven++;
      violations += t.ruleViolations?.length || 0;
      totalPnl += t.profitLossAmount || 0;
    });

    const metricsSnapshot = {
      sampleSize: recentTrades.length,
      wins,
      losses,
      breakeven,
      violations,
      winRate: recentTrades.length > 0 ? Number(((wins / recentTrades.length) * 100).toFixed(1)) : 0,
      totalPnl: Number(totalPnl.toFixed(2)),
    };

    const provider = getProvider();
    const systemPrompt = `You are an elite trading psychologist and professional mentor assistant.
Draft an authoritative, constructive monthly coaching reflection letter evaluating the student's execution, discipline, and rule adherence.`;

    const userPrompt = `Student: ${membership.student.name}
Recent Trades Evaluated: ${recentTrades.length} trades (${wins} wins, ${losses} losses, ${breakeven} breakeven).
Total Strategy Rule Violations: ${violations}.
Net Realized PnL: $${metricsSnapshot.totalPnl}.

Provide a markdown letter with:
1. Executive Assessment
2. Key Strengths Observed
3. Critical Risk & Execution Areas for Improvement
4. Recommended 30-Day Growth Protocol.`;

    const SummarySchema = z.object({
      draftTitle: z.string(),
      markdownLetter: z.string()
    });

    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, SummarySchema, 1);

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to draft AI summary.' });
    }

    res.json({
      draftTitle: result.data.draftTitle,
      markdownLetter: result.data.markdownLetter,
      metricsSnapshot
    });
  } catch (error) {
    console.error('draftMentorSummary error:', error);
    res.status(500).json({ message: 'Failed to generate coaching summary draft.' });
  }
};

const sendMentorSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { title, summary, metricsSnapshot, groupId } = req.body;

    if (!summary || !summary.trim()) {
      return res.status(400).json({ message: 'Summary content is required.' });
    }

    const membership = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id }, status: 'ACTIVE' }
    });

    if (!membership && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized to mentor this student.' });
    }

    // Save as an independent MentorCoachingSummary record
    const coachingSummary = await prisma.mentorCoachingSummary.create({
      data: {
        mentorId: req.user.id,
        studentId,
        mentorGroupId: groupId || membership?.mentorGroupId || null,
        title: title?.trim() || 'Coaching Reflection & Performance Review',
        summary: summary.trim(),
        metricsSnapshot: metricsSnapshot || null,
        isDelivered: true,
        deliveredAt: new Date()
      },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Notify student
    notificationService.sendManualNotification(
      'New Mentor Coaching Summary',
      `Your mentor ${req.user.name} delivered a new coaching evaluation summary to your dashboard.`,
      [studentId],
      'COACHING_SUMMARY',
      req.user.id,
      '/student-cohorts?tab=my_reviews'
    ).catch(err => console.warn('Summary notification warning:', err?.message));

    res.status(201).json({
      message: 'Coaching summary delivered to student successfully!',
      coachingSummary
    });
  } catch (error) {
    console.error('sendMentorSummary error:', error);
    res.status(500).json({ message: 'Failed to deliver coaching summary.' });
  }
};

const getCoachingSummaries = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Must be the student themselves or their authorized mentor
    const isSelf = req.user.id === studentId;
    const isMentor = await prisma.mentorStudent.findFirst({
      where: { studentId, mentorGroup: { mentorId: req.user.id }, status: 'ACTIVE' }
    });

    if (!isSelf && !isMentor && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to view coaching summaries.' });
    }

    const summaries = await prisma.mentorCoachingSummary.findMany({
      where: { studentId },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(summaries);
  } catch (error) {
    console.error('getCoachingSummaries error:', error);
    res.status(500).json({ message: 'Failed to retrieve coaching summaries.' });
  }
};

// ==========================================
// 9. COHORT ANALYTICS & AGGREGATE STATS
// ==========================================

const getCohortAnalytics = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.mentorGroup.findFirst({
      where: { id: groupId, mentorId: req.user.id },
      include: {
        students: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                userSettings: { select: { shareTradesWithMentor: true } },
                tradingAccounts: {
                  where: { isSharedWithMentor: true },
                  select: { id: true, currency: true }
                }
              }
            }
          }
        },
        assignments: {
          include: {
            _count: { select: { submissions: true } }
          }
        }
      }
    });

    if (!group && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ message: 'Cohort not found or unauthorized.' });
    }

    // Collect all shared account IDs from active students who haven't disabled sharing
    const eligibleStudentMemberships = group.students.filter(
      s => s.student?.userSettings?.shareTradesWithMentor !== false
    );

    const accountIds = [];
    eligibleStudentMemberships.forEach(s => {
      const studentAccounts = s.student.tradingAccounts || [];
      const scopedAccounts = s.sharedAccountIds && s.sharedAccountIds.length > 0
        ? studentAccounts.filter(a => s.sharedAccountIds.includes(a.id))
        : studentAccounts;
      accountIds.push(...scopedAccounts.map(a => a.id));
    });

    // Query trades across shared accounts
    const trades = accountIds.length > 0 ? await prisma.trade.findMany({
      where: { tradingAccountId: { in: accountIds } },
      select: {
        id: true,
        result: true,
        profitLossAmount: true,
        profitLossPercent: true,
        riskRewardRatio: true,
        pair: true,
        stopLoss: true,
        riskAmount: true,
        entryTime: true,
        tradingAccount: { select: { currency: true, startingBalance: true } },
        ruleViolations: { select: { id: true } }
      }
    }) : [];

    let totalWins = 0;
    let totalLosses = 0;
    let totalBreakeven = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalNetPnl = 0;
    let totalRuleViolations = 0;
    let totalRiskGuardBreaches = 0;

    const maxRisk = group.maxRiskPerTradePercent || 1.0;
    const requireSL = group.requireStopLoss ?? true;
    const allowedPairs = (group.allowedPairs || []).map(p => p.trim().toUpperCase()).filter(Boolean);

    trades.forEach(t => {
      if (t.result === 'WIN') {
        totalWins++;
        if (t.profitLossAmount > 0) grossProfit += t.profitLossAmount;
      } else if (t.result === 'LOSS') {
        totalLosses++;
        if (t.profitLossAmount < 0) grossLoss += Math.abs(t.profitLossAmount);
      } else {
        totalBreakeven++;
      }

      totalNetPnl += (t.profitLossAmount || 0);
      totalRuleViolations += (t.ruleViolations?.length || 0);

      // Check Risk Guard violations
      if (group.enforceRiskGuard) {
        if (requireSL && (t.stopLoss === null || t.stopLoss === undefined)) {
          totalRiskGuardBreaches++;
        }
        const balance = t.tradingAccount?.startingBalance || 0;
        const riskPercent = t.riskAmount && balance > 0
          ? (t.riskAmount / balance) * 100
          : (t.profitLossPercent < 0 ? Math.abs(t.profitLossPercent) : null);
        if (riskPercent !== null && maxRisk > 0 && riskPercent > maxRisk) {
          totalRiskGuardBreaches++;
        }
        if (allowedPairs.length > 0 && t.pair) {
          const cleanPair = t.pair.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const isAllowed = allowedPairs.some(p => {
            const cleanAllowed = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return cleanPair.includes(cleanAllowed) || cleanAllowed.includes(cleanPair);
          });
          if (!isAllowed) totalRiskGuardBreaches++;
        }
      }
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? Number(((totalWins / totalTrades) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.9 : 0);

    const totalAssignments = group.assignments?.length || 0;
    const totalSubmissions = group.assignments?.reduce((acc, a) => acc + (a._count?.submissions || 0), 0) || 0;
    const expectedSubmissions = totalAssignments * eligibleStudentMemberships.length;
    const assignmentCompletionRate = expectedSubmissions > 0
      ? Number(((totalSubmissions / expectedSubmissions) * 100).toFixed(1))
      : 0;

    res.json({
      cohortId: group.id,
      cohortName: group.name,
      activeStudents: group.students.length,
      participatingStudents: eligibleStudentMemberships.length,
      metrics: {
        totalTrades,
        totalWins,
        totalLosses,
        totalBreakeven,
        winRate,
        profitFactor,
        netPnl: Number(totalNetPnl.toFixed(2)),
        totalRuleViolations,
        totalRiskGuardBreaches,
        ruleAdherenceScore: totalTrades > 0 ? Math.max(0, 100 - Math.round(((totalRuleViolations + totalRiskGuardBreaches) / totalTrades) * 100)) : 100,
        assignmentCompletionRate,
      }
    });
  } catch (error) {
    console.error('getCohortAnalytics error:', error);
    res.status(500).json({ message: 'Failed to calculate cohort analytics.' });
  }
};

// ==========================================
// 10. PAYOUT SETTINGS & BRANDING
// ==========================================

const FALLBACK_NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044', aliases: ['access'] },
  { name: 'Citibank Nigeria', code: '023', aliases: ['citi', 'citibank'] },
  { name: 'Ecobank Nigeria', code: '050', aliases: ['ecobank'] },
  { name: 'Fidelity Bank', code: '070', aliases: ['fidelity'] },
  { name: 'First Bank of Nigeria', code: '011', aliases: ['first bank', 'firstbank', 'fbn'] },
  { name: 'First City Monument Bank', code: '214', aliases: ['fcmb'] },
  { name: 'Globus Bank', code: '00103', aliases: ['globus'] },
  { name: 'Guaranty Trust Bank', code: '058', aliases: ['gtbank', 'gtb', 'guaranty trust'] },
  { name: 'Jaiz Bank', code: '301', aliases: ['jaiz'] },
  { name: 'Keystone Bank', code: '082', aliases: ['keystone'] },
  { name: 'Kuda Bank', code: '50211', aliases: ['kuda'] },
  { name: 'Lotus Bank', code: '303', aliases: ['lotus'] },
  { name: 'Moniepoint MFB', code: '50515', aliases: ['moniepoint'] },
  { name: 'OPay Digital Services Limited (OPay)', code: '999992', aliases: ['opay', 'paycom'] },
  { name: 'PalmPay', code: '999991', aliases: ['palmpay'] },
  { name: 'Parallex Bank', code: '104', aliases: ['parallex'] },
  { name: 'Polaris Bank', code: '076', aliases: ['polaris', 'skye'] },
  { name: 'PremiumTrust Bank', code: '105', aliases: ['premiumtrust'] },
  { name: 'Providus Bank', code: '101', aliases: ['providus'] },
  { name: 'Stanbic IBTC Bank', code: '221', aliases: ['stanbic', 'ibtc'] },
  { name: 'Standard Chartered Bank', code: '068', aliases: ['standard chartered'] },
  { name: 'Sterling Bank', code: '232', aliases: ['sterling'] },
  { name: 'Suntrust Bank', code: '100', aliases: ['suntrust'] },
  { name: 'TAJ Bank', code: '302', aliases: ['taj'] },
  { name: 'Titan Bank', code: '102', aliases: ['titan'] },
  { name: 'Union Bank of Nigeria', code: '032', aliases: ['union bank'] },
  { name: 'United Bank For Africa', code: '033', aliases: ['uba', 'united bank for africa'] },
  { name: 'Unity Bank', code: '215', aliases: ['unity'] },
  { name: 'VFD Microfinance Bank Limited', code: '566', aliases: ['vfd', 'vbank'] },
  { name: 'Wema Bank', code: '035', aliases: ['wema', 'alat'] },
  { name: 'Zenith Bank', code: '057', aliases: ['zenith'] },
];

let cachedPaystackBanks = null;
let cachedPaystackBanksAt = 0;

const fetchPaystackBanks = async () => {
  if (cachedPaystackBanks && Date.now() - cachedPaystackBanksAt < 3600000) {
    return cachedPaystackBanks;
  }
  const secret = getPaystackSecret();
  if (secret && secret !== 'sk_test_example') {
    try {
      const response = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=100', {
        headers: { Authorization: `Bearer ${secret}` }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.data) && data.data.length > 0) {
        cachedPaystackBanks = data.data.map((b) => ({ name: b.name, code: b.code }));
        cachedPaystackBanksAt = Date.now();
        return cachedPaystackBanks;
      }
    } catch (_) {}
  }
  return FALLBACK_NIGERIAN_BANKS.map(({ name, code }) => ({ name, code }));
};

const resolvePaystackBankCode = (bankCode, bankName, banks = []) => {
  const cleanCode = String(bankCode || '').trim();
  if (cleanCode) return cleanCode;
  const cleanName = String(bankName || '').trim().toLowerCase();
  if (!cleanName) return null;

  const exactLive = banks.find((b) => String(b.name || '').trim().toLowerCase() === cleanName);
  if (exactLive) return exactLive.code;

  const fallbackMatch = FALLBACK_NIGERIAN_BANKS.find((b) => {
    if (b.name.toLowerCase() === cleanName) return true;
    return (b.aliases || []).some((alias) => cleanName.includes(alias));
  });
  if (fallbackMatch) return fallbackMatch.code;

  const partialLive = banks.find((b) => {
    const n = String(b.name || '').trim().toLowerCase();
    return n.includes(cleanName) || cleanName.includes(n);
  });
  return partialLive ? partialLive.code : null;
};

const getPayoutSettings = async (req, res) => {
  try {
    const [user, banks] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          mentorBankName: true,
          mentorAccountNumber: true,
          mentorAccountName: true,
          mentorBankCode: true,
          mentorSubaccountCode: true,
        }
      }),
      fetchPaystackBanks(),
    ]);
    res.json({ ...(user || {}), banks });
  } catch (error) {
    console.error('getPayoutSettings error:', error);
    res.status(500).json({ message: 'Failed to load payout settings.' });
  }
};

const updatePayoutSettings = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, bankCode } = req.body;
    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        mentorSubaccountCode: true,
      }
    });

    const banks = await fetchPaystackBanks();
    const resolvedBankCode = resolvePaystackBankCode(bankCode, bankName, banks);
    const resolvedBankObj = banks.find((b) => b.code === resolvedBankCode);
    const resolvedBankName = bankName?.trim() || resolvedBankObj?.name || null;
    const cleanAccountNumber = accountNumber?.trim() || null;
    const cleanAccountName = accountName?.trim() || existingUser?.name || null;

    let subaccountCode = existingUser?.mentorSubaccountCode || null;
    let subaccountMessage = null;
    const secret = getPaystackSecret();

    if (secret && secret !== 'sk_test_example' && resolvedBankCode && cleanAccountNumber && cleanAccountName) {
      try {
        const subPayload = {
          business_name: cleanAccountName,
          settlement_bank: resolvedBankCode,
          account_number: cleanAccountNumber,
          percentage_charge: 1.5,
          primary_contact_email: existingUser?.email,
          primary_contact_name: existingUser?.name || cleanAccountName,
          description: 'JAHZJOURNALS Mentor Academy Settlement Subaccount (98.5% / 1.5% split)',
        };

        let subRes;
        let subData;

        if (subaccountCode) {
          subRes = await fetch(`https://api.paystack.co/subaccount/${encodeURIComponent(subaccountCode)}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${secret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subPayload),
          });
          subData = await subRes.json();
        }

        if (!subaccountCode || !subData?.status) {
          subRes = await fetch('https://api.paystack.co/subaccount', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${secret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subPayload),
          });
          subData = await subRes.json();
        }

        if (subData?.status && subData?.data?.subaccount_code) {
          subaccountCode = subData.data.subaccount_code;
          subaccountMessage = `Paystack subaccount (${subaccountCode}) synced with 98.5% direct settlement.`;
        } else if (subData?.message) {
          subaccountMessage = `Bank saved. Paystack subaccount note: ${subData.message}`;
        }
      } catch (subErr) {
        console.warn('Paystack subaccount sync warning:', subErr?.message);
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        mentorBankName: resolvedBankName,
        mentorAccountNumber: cleanAccountNumber,
        mentorAccountName: cleanAccountName,
        mentorBankCode: resolvedBankCode || bankCode?.trim() || null,
        mentorSubaccountCode: subaccountCode,
      },
      select: {
        mentorBankName: true,
        mentorAccountNumber: true,
        mentorAccountName: true,
        mentorBankCode: true,
        mentorSubaccountCode: true,
      }
    });

    res.json({
      message: subaccountMessage || 'Settlement bank details saved successfully!',
      subaccountCreated: Boolean(subaccountCode),
      payoutSettings: updated,
    });
  } catch (error) {
    console.error('updatePayoutSettings error:', error);
    res.status(500).json({ message: 'Failed to update payout settings.' });
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
  getStudentEnrolledCohorts,
  leaveCohort,
  inviteStudent,
  getGroupInvitations,
  resendInvitation,
  revokeInvitation,
  getInvitationDetails,
  acceptInvitation,
  getPublicGroupInfo,
  joinGroup,
  checkoutPaidGroup,
  verifyCohortEnrollment,
  getStudentTrades,
  addTradeFeedback,
  replyToTradeFeedback,
  toggleFeedbackResolved,
  deleteTradeFeedback,
  createAssignment,
  getGroupAssignments,
  submitAssignment,
  reviewAssignmentSubmission,
  draftMentorSummary,
  sendMentorSummary,
  getCoachingSummaries,
  getCohortAnalytics,
  getPayoutSettings,
  updatePayoutSettings,
  uploadMentorLogo
};
