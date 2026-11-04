const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const propFirmRuleEngine = require('./propFirmRuleEngine');

/**
 * List all payouts for a prop firm account
 */
async function listPayouts(tradingAccountId, userId) {
  const account = await prisma.tradingAccount.findFirst({
    where: { id: tradingAccountId, userId },
    include: { propFirmAccount: true },
  });

  if (!account || !account.propFirmAccount) {
    return null;
  }

  const payouts = await prisma.propFirmPayout.findMany({
    where: { propFirmAccountId: account.propFirmAccount.id },
    orderBy: { requestDate: 'desc' },
  });

  const totalPaid = payouts
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + (p.netTraderPayout || 0), 0);

  const totalPending = payouts
    .filter((p) => p.status === 'REQUESTED' || p.status === 'UNDER_REVIEW' || p.status === 'APPROVED')
    .reduce((sum, p) => sum + (p.netTraderPayout || 0), 0);

  return {
    payouts,
    summary: {
      totalPaid: Number(totalPaid.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      payoutCount: payouts.length,
      profitSplitPercent: account.propFirmAccount.profitSplitPercent ?? 80,
      payoutFrequency: account.propFirmAccount.payoutFrequency || 'BI_WEEKLY',
      firstPayoutDate: account.propFirmAccount.firstPayoutDate,
    },
  };
}

/**
 * Submit a payout request
 */
async function requestPayout(tradingAccountId, userId, payload) {
  const account = await prisma.tradingAccount.findFirst({
    where: { id: tradingAccountId, userId },
    include: { propFirmAccount: true },
  });

  if (!account || !account.propFirmAccount) {
    throw new Error('Prop-firm account not found.');
  }

  const propFirm = account.propFirmAccount;
  const isFunded =
    propFirm.accountStatus === 'FUNDED' ||
    ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(propFirm.evaluationType);

  if (!isFunded) {
    throw new Error('Payouts are only available for funded prop-firm accounts.');
  }

  const compliance = await propFirmRuleEngine.getPropFirmComplianceReport(tradingAccountId, userId);
  if (!compliance) {
    throw new Error('Unable to verify account compliance status.');
  }

  if (
    compliance.overallDrawdown.status === 'BREACH_DETECTED' ||
    compliance.dailyLoss.status === 'BREACH_DETECTED'
  ) {
    throw new Error('Cannot request payout: Account has breached risk rules.');
  }

  const amountRequested = Number(payload.amountRequested);
  if (!amountRequested || amountRequested <= 0) {
    throw new Error('Valid payout amount requested is required.');
  }

  const startingBalance = Number(account.startingBalance || 0);
  const currentBalance = compliance.currentBalance;
  const availableProfit = Math.max(0, currentBalance - startingBalance);

  if (amountRequested > availableProfit) {
    throw new Error(
      `Requested payout of $${amountRequested.toFixed(2)} exceeds available profit of $${availableProfit.toFixed(2)} above starting balance.`
    );
  }

  if (propFirm.minimumPayoutAmount && amountRequested < propFirm.minimumPayoutAmount) {
    throw new Error(
      `Requested amount is below the firm minimum payout threshold of $${propFirm.minimumPayoutAmount.toFixed(2)}.`
    );
  }

  const splitPercent = propFirm.profitSplitPercent ?? 80;
  const firmFee = Number(payload.firmFeeOrDeduction) || 0;
  const grossTraderShare = amountRequested * (splitPercent / 100);
  const netTraderPayout = Math.max(0, Number((grossTraderShare - firmFee).toFixed(2)));

  const payout = await prisma.propFirmPayout.create({
    data: {
      propFirmAccountId: propFirm.id,
      amountRequested,
      profitSplitPercent: splitPercent,
      netTraderPayout,
      firmFeeOrDeduction: firmFee,
      status: 'REQUESTED',
      paymentMethod: payload.paymentMethod || 'CRYPTO_USDT',
      transactionReference: payload.transactionReference || null,
      highWaterMarkAtRequest: compliance.overallDrawdown.highWaterMark,
      balanceAtRequest: currentBalance,
      notes: payload.notes || null,
    },
  });

  return payout;
}

/**
 * Update payout status (e.g. approve, mark paid, reject, or upload certificate)
 */
async function updatePayout(payoutId, userId, payload) {
  const existing = await prisma.propFirmPayout.findFirst({
    where: {
      id: payoutId,
      propFirmAccount: {
        tradingAccount: { userId },
      },
    },
  });

  if (!existing) {
    throw new Error('Payout record not found.');
  }

  const updated = await prisma.propFirmPayout.update({
    where: { id: payoutId },
    data: {
      ...(payload.status && { status: payload.status }),
      ...(payload.scheduledDate && { scheduledDate: new Date(payload.scheduledDate) }),
      ...(payload.processedDate && { processedDate: new Date(payload.processedDate) }),
      ...(payload.transactionReference && { transactionReference: payload.transactionReference }),
      ...(payload.certificateUrl && { certificateUrl: payload.certificateUrl }),
      ...(payload.notes && { notes: payload.notes }),
    },
  });

  return updated;
}

module.exports = {
  listPayouts,
  requestPayout,
  updatePayout,
};
