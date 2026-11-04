const {
  createPropFirmAccountSchema,
  updatePropFirmAccountSchema,
  propFirmAdvancedSettingsSchema,
  propFirmPhaseSchema,
  propFirmProgressSnapshotSchema,
  formatZodError,
} = require('../validation/accountSchemas');
const {
  getPropFirmAccountForUser,
  createPropFirmAccount,
  updatePropFirmAccount,
  updateAdvancedSettings,
  deletePropFirmAccount,
  createPhase,
  updatePhase,
  deletePhase,
  listProgressSnapshots,
  createProgressSnapshot,
} = require('../services/propFirmAccountService');

const sendPrismaError = (res, error, fallbackMessage) => {
  if (error.code === 'P2002') {
    return res.status(400).json({ message: 'A record with these unique details already exists.' });
  }

  console.error(error);
  return res.status(500).json({ message: fallbackMessage });
};

const createPropFirm = async (req, res) => {
  try {
    const parsed = createPropFirmAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await createPropFirmAccount(req.user.id, parsed.data);
    res.status(201).json(account);
  } catch (error) {
    sendPrismaError(res, error, 'We couldn\'t set up your prop-firm account right now.');
  }
};

const getPropFirm = async (req, res) => {
  try {
    const account = await getPropFirmAccountForUser(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account' });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t retrieve your prop-firm account.' });
  }
};

const updatePropFirm = async (req, res) => {
  try {
    const parsed = updatePropFirmAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await updatePropFirmAccount(req.user.id, req.params.id, parsed.data);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json(account);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating your prop-firm account.');
  }
};

const updatePropFirmAdvancedSettings = async (req, res) => {
  try {
    const parsed = propFirmAdvancedSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await updateAdvancedSettings(req.user.id, req.params.id, parsed.data);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json(account);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating your advanced settings.');
  }
};

const removePropFirm = async (req, res) => {
  try {
    const account = await deletePropFirmAccount(req.user.id, req.params.id);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json({ message: 'Prop-firm account removed from your sanctuary.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t delete that prop-firm account right now.' });
  }
};

const addPhase = async (req, res) => {
  try {
    const parsed = propFirmPhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const phase = await createPhase(req.user.id, req.params.id, parsed.data);
    if (!phase) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.status(201).json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'We couldn\'t create that evaluation phase.');
  }
};

const editPhase = async (req, res) => {
  try {
    const parsed = propFirmPhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const phase = await updatePhase(req.user.id, req.params.phaseId, parsed.data);
    if (!phase) {
      return res.status(404).json({ message: 'We couldn\'t find that evaluation phase.' });
    }

    res.json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating that evaluation phase.');
  }
};

const removePhase = async (req, res) => {
  try {
    const phase = await deletePhase(req.user.id, req.params.phaseId);
    if (!phase) {
      return res.status(404).json({ message: 'We couldn\'t find that evaluation phase.' });
    }

    res.json({ message: 'Prop-firm phase removed safely.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t remove that phase right now.' });
  }
};

const getProgress = async (req, res) => {
  try {
    const snapshots = await listProgressSnapshots(req.user.id, req.params.id);
    if (!snapshots) {
      return res.status(404).json({ message: 'We couldn\'t find your prop-firm account.' });
    }

    res.json(snapshots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t fetch your progress journey.' });
  }
};

const addProgressSnapshot = async (req, res) => {
  try {
    const parsed = propFirmProgressSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const snapshot = await createProgressSnapshot(req.user.id, req.params.id, parsed.data);
    if (!snapshot) {
      return res.status(404).json({ message: 'We couldn\'t find your prop-firm account.' });
    }

    res.status(201).json(snapshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t record your progress right now.' });
  }
};

const { getPropFirmComplianceReport } = require('../services/propFirmRuleEngine');
const propFirmRiskGuard = require('../services/propFirmRiskGuardService');
const propFirmPayoutService = require('../services/propFirmPayoutService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCompliance = async (req, res) => {
  try {
    const compliance = await getPropFirmComplianceReport(req.user.id, req.params.id);
    if (!compliance) {
      return res.status(404).json({ message: 'Prop firm account compliance data not found.' });
    }

    res.json(compliance);
  } catch (error) {
    console.error('[PropFirmCompliance] Error evaluating compliance:', error);
    res.status(500).json({ message: 'Failed to calculate prop firm compliance.' });
  }
};

const advancePhase = async (req, res) => {
  try {
    const { id } = req.params;
    const compliance = await getPropFirmComplianceReport(req.user.id, id);
    if (!compliance) {
      return res.status(404).json({ message: 'Prop-firm account not found.' });
    }

    if (!compliance.challengeProgress.isTargetReached) {
      return res.status(400).json({
        message: `Profit target not met. Current profit: $${compliance.challengeProgress.currentProfitAmount}, required target: $${compliance.challengeProgress.targetProfitAmount}`,
      });
    }

    if (!compliance.tradingDays.isMinimumMet) {
      return res.status(400).json({
        message: `Minimum trading days requirement not met. Completed: ${compliance.tradingDays.completedDays}, required: ${compliance.tradingDays.requiredDays} days`,
      });
    }

    if (
      compliance.overallDrawdown.status === 'BREACH_DETECTED' ||
      compliance.dailyLoss.status === 'BREACH_DETECTED'
    ) {
      return res.status(400).json({
        message: 'Cannot advance phase: account has breached drawdown or daily loss limits.',
      });
    }

    const propFirm = await prisma.propFirmAccount.findUnique({
      where: { tradingAccountId: id },
      include: { phases: { orderBy: { phaseNumber: 'asc' } } },
    });

    if (!propFirm) {
      return res.status(404).json({ message: 'Prop firm record not found.' });
    }

    const currentPhase =
      propFirm.phases.find((p) => p.phaseNumber === propFirm.currentPhaseNumber) ||
      propFirm.phases[0];
    const nextPhase = propFirm.phases.find(
      (p) => p.phaseNumber === (currentPhase ? currentPhase.phaseNumber + 1 : 2)
    );

    await prisma.$transaction(async (tx) => {
      if (currentPhase) {
        await tx.propFirmPhase.update({
          where: { id: currentPhase.id },
          data: { status: 'PASSED' },
        });
      }

      if (nextPhase) {
        await tx.propFirmPhase.update({
          where: { id: nextPhase.id },
          data: { status: 'ACTIVE' },
        });
        await tx.propFirmAccount.update({
          where: { id: propFirm.id },
          data: {
            currentPhaseNumber: nextPhase.phaseNumber,
            accountStatus: 'ACTIVE',
          },
        });
      } else {
        await tx.propFirmAccount.update({
          where: { id: propFirm.id },
          data: {
            accountStatus: 'FUNDED',
          },
        });
      }

      await tx.propFirmProgressSnapshot.create({
        data: {
          propFirmAccountId: propFirm.id,
          balance: compliance.currentBalance,
          equity: compliance.currentBalance,
          overallProfitLoss: compliance.challengeProgress.currentProfitAmount,
          completedTradingDays: compliance.tradingDays.completedDays,
          bestDayProfit: compliance.consistency.bestDayProfit,
        },
      });
    });

    const updatedCompliance = await getPropFirmComplianceReport(req.user.id, id);
    return res.json({
      message: nextPhase
        ? `Successfully advanced to Phase ${nextPhase.phaseNumber} (${nextPhase.name})!`
        : 'Congratulations! You have passed all evaluation phases and this account is now FUNDED!',
      compliance: updatedCompliance,
    });
  } catch (error) {
    console.error('[PropFirmAdvancePhase] Error advancing phase:', error);
    return res.status(500).json({ message: 'Failed to advance phase.' });
  }
};

const evaluateTradeRisk = async (req, res) => {
  try {
    const { id } = req.params;
    const { lotSize, entryPrice, stopLoss, pair, direction, estimatedRiskAmount } = req.body;
    const evaluation = await propFirmRiskGuard.evaluateProposedTrade({
      tradingAccountId: id,
      userId: req.user.id,
      lotSize,
      entryPrice,
      stopLoss,
      pair,
      direction,
      estimatedRiskAmount,
    });

    if (!evaluation || !evaluation.isPropFirmAccount) {
      return res.status(404).json({ message: 'Prop firm account not found.' });
    }

    return res.json(evaluation);
  } catch (error) {
    console.error('[PropFirmRiskGuard] Error evaluating risk:', error);
    return res.status(500).json({ message: 'Failed to evaluate proposed trade risk.' });
  }
};

const getPayouts = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await propFirmPayoutService.listPayouts(id, req.user.id);
    if (!result) {
      return res.status(404).json({ message: 'Prop firm account not found.' });
    }

    return res.json(result);
  } catch (error) {
    console.error('[PropFirmPayout] Error listing payouts:', error);
    return res.status(500).json({ message: 'Failed to load payouts.' });
  }
};

const createPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await propFirmPayoutService.requestPayout(id, req.user.id, req.body);
    return res.status(201).json(payout);
  } catch (error) {
    console.error('[PropFirmPayout] Error requesting payout:', error);
    return res.status(400).json({ message: error.message || 'Failed to request payout.' });
  }
};

const updatePayoutStatus = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const updated = await propFirmPayoutService.updatePayout(payoutId, req.user.id, req.body);
    return res.json(updated);
  } catch (error) {
    console.error('[PropFirmPayout] Error updating payout:', error);
    return res.status(400).json({ message: error.message || 'Failed to update payout.' });
  }
};

module.exports = {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  updatePropFirmAdvancedSettings,
  removePropFirm,
  addPhase,
  editPhase,
  removePhase,
  getProgress,
  addProgressSnapshot,
  getCompliance,
  advancePhase,
  evaluateTradeRisk,
  getPayouts,
  createPayout,
  updatePayoutStatus,
};
