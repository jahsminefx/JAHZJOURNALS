const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAccounts() {
  try {
    console.log('🌱 Starting Trading Accounts Seeding...');

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const user = await prisma.user.upsert({
      where: { email: 'demo@jahzjournals.com' },
      update: {
        passwordHash,
        onboardingCompleted: true,
      },
      create: {
        email: 'demo@jahzjournals.com',
        name: 'Demo Trader',
        passwordHash,
        role: 'TRADER',
        onboardingCompleted: true,
      },
    });

    console.log(`👤 Seeding accounts for user: ${user.name} (${user.email})`);

    // Sample Account 1: Personal Live FX Account
    const account1 = await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: 'Personal Live FX (IC Markets)',
        accountCategory: 'REGULAR',
        brokerName: 'IC Markets',
        accountType: 'Raw Spread',
        startingBalance: 10000.0,
        currentBalance: 11450.0,
        currency: 'USD',
        platform: 'MT5',
        defaultRiskPercent: 1.0,
        maxDailyLossPercent: 3.0,
        maxTradesPerDay: 5,
        notes: 'Primary personal live trading account for EURUSD, GBPUSD & XAUUSD intraday setups.',
      },
    });

    // Sample Account 2: FTMO 100K Challenge (Prop Firm)
    const account2 = await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: 'FTMO $100K Challenge Phase 1',
        accountCategory: 'PROP_FIRM',
        brokerName: 'FTMO',
        accountType: 'Challenge',
        startingBalance: 100000.0,
        currentBalance: 106250.0,
        currency: 'USD',
        platform: 'cTrader',
        defaultRiskPercent: 0.5,
        maxDailyLossPercent: 5.0,
        profitTarget: 10000.0,
        maxDrawdown: 10000.0,
        dailyDrawdown: 5000.0,
        minimumTradingDays: 4,
        isPropFirmAccount: true,
        propFirmName: 'FTMO',
        notes: 'Target $10,000 profit (10%) with max $5k daily drawdown.',
      },
    });

    // Linked PropFirmAccount details for Account 2
    await prisma.propFirmAccount.create({
      data: {
        tradingAccountId: account2.id,
        firmName: 'FTMO',
        programmeName: '100k Normal',
        marketType: 'FOREX_CFD',
        evaluationType: 'TWO_STEP',
        accountStatus: 'ACTIVE',
        dailyLossAmount: 5000.0,
        maximumLossAmount: 10000.0,
      },
    });

    // Sample Account 3: FundedNext $50K Express (Prop Firm)
    const account3 = await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: 'FundedNext $50K Express',
        accountCategory: 'PROP_FIRM',
        brokerName: 'FundedNext',
        accountType: 'Evaluation',
        startingBalance: 50000.0,
        currentBalance: 52180.0,
        currency: 'USD',
        platform: 'MT4',
        defaultRiskPercent: 1.0,
        maxDailyLossPercent: 5.0,
        profitTarget: 7500.0,
        maxDrawdown: 5000.0,
        dailyDrawdown: 2500.0,
        isPropFirmAccount: true,
        propFirmName: 'FundedNext',
        notes: 'FundedNext Express model account focusing on London session breakouts.',
      },
    });

    await prisma.propFirmAccount.create({
      data: {
        tradingAccountId: account3.id,
        firmName: 'FundedNext',
        programmeName: 'Express 50k',
        marketType: 'FOREX_CFD',
        evaluationType: 'ONE_STEP',
        accountStatus: 'PASSED',
        dailyLossAmount: 2500.0,
        maximumLossAmount: 5000.0,
      },
    });

    // Sample Account 4: Strategy Testing Demo Account
    const account4 = await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: 'Crypto & Indices Backtest Demo',
        accountCategory: 'REGULAR',
        brokerName: 'Exness',
        accountType: 'Demo',
        startingBalance: 25000.0,
        currentBalance: 27800.0,
        currency: 'USD',
        platform: 'TradingView Paper',
        defaultRiskPercent: 2.0,
        notes: 'Forward testing new Asian session liquidity sweep strategy on BTCUSD & NAS100.',
      },
    });

    // Add initial trades for Account 1 to populate trade journal
    const now = new Date();
    await prisma.trade.createMany({
      data: [
        {
          tradingAccountId: account1.id,
          pair: 'EURUSD',
          direction: 'BUY',
          entryTime: new Date(now.getTime() - 86400000 * 2),
          exitTime: new Date(now.getTime() - 86400000 * 2 + 7200000),
          entryPrice: 1.0850,
          exitPrice: 1.0910,
          stopLoss: 1.0820,
          takeProfit: 1.0920,
          lotSize: 1.5,
          profitLossAmount: 900.0,
          status: 'CLOSED',
          result: 'WIN',
          session: 'LONDON',
          notesBefore: 'Clean breaker block retest during London open. Perfect 1:3 R:R execution.',
        },
        {
          tradingAccountId: account1.id,
          pair: 'GBPUSD',
          direction: 'SELL',
          entryTime: new Date(now.getTime() - 86400000 * 1),
          exitTime: new Date(now.getTime() - 86400000 * 1 + 3600000),
          entryPrice: 1.2740,
          exitPrice: 1.2690,
          stopLoss: 1.2770,
          takeProfit: 1.2680,
          lotSize: 1.0,
          profitLossAmount: 550.0,
          status: 'CLOSED',
          result: 'WIN',
          session: 'NEW_YORK',
          notesBefore: 'NY session fair value gap fill after CPI volatility sweep.',
        },
        {
          tradingAccountId: account1.id,
          pair: 'XAUUSD',
          direction: 'BUY',
          entryTime: new Date(now.getTime() - 3600000 * 4),
          exitTime: new Date(now.getTime() - 3600000 * 2),
          entryPrice: 2350.0,
          exitPrice: 2345.0,
          stopLoss: 2345.0,
          takeProfit: 2365.0,
          lotSize: 0.5,
          profitLossAmount: -250.0,
          status: 'CLOSED',
          result: 'LOSS',
          session: 'LONDON',
          notesBefore: 'Stopped out at breakeven SL buffer. Price reversed before liquidity target.',
        },
      ],
    });

    console.log('✅ Successfully seeded 4 Trading Accounts & Sample Trades!');
    console.log(`
📊 Seeded Accounts:
------------------------------------------------
1. Personal Live FX (IC Markets)     [$11,450.00]
2. FTMO $100K Challenge Phase 1     [$106,250.00]
3. FundedNext $50K Express           [$52,180.00]
4. Crypto & Indices Backtest Demo    [$27,800.00]
------------------------------------------------
    `);
  } catch (error) {
    console.error('❌ Error seeding trading accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAccounts();
