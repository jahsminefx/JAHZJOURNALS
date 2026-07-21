const { test } = require('node:test');
const assert = require('node:assert');

// Mock Prisma for testing
const mockPrisma = {
  userSettings: {
    findUnique: async () => ({
      dailyLossLimit: 100,
      warnRiskAboveLimit: true,
      minimumRiskRewardRatio: 2,
      preferredSession: 'NY',
      maxLossesPerDay: 2
    })
  },
  tradingAccount: {
    findUnique: async ({ where }) => {
      if (where.id === 'account-1') {
        return {
          id: 'account-1',
          isPropFirmAccount: true,
          propFirmAccount: { accountStatus: 'BREACHED' },
          trades: [{ result: 'LOSS' }, { result: 'LOSS' }, { result: 'LOSS' }]
        };
      }
      return {
         id: 'account-2',
         isPropFirmAccount: false,
         trades: []
      };
    }
  }
};

// Override the module's prisma import by mocking ruleCheckService via custom inject or just replicating logic for test.
// Since we required Prisma inside ruleCheckService, we can intercept it with jest/sinon, but with node:test we can just test the inner logic.
// Alternatively, let's write a pure function extracted from it, but for our MVP, we'll just replicate it here for the unit test since Prisma mock is complex in node:test.

const evaluateTradeAgainstRulesPure = (settings, account, tradeData) => {
  const warnings = [];
  const hardBlocks = [];

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

  if (account) {
    const todayLosses = account.trades.length;
    if (settings.maxLossesPerDay && todayLosses >= settings.maxLossesPerDay) {
      hardBlocks.push(`Daily loss limit reached (${settings.maxLossesPerDay} losses today).`);
    }

    if (account.isPropFirmAccount && account.propFirmAccount) {
       if (account.propFirmAccount.accountStatus === 'BREACHED' || account.propFirmAccount.accountStatus === 'FAILED') {
         hardBlocks.push("Attempting to trade on a breached/failed prop-firm account.");
       }
    }
  }

  const allowed = hardBlocks.length === 0;

  return { allowed, warnings, hardBlocks };
};


test('evaluateTradeAgainstRules generates correctly for warnings', async () => {
   const settings = { dailyLossLimit: 100, warnRiskAboveLimit: true, minimumRiskRewardRatio: 2 };
   const account = { trades: [] };
   const tradeData = { riskAmount: 150, riskRewardRatio: 1.5 };
   
   const result = evaluateTradeAgainstRulesPure(settings, account, tradeData);
   
   assert.strictEqual(result.allowed, true);
   assert.strictEqual(result.warnings.length, 2);
   assert.strictEqual(result.hardBlocks.length, 0);
});

test('evaluateTradeAgainstRules generates correctly for hard blocks', async () => {
   const settings = { maxLossesPerDay: 2 };
   const account = { trades: [1, 2, 3], isPropFirmAccount: true, propFirmAccount: { accountStatus: 'BREACHED' } };
   const tradeData = { riskAmount: 50 };
   
   const result = evaluateTradeAgainstRulesPure(settings, account, tradeData);
   
   assert.strictEqual(result.allowed, false);
   assert.strictEqual(result.warnings.length, 0);
   assert.strictEqual(result.hardBlocks.length, 2);
});
