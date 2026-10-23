const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  handleChatTradeCapture,
  handleScreenshotTradeCapture,
  handleConfirmSave,
} = require('../src/controllers/aiTradeCaptureController');
const { OUTCOMES, EVIDENCE_STATUS, EVIDENCE_SOURCES } = require('../src/services/tradeClassificationService');

describe('Unified AI Chat Trade Capture Controller Suite', () => {
  let testUser;
  let testAccountUsd;
  let testAccountEur;

  before(async () => {
    testUser = await prisma.user.create({
      data: {
        name: 'Unified Chat Tester',
        email: `unified_tester_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
      },
    });

    testAccountUsd = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'Personal Alpha USD',
        currency: 'USD',
        startingBalance: 10000.0,
        currentBalance: 10000.0,
      },
    });

    testAccountEur = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'FTMO Challenge EUR',
        currency: 'EUR',
        startingBalance: 50000.0,
        currentBalance: 50000.0,
      },
    });
  });

  after(async () => {
    await prisma.tradeScreenshot.deleteMany({
      where: { trade: { tradingAccountId: { in: [testAccountUsd.id, testAccountEur.id] } } },
    });
    await prisma.trade.deleteMany({
      where: { tradingAccountId: { in: [testAccountUsd.id, testAccountEur.id] } },
    });
    await prisma.tradingAccount.deleteMany({
      where: { id: { in: [testAccountUsd.id, testAccountEur.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });
    await prisma.$disconnect();
  });

  const createMockRes = () => {
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonBody = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getBody: () => jsonBody,
    };
    return res;
  };

  it('1. Rejects request when neither text message nor screenshot is provided', async () => {
    const req = {
      user: { id: testUser.id },
      body: { message: '   ' },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 400);
    assert.ok(res.getBody().message.includes('provide trade details'));
  });

  it('2. Text-only capture: Parses natural language trade description into interactive draft card', async () => {
    const mockExtraction = {
      instrument: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.08200,
      exitPrice: 1.08650,
      stopLoss: 1.08000,
      takeProfit: 1.08900,
      volume: 1.0,
      grossProfit: 450.0,
      commission: -7.0,
      swap: 0.0,
      fees: 0.0,
      accountName: 'Personal Alpha USD',
      notes: 'London session retest of 15m order block',
      breakEvenMentioned: false,
      status: 'CLOSED',
      assistantReply: 'I parsed your EURUSD BUY trade with +$443.00 net gain.',
      missingFields: [],
      confidenceScore: 0.95,
    };

    const req = {
      user: { id: testUser.id },
      body: {
        message: 'I bought 1 lot of EURUSD at 1.08200, closed at 1.08650 on Personal Alpha USD.',
        mockExtraction,
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.isBatch, false);
    assert.equal(body.trade.pair, 'EURUSD');
    assert.equal(body.trade.direction, 'BUY');
    assert.equal(body.trade.lotSize, 1.0);
    assert.equal(body.trade.tradingAccountId, testAccountUsd.id);
    assert.equal(body.trade.grossProfit, 450.0);
    assert.equal(body.trade.commission, -7.0);
    // Net profit deterministically calculated: 450 - 7 = 443
    assert.equal(body.trade.profitLossAmount, 443.0);
    assert.equal(body.trade.result, OUTCOMES.WIN);
  });

  it('3. Text follow-up message updates existing draft without losing confirmed fields', async () => {
    const currentDraft = {
      pair: 'GBPUSD',
      direction: 'SELL',
      entryPrice: 1.30500,
      exitPrice: 1.29800,
      lotSize: 2.0,
      tradingAccountId: testAccountUsd.id,
      grossProfit: 1400.0,
      commission: -14.0,
      profitLossAmount: 1386.0,
      status: 'CLOSED',
    };

    // Trader adds: "Actually, set stop loss to 1.30800 and add note that it was an FOMC fade"
    const mockExtraction = {
      instrument: null,
      direction: null,
      entryPrice: null,
      exitPrice: null,
      stopLoss: 1.30800,
      takeProfit: null,
      volume: null,
      grossProfit: null,
      notes: 'FOMC fade after liquidity sweep',
      status: 'CLOSED',
      assistantReply: 'Updated stop loss to 1.30800 and saved your note.',
      missingFields: [],
      confidenceScore: 0.95,
    };

    const req = {
      user: { id: testUser.id },
      body: {
        message: 'Actually set stop loss to 1.30800 and note that it was an FOMC fade',
        currentDraft,
        mockExtraction,
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.trade.pair, 'GBPUSD'); // Retained from currentDraft
    assert.equal(body.trade.direction, 'SELL'); // Retained
    assert.equal(body.trade.entryPrice, 1.30500); // Retained
    assert.equal(body.trade.stopLoss, 1.30800); // Updated by follow-up
    assert.equal(body.trade.notes, 'FOMC fade after liquidity sweep'); // Updated
    assert.equal(body.trade.profitLossAmount, 1386.0); // Retained
  });

  it('4. Multimodal capture: Single screenshot with text specifying BE trailing stop', async () => {
    const mockExtraction = {
      screenshotType: 'BROKER_RECEIPT',
      instrument: { value: 'BTCUSD', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 0.22, status: 'CONFIRMED' },
      entryPrice: { value: 82351.75, status: 'CONFIRMED' },
      exitPrice: { value: 82361.97, status: 'CONFIRMED' },
      stopLoss: { value: 82370.08, status: 'CONFIRMED' },
      takeProfit: { value: 83174.00, status: 'CONFIRMED' },
      grossProfit: { value: 2.25, status: 'CONFIRMED' },
      commission: { value: -0.66, status: 'CONFIRMED' },
      swap: { value: 0.00, status: 'CONFIRMED' },
      fees: { value: 0.00, status: 'CONFIRMED' },
      ticket: { value: '43789391', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-19T08:30:00Z', status: 'CONFIRMED' },
      exitTime: { value: '2026-10-19T14:45:00Z', status: 'CONFIRMED' },
      accountCurrency: { value: 'USD', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: true,
        rationale: 'Stop loss was placed above entry to protect at break-even',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'MT_TRAILING_STOP',
      },
      confidenceScore: 0.98,
    };

    const mockFile = {
      buffer: Buffer.from('fake image data'),
      mimetype: 'image/png',
      originalname: 'btcusd_trade.png',
      size: 1024,
    };

    const req = {
      user: { id: testUser.id },
      body: {
        message: 'I trailed my stop to break even on this trade on Personal Alpha USD',
        mockExtraction,
      },
      files: [mockFile],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.isBatch, false);
    assert.equal(body.trade.pair, 'BTCUSD');
    assert.equal(body.trade.direction, 'BUY');
    assert.equal(body.trade.lotSize, 0.22);
    // User message established BE protection
    assert.equal(body.trade.breakEvenActivated, true);
    assert.equal(body.trade.breakEvenEvidenceStatus, EVIDENCE_STATUS.USER_CONFIRMED);
    assert.equal(body.trade.breakEvenEvidenceSource, EVIDENCE_SOURCES.USER_MANUAL);
    // Deterministic net profit: 2.25 - 0.66 = 1.59
    assert.equal(body.trade.profitLossAmount, 1.59);
    assert.equal(body.trade.result, OUTCOMES.WIN); // Net +$1.59 with 0.00 default tolerance
    // Assistant reply explicitly acknowledged BE protection
    assert.ok(body.assistantReply.includes('break-even'));
    // Image URL populated
    assert.ok(body.trade.imageUrl);
  });

  it('5. Multi-screenshot batch capture returns isBatch: true and list of candidate cards', async () => {
    const mockExtraction1 = {
      screenshotType: 'BROKER_RECEIPT',
      instrument: { value: 'XAUUSD', status: 'CONFIRMED' },
      direction: { value: 'SELL', status: 'CONFIRMED' },
      volume: { value: 0.5, status: 'CONFIRMED' },
      entryPrice: { value: 2750.0, status: 'CONFIRMED' },
      exitPrice: { value: 2735.0, status: 'CONFIRMED' },
      grossProfit: { value: 750.0, status: 'CONFIRMED' },
      commission: { value: -5.0, status: 'CONFIRMED' },
      ticket: { value: '112233', status: 'CONFIRMED' },
      confidenceScore: 0.95,
      breakEvenCandidate: { isBreakEvenCandidate: false },
    };

    const mockExtraction2 = {
      screenshotType: 'BROKER_RECEIPT',
      instrument: { value: 'US30', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 1.0, status: 'CONFIRMED' },
      entryPrice: { value: 43500.0, status: 'CONFIRMED' },
      exitPrice: { value: 43620.0, status: 'CONFIRMED' },
      grossProfit: { value: 120.0, status: 'CONFIRMED' },
      commission: { value: -2.0, status: 'CONFIRMED' },
      ticket: { value: '445566', status: 'CONFIRMED' },
      confidenceScore: 0.90,
      breakEvenCandidate: { isBreakEvenCandidate: false },
    };

    const files = [
      {
        buffer: Buffer.from('fake img 1'),
        mimetype: 'image/png',
        originalname: 'gold.png',
        size: 500,
        mockExtraction: mockExtraction1,
      },
      {
        buffer: Buffer.from('fake img 2'),
        mimetype: 'image/png',
        originalname: 'us30.png',
        size: 600,
        mockExtraction: mockExtraction2,
      },
    ];

    const req = {
      user: { id: testUser.id },
      body: {
        message: 'Batch upload from today session',
      },
      files,
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.isBatch, true);
    assert.equal(body.totalUploaded, 2);
    assert.equal(body.extractedCount, 2);
    assert.equal(body.batch.length, 2);

    const gold = body.batch[0].candidateTrade;
    assert.equal(gold.pair, 'XAUUSD');
    assert.equal(gold.profitLossAmount, 745.0); // 750 - 5

    const us30 = body.batch[1].candidateTrade;
    assert.equal(us30.pair, 'US30');
    assert.equal(us30.profitLossAmount, 118.0); // 120 - 2
  });

  it('6. Backwards compatibility: handleScreenshotTradeCapture delegates to handleChatTradeCapture seamlessly', async () => {
    const mockExtraction = {
      screenshotType: 'BROKER_RECEIPT',
      instrument: { value: 'USDJPY', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 0.1, status: 'CONFIRMED' },
      entryPrice: { value: 152.00, status: 'CONFIRMED' },
      exitPrice: { value: 152.80, status: 'CONFIRMED' },
      grossProfit: { value: 52.40, status: 'CONFIRMED' },
      commission: { value: -1.00, status: 'CONFIRMED' },
      ticket: { value: '998811', status: 'CONFIRMED' },
      confidenceScore: 0.90,
      breakEvenCandidate: { isBreakEvenCandidate: false },
    };

    const mockFile = {
      buffer: Buffer.from('fake image'),
      mimetype: 'image/png',
      originalname: 'usdjpy.png',
      size: 800,
    };

    const req = {
      user: { id: testUser.id },
      body: { mockExtraction },
      files: [mockFile],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleScreenshotTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.trade.pair, 'USDJPY');
    assert.equal(body.trade.profitLossAmount, 51.40);
  });

  it('7. Preserves deterministic calculations when candidate trade is confirmed and saved', async () => {
    const candidateTrade = {
      tradingAccountId: testAccountUsd.id,
      pair: 'GBPUSD',
      direction: 'SELL',
      entryPrice: 1.30000,
      exitPrice: 1.29500,
      lotSize: 1.0,
      grossProfit: 500.0,
      commission: -7.0,
      swap: -1.5,
      fees: 0.0,
      profitLossAmount: 491.50,
      status: 'CLOSED',
      breakEvenActivated: false,
    };

    const req = {
      user: { id: testUser.id },
      headers: { 'x-idempotency-key': `chat_save_${Date.now()}` },
      body: { trade: candidateTrade },
    };
    const res = createMockRes();

    await handleConfirmSave(req, res);

    assert.equal(res.getStatusCode(), 201);
    const body = res.getBody();
    assert.equal(body.savedCount, 1);
    assert.equal(body.savedTrades[0].pair, 'GBPUSD');
    assert.equal(body.savedTrades[0].profitLossAmount, 491.50);
    assert.equal(body.savedTrades[0].result, OUTCOMES.WIN);
  });
});
