const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const evaluateTradeAgainstRules = async (userId, tradeData) => {
  const warnings = [];
  const hardBlocks = [];

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) return { warnings, hardBlocks, allowed: true };

  // 1. Basic Risk check
  if (tradeData.riskAmount && settings.dailyLossLimit) {
    if (tradeData.riskAmount > settings.dailyLossLimit) {
      if (settings.warnRiskAboveLimit) {
        warnings.push(`Risk of $${tradeData.riskAmount} exceeds your daily loss limit of $${settings.dailyLossLimit}.`);
      }
    }
  }

  // 2. R:R check
  if (tradeData.riskRewardRatio && settings.minimumRiskRewardRatio) {
     if (tradeData.riskRewardRatio < settings.minimumRiskRewardRatio) {
       warnings.push(`Target R:R ${tradeData.riskRewardRatio} is lower than your minimum rule of ${settings.minimumRiskRewardRatio}.`);
     }
  }

  // 3. Stop loss check
  if (!tradeData.stopLoss) {
     warnings.push("Trading without a Stop Loss is a highly dangerous practice.");
     // If user was strictly forbidden, could add to hardBlocks
  }

  // 4. Session checks
  if (tradeData.session && settings.preferredSession) {
    if (tradeData.session !== settings.preferredSession && settings.preferredSession !== 'OTHER') {
      warnings.push(`Trading outside your preferred session (${settings.preferredSession}).`);
    }
  }

  // 5. Account/Prop-firm blocks (Simulated check)
  if (tradeData.tradingAccountId) {
    const account = await prisma.tradingAccount.findUnique({
      where: { id: tradeData.tradingAccountId },
      include: { propFirmAccount: true, trades: { where: { result: 'LOSS', entryTime: { gt: new Date(new Date().setHours(0,0,0,0)) } } } }
    });

    if (account) {
      const todayLosses = account.trades.length;

      // Regular max losses check
      if (settings.maxLossesPerDay && todayLosses >= settings.maxLossesPerDay) {
        hardBlocks.push(`Daily loss limit reached (${settings.maxLossesPerDay} losses today).`);
      }

      // Prop firm hard blocks (Simplified example)
      if (account.isPropFirmAccount && account.propFirmAccount) {
         if (account.propFirmAccount.accountStatus === 'BREACHED' || account.propFirmAccount.accountStatus === 'FAILED') {
           hardBlocks.push("Attempting to trade on a breached/failed prop-firm account.");
         }
      }
    }
  }

  const allowed = hardBlocks.length === 0;

  return {
    allowed,
    warnings,
    hardBlocks,
    summary: allowed 
      ? (warnings.length > 0 ? "You have some strategy warnings, but trade execution is allowed." : "Clear for entry. Follow your plan.") 
      : "Trade blocked by discipline rules."
  };
};

module.exports = {
  evaluateTradeAgainstRules
};
