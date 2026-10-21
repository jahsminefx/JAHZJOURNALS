const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING REALISTIC TRADES FOR MENTOR ACCOUNT ---');

  // 1. Locate mentor
  const mentor = await prisma.user.findUnique({
    where: { email: 'mentor@jahzjournals.com' },
  });

  if (!mentor) {
    console.error('Error: mentor@jahzjournals.com not found. Please run seedDemoMentor.js first.');
    process.exit(1);
  }

  console.log(`Found mentor: ${mentor.name} (${mentor.email}) - User ID: ${mentor.id}`);

  // 2. Create or find mentor strategies
  let stratOrderFlow = await prisma.strategy.findFirst({
    where: { userId: mentor.id, name: 'ICT Order Flow & Liquidity' },
  });
  if (!stratOrderFlow) {
    stratOrderFlow = await prisma.strategy.create({
      data: {
        userId: mentor.id,
        name: 'ICT Order Flow & Liquidity',
        description: 'HTF directional bias with 15m/5m liquidity sweeps and Fair Value Gap mitigations.',
        style: 'Day Trading',
        market: 'Forex & Commodities',
        defaultRiskPercent: 1.0,
      },
    });
  }

  let stratLondonOpen = await prisma.strategy.findFirst({
    where: { userId: mentor.id, name: 'London Open Expansion' },
  });
  if (!stratLondonOpen) {
    stratLondonOpen = await prisma.strategy.create({
      data: {
        userId: mentor.id,
        name: 'London Open Expansion',
        description: 'Asian range breakout/liquidity raid targeting London session high/low expansions.',
        style: 'Intraday',
        market: 'Forex Majors',
        defaultRiskPercent: 1.0,
      },
    });
  }

  // 3. Create or find Mentor Trading Account 1: Apex Pro 100K Fund
  let primaryAccount = await prisma.tradingAccount.findFirst({
    where: { userId: mentor.id, name: 'Apex Pro 100K Fund' },
  });

  if (!primaryAccount) {
    primaryAccount = await prisma.tradingAccount.create({
      data: {
        userId: mentor.id,
        name: 'Apex Pro 100K Fund',
        accountCategory: 'PROP_FIRM',
        brokerName: 'Apex Trader / IC Markets',
        startingBalance: 100000,
        currentBalance: 100000,
        currency: 'USD',
        riskPerTradePercent: 1.0,
        isPropFirmAccount: true,
        propFirmName: 'Apex Trader Funding',
        profitTarget: 6000,
        maxDrawdown: 5000,
        dailyDrawdown: 2500,
        isSharedWithMentor: true,
      },
    });
  }

  // 4. Create or find Mentor Trading Account 2: Private Swing Portfolio
  let swingAccount = await prisma.tradingAccount.findFirst({
    where: { userId: mentor.id, name: 'Private Swing Portfolio' },
  });

  if (!swingAccount) {
    swingAccount = await prisma.tradingAccount.create({
      data: {
        userId: mentor.id,
        name: 'Private Swing Portfolio',
        accountCategory: 'REGULAR',
        brokerName: 'OANDA Global',
        startingBalance: 50000,
        currentBalance: 50000,
        currency: 'USD',
        riskPerTradePercent: 1.5,
        isSharedWithMentor: true,
      },
    });
  }

  // Clear any existing dummy trades for this account to keep fresh clean data
  const deletedOld = await prisma.trade.deleteMany({
    where: { tradingAccountId: { in: [primaryAccount.id, swingAccount.id] } },
  });
  console.log(`Cleared ${deletedOld.count} prior trades for mentor accounts.`);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;

  // Realistic trade records for Primary Account (100K)
  const primaryTrades = [
    {
      pair: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.0825,
      stopLoss: 1.0805,
      takeProfit: 1.0885,
      exitPrice: 1.0885,
      lotSize: 5.0,
      riskAmount: 1000,
      rewardAmount: 3000,
      profitLossAmount: 3000,
      profitLossPercent: 3.0,
      riskRewardRatio: 3.0,
      pips: 60.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'LONDON',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '4H',
      entryTimeframe: '15m',
      htfBias: 'BULLISH',
      entryReason: 'London open liquidity run below Asian low followed by rapid 5m displacement and 15m bullish FVG tap.',
      notesBefore: 'Risking 1.0% ($1,000) targeting liquidity resting at previous week high (1.0885).',
      notesAfter: 'Flawless expansion through London & NY overlap. Target fully hit without drawdown.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A_PLUS',
      entryTime: new Date(now - 14 * day + 8 * hour),
      exitTime: new Date(now - 14 * day + 13 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 8, note: 'Waited patiently for Asian session lows to get swept.' },
        { stage: 'DURING_TRADE', emotion: 'CONFIDENT', intensity: 9, note: 'Orderflow reacted cleanly off the FVG.' },
        { stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: 9, note: 'Took full profits strictly at planned resistance.' },
      ],
    },
    {
      pair: 'GBPUSD',
      direction: 'SELL',
      entryPrice: 1.2980,
      stopLoss: 1.3005,
      takeProfit: 1.2905,
      exitPrice: 1.2905,
      lotSize: 4.0,
      riskAmount: 1000,
      rewardAmount: 3000,
      profitLossAmount: 3000,
      profitLossPercent: 3.0,
      riskRewardRatio: 3.0,
      pips: 75.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'LONDON',
      strategyId: stratLondonOpen.id,
      higherTimeframe: 'Daily',
      entryTimeframe: '5m',
      htfBias: 'BEARISH',
      entryReason: 'Judas swing above Asian High into Daily bearish order block, followed by market structure shift.',
      notesBefore: 'Risk set to 1%. Clean breaker block confluence.',
      notesAfter: 'Full target hit during London afternoon session.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A_PLUS',
      entryTime: new Date(now - 12 * day + 7 * hour + 30 * 60 * 1000),
      exitTime: new Date(now - 12 * day + 12 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CONFIDENT', intensity: 8 },
        { stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: 9 },
      ],
    },
    {
      pair: 'XAUUSD',
      direction: 'BUY',
      entryPrice: 2638.50,
      stopLoss: 2630.00,
      takeProfit: 2664.00,
      exitPrice: 2664.00,
      lotSize: 1.2,
      riskAmount: 1020,
      rewardAmount: 3060,
      profitLossAmount: 3060,
      profitLossPercent: 3.06,
      riskRewardRatio: 3.0,
      pips: 255.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'NEW_YORK',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '4H',
      entryTimeframe: '15m',
      htfBias: 'BULLISH',
      entryReason: 'Gold discount array retest during New York session open after morning CPI consolidation.',
      notesBefore: 'Key institutional re-accumulation level on 4H chart.',
      notesAfter: 'Strong trend extension into the NY close.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A',
      entryTime: new Date(now - 10 * day + 13 * hour + 45 * 60 * 1000),
      exitTime: new Date(now - 10 * day + 18 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 7 },
        { stage: 'DURING_TRADE', emotion: 'CONFIDENT', intensity: 8 },
      ],
    },
    {
      pair: 'NAS100',
      direction: 'BUY',
      entryPrice: 20280,
      stopLoss: 20230,
      takeProfit: 20430,
      exitPrice: 20230,
      lotSize: 2.0,
      riskAmount: 1000,
      rewardAmount: 3000,
      profitLossAmount: -1000,
      profitLossPercent: -1.0,
      riskRewardRatio: 3.0,
      pips: -50.0,
      result: 'LOSS',
      status: 'CLOSED',
      session: 'NEW_YORK',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '1H',
      entryTimeframe: '5m',
      htfBias: 'BULLISH',
      entryReason: 'Index 9:30 AM open displacement attempt out of opening range.',
      notesBefore: 'Aggressive opening gap fill expectation.',
      notesAfter: 'Stopped out cleanly at pre-defined 1R. Fed speaker remarks induced sudden midday sell-off.',
      followedPlan: true,
      isAPlusSetup: false,
      grade: 'B',
      entryTime: new Date(now - 8 * day + 14 * hour),
      exitTime: new Date(now - 8 * day + 14 * hour + 40 * 60 * 1000),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'ANXIOUS', intensity: 5, note: 'Fast volatility at market bell.' },
        { stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: 8, note: 'Accepted the -1R loss without revenge trading.' },
      ],
    },
    {
      pair: 'USDJPY',
      direction: 'SELL',
      entryPrice: 154.20,
      stopLoss: 154.55,
      takeProfit: 153.15,
      exitPrice: 154.20,
      lotSize: 2.8,
      riskAmount: 980,
      rewardAmount: 2940,
      profitLossAmount: 0,
      profitLossPercent: 0,
      riskRewardRatio: 3.0,
      pips: 0.0,
      result: 'BREAKEVEN',
      status: 'CLOSED',
      session: 'ASIAN',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '4H',
      entryTimeframe: '15m',
      htfBias: 'BEARISH',
      entryReason: 'Asian session range rejection from 4H bearish rejection block.',
      notesBefore: 'Trailing stop to breakeven once 1.5R reached.',
      notesAfter: 'Moved SL to entry after initial 40 pip drop. Tokyo fixing retraced and took me out at BE.',
      followedPlan: true,
      isAPlusSetup: false,
      grade: 'B',
      entryTime: new Date(now - 6 * day + 1 * hour),
      exitTime: new Date(now - 6 * day + 5 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 7 },
        { stage: 'AFTER_TRADE', emotion: 'CALM', intensity: 8 },
      ],
    },
    {
      pair: 'EURUSD',
      direction: 'SELL',
      entryPrice: 1.0890,
      stopLoss: 1.0910,
      takeProfit: 1.0830,
      exitPrice: 1.0830,
      lotSize: 5.0,
      riskAmount: 1000,
      rewardAmount: 3000,
      profitLossAmount: 3000,
      profitLossPercent: 3.0,
      riskRewardRatio: 3.0,
      pips: 60.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'LONDON_NEW_YORK_OVERLAP',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '4H',
      entryTimeframe: '5m',
      htfBias: 'BEARISH',
      entryReason: 'Clean double top sweep during US PPI news spike followed by immediate bearish displacement.',
      notesBefore: 'Standard 1% risk targeting discount liquidity pool.',
      notesAfter: 'Clean run down. Target hit precisely at 1.0830.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A_PLUS',
      entryTime: new Date(now - 5 * day + 13 * hour),
      exitTime: new Date(now - 5 * day + 16 * hour + 15 * 60 * 1000),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 8 },
        { stage: 'AFTER_TRADE', emotion: 'CONFIDENT', intensity: 9 },
      ],
    },
    {
      pair: 'XAUUSD',
      direction: 'BUY',
      entryPrice: 2682.00,
      stopLoss: 2673.50,
      takeProfit: 2707.50,
      exitPrice: 2707.50,
      lotSize: 1.2,
      riskAmount: 1020,
      rewardAmount: 3060,
      profitLossAmount: 3060,
      profitLossPercent: 3.06,
      riskRewardRatio: 3.0,
      pips: 255.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'LONDON',
      strategyId: stratOrderFlow.id,
      higherTimeframe: 'Daily',
      entryTimeframe: '15m',
      htfBias: 'BULLISH',
      entryReason: 'All-time highs continuation model. Asian consolidation sweep into 1H bullish orderblock.',
      notesBefore: 'High probability momentum trend continuation.',
      notesAfter: 'Target hit within 2.5 hours of London session.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A_PLUS',
      entryTime: new Date(now - 3 * day + 8 * hour),
      exitTime: new Date(now - 3 * day + 11 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CONFIDENT', intensity: 9 },
        { stage: 'AFTER_TRADE', emotion: 'CONFIDENT', intensity: 10 },
      ],
    },
    {
      pair: 'GBPUSD',
      direction: 'BUY',
      entryPrice: 1.2840,
      stopLoss: 1.2815,
      takeProfit: 1.2915,
      exitPrice: 1.2815,
      lotSize: 4.0,
      riskAmount: 1000,
      rewardAmount: 3000,
      profitLossAmount: -1000,
      profitLossPercent: -1.0,
      riskRewardRatio: 3.0,
      pips: -25.0,
      result: 'LOSS',
      status: 'CLOSED',
      session: 'LONDON',
      strategyId: stratLondonOpen.id,
      higherTimeframe: '4H',
      entryTimeframe: '5m',
      htfBias: 'BULLISH',
      entryReason: 'London open breakout above key consolidation range.',
      notesBefore: 'Entered on 5m close above range resistance.',
      notesAfter: 'Turned out to be a fakeout/turtle soup pattern. Stopped out at exact -1R.',
      followedPlan: true,
      isAPlusSetup: false,
      grade: 'B',
      entryTime: new Date(now - 2 * day + 8 * hour + 10 * 60 * 1000),
      exitTime: new Date(now - 2 * day + 9 * hour),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 7 },
        { stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: 8, note: 'Rule followed, loss kept small.' },
      ],
    },
    {
      pair: 'XAUUSD',
      direction: 'BUY',
      entryPrice: 2715.00,
      stopLoss: 2706.00,
      takeProfit: 2742.00,
      exitPrice: null,
      lotSize: 1.0,
      riskAmount: 900,
      rewardAmount: 2700,
      profitLossAmount: 1450,
      profitLossPercent: 1.45,
      riskRewardRatio: 3.0,
      pips: 145.0,
      result: 'OPEN',
      status: 'ACTIVE',
      session: 'NEW_YORK',
      strategyId: stratOrderFlow.id,
      higherTimeframe: '4H',
      entryTimeframe: '15m',
      htfBias: 'BULLISH',
      entryReason: 'Current active swing position on Gold after retest of previous ATH breakout zone.',
      notesBefore: 'Position running in +1.6R profit currently. Stop loss trailed to breakeven.',
      notesAfter: '',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A',
      entryTime: new Date(now - 14 * hour),
      exitTime: null,
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CONFIDENT', intensity: 9 },
        { stage: 'DURING_TRADE', emotion: 'CALM', intensity: 9 },
      ],
    },
  ];

  // Swing Account Trades (50K)
  const swingTrades = [
    {
      pair: 'AUDUSD',
      direction: 'SELL',
      entryPrice: 0.6650,
      stopLoss: 0.6700,
      takeProfit: 0.6500,
      exitPrice: 0.6500,
      lotSize: 1.5,
      riskAmount: 750,
      rewardAmount: 2250,
      profitLossAmount: 2250,
      profitLossPercent: 4.5,
      riskRewardRatio: 3.0,
      pips: 150.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'OTHER',
      strategyId: stratOrderFlow.id,
      higherTimeframe: 'Weekly',
      entryTimeframe: '4H',
      htfBias: 'BEARISH',
      entryReason: 'Weekly supply block mitigation with clear bearish order flow confirmation.',
      notesBefore: 'Multi-day macro swing trade targeting 0.6500 psychological handle.',
      notesAfter: 'Full target achieved over 5 trading sessions.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A_PLUS',
      entryTime: new Date(now - 11 * day),
      exitTime: new Date(now - 6 * day),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CONFIDENT', intensity: 8 },
        { stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: 9 },
      ],
    },
    {
      pair: 'USDJPY',
      direction: 'BUY',
      entryPrice: 152.80,
      stopLoss: 152.00,
      takeProfit: 155.20,
      exitPrice: 155.20,
      lotSize: 1.0,
      riskAmount: 800,
      rewardAmount: 2400,
      profitLossAmount: 2400,
      profitLossPercent: 4.8,
      riskRewardRatio: 3.0,
      pips: 240.0,
      result: 'WIN',
      status: 'CLOSED',
      session: 'OTHER',
      strategyId: stratOrderFlow.id,
      higherTimeframe: 'Daily',
      entryTimeframe: '4H',
      htfBias: 'BULLISH',
      entryReason: 'Interest rate divergence play following BOJ policy hold.',
      notesBefore: 'Macro swing trade.',
      notesAfter: 'Clean rally into 155.20 objective.',
      followedPlan: true,
      isAPlusSetup: true,
      grade: 'A',
      entryTime: new Date(now - 7 * day),
      exitTime: new Date(now - 2 * day),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 8 },
        { stage: 'AFTER_TRADE', emotion: 'CONFIDENT', intensity: 9 },
      ],
    },
    {
      pair: 'EURUSD',
      direction: 'SELL',
      entryPrice: 1.0860,
      stopLoss: 1.0910,
      takeProfit: 1.0710,
      exitPrice: 1.0860,
      lotSize: 1.5,
      riskAmount: 750,
      rewardAmount: 2250,
      profitLossAmount: 0,
      profitLossPercent: 0,
      riskRewardRatio: 3.0,
      pips: 0.0,
      result: 'BREAKEVEN',
      status: 'CLOSED',
      session: 'OTHER',
      strategyId: stratOrderFlow.id,
      higherTimeframe: 'Daily',
      entryTimeframe: '4H',
      htfBias: 'BEARISH',
      entryReason: 'Daily breaker block retest.',
      notesBefore: 'Swing short expectation.',
      notesAfter: 'Price stalled ahead of ECB press conference. Protected stop at breakeven.',
      followedPlan: true,
      isAPlusSetup: false,
      grade: 'B',
      entryTime: new Date(now - 4 * day),
      exitTime: new Date(now - 1 * day),
      emotions: [
        { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 7 },
        { stage: 'AFTER_TRADE', emotion: 'CALM', intensity: 7 },
      ],
    },
  ];

  // Helper to insert trade and emotions
  async function insertTradesForAccount(tradesList, accountId) {
    let closedPnlTotal = 0;
    for (const item of tradesList) {
      const { emotions, ...tradeFields } = item;
      const created = await prisma.trade.create({
        data: {
          tradingAccountId: accountId,
          ...tradeFields,
        },
      });

      if (emotions && emotions.length > 0) {
        for (const emo of emotions) {
          await prisma.emotionLog.create({
            data: {
              tradeId: created.id,
              stage: emo.stage,
              emotion: emo.emotion,
              intensity: emo.intensity,
              note: emo.note || null,
            },
          });
        }
      }

      if (tradeFields.status === 'CLOSED' && tradeFields.profitLossAmount) {
        closedPnlTotal += tradeFields.profitLossAmount;
      }
    }
    return closedPnlTotal;
  }

  const primaryClosedPnl = await insertTradesForAccount(primaryTrades, primaryAccount.id);
  const swingClosedPnl = await insertTradesForAccount(swingTrades, swingAccount.id);

  // 5. Update Account Current Balances
  const updatedPrimary = await prisma.tradingAccount.update({
    where: { id: primaryAccount.id },
    data: {
      currentBalance: primaryAccount.startingBalance + primaryClosedPnl,
    },
  });

  const updatedSwing = await prisma.tradingAccount.update({
    where: { id: swingAccount.id },
    data: {
      currentBalance: swingAccount.startingBalance + swingClosedPnl,
    },
  });

  console.log(`\nAccount 1: ${updatedPrimary.name}`);
  console.log(`  Starting: $${updatedPrimary.startingBalance.toLocaleString()} | Current: $${updatedPrimary.currentBalance.toLocaleString()} (Net PnL: +$${primaryClosedPnl.toLocaleString()})`);
  console.log(`  Seeded ${primaryTrades.length} trades (including 1 open active trade)`);

  console.log(`\nAccount 2: ${updatedSwing.name}`);
  console.log(`  Starting: $${updatedSwing.startingBalance.toLocaleString()} | Current: $${updatedSwing.currentBalance.toLocaleString()} (Net PnL: +$${swingClosedPnl.toLocaleString()})`);
  console.log(`  Seeded ${swingTrades.length} swing trades`);

  console.log('\n--- SUCCESS: MENTOR TRADES SEEDED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
