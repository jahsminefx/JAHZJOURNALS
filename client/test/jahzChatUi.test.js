import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_CHAT_GREETINGS,
  createInitialMessagesByMode,
  buildChatRequestMessages,
  extractActiveAnalyticsContext,
  mapChatError,
} from '../src/utils/jahzChatHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

describe('JAHZ AI Chat UI Helpers & Component Contracts', () => {
  it('1. createInitialMessagesByMode creates isolated ANALYTICS and SUPPORT histories', () => {
    const initial = createInitialMessagesByMode();
    assert.equal(Array.isArray(initial.ANALYTICS), true);
    assert.equal(Array.isArray(initial.SUPPORT), true);
    assert.equal(initial.ANALYTICS[0].isGreeting, true);
    assert.equal(initial.SUPPORT[0].isGreeting, true);
    assert.ok(initial.SUPPORT[0].content.includes('JAHZJOURNALS'));
    assert.notEqual(initial.ANALYTICS[0].content, initial.SUPPORT[0].content);

    // Ensure mutating one initial array does not affect future initial states
    initial.ANALYTICS.push({ role: 'user', content: 'Test' });
    const fresh = createInitialMessagesByMode();
    assert.equal(fresh.ANALYTICS.length, 1);
    assert.equal(fresh.ANALYTICS[0].content, DEFAULT_CHAT_GREETINGS.ANALYTICS.content);
  });

  it('2. buildChatRequestMessages strips greetings, errors, blanks, and caps at 20 messages', () => {
    const history = [
      { ...DEFAULT_CHAT_GREETINGS.ANALYTICS },
      { role: 'user', content: '  How many XAUUSD trades?  ' },
      { role: 'assistant', content: 'Something went wrong', isError: true },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'You took 35 XAUUSD trades.' },
    ];
    const clean = buildChatRequestMessages(history);
    assert.deepEqual(clean, [
      { role: 'user', content: 'How many XAUUSD trades?' },
      { role: 'assistant', content: 'You took 35 XAUUSD trades.' },
    ]);

    // Check retry scenario: user turn followed by error card strips cleanly to [user]
    const retryClean = buildChatRequestMessages([
      { ...DEFAULT_CHAT_GREETINGS.SUPPORT },
      { role: 'user', content: 'What is JAHZJOURNALS?' },
      { role: 'assistant', isError: true, content: 'Timed out' },
    ]);
    assert.deepEqual(retryClean, [{ role: 'user', content: 'What is JAHZJOURNALS?' }]);

    // Check 20-message bound
    const many = Array.from({ length: 28 }, (_, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: `msg-${idx}`,
    }));
    const bounded = buildChatRequestMessages(many);
    assert.equal(bounded.length, 20);
    assert.equal(bounded[0].content, 'msg-8');
    assert.equal(bounded[19].content, 'msg-27');
  });

  it('3. extractActiveAnalyticsContext parses accountId, startDate, endDate when present', () => {
    assert.equal(extractActiveAnalyticsContext(''), undefined);
    assert.equal(extractActiveAnalyticsContext('tab=overview'), undefined);

    const ctx = extractActiveAnalyticsContext(
      '?accountId=%20acc_123%20&startDate=2026-01-01&endDate=2026-01-31'
    );
    assert.deepEqual(ctx, {
      accountId: 'acc_123',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const params = new URLSearchParams('accountId=acc_999');
    assert.deepEqual(extractActiveAnalyticsContext(params), { accountId: 'acc_999' });
  });

  it('4. mapChatError returns safe, actionable states and never leaks raw 500 strings', () => {
    assert.deepEqual(mapChatError({ name: 'CanceledError' }), { cancelled: true });
    assert.deepEqual(mapChatError({ code: 'ERR_CANCELED' }), { cancelled: true });

    const err401 = mapChatError({ response: { status: 401, data: {} } });
    assert.equal(err401.code, 'SESSION_EXPIRED');
    assert.equal(err401.retryable, false);
    assert.equal(err401.actionPath, '/login');

    const errSettings = mapChatError({
      response: { status: 403, data: { error: 'AI_DISABLED_IN_SETTINGS' } },
    });
    assert.equal(errSettings.code, 'AI_DISABLED_IN_SETTINGS');
    assert.equal(errSettings.retryable, false);
    assert.equal(errSettings.actionPath, '/ai/usage');

    const errTradeDisabled = mapChatError({
      response: { status: 403, data: { error: 'TRADE_ANALYSIS_DISABLED' } },
    });
    assert.equal(errTradeDisabled.code, 'TRADE_ANALYSIS_DISABLED');
    assert.equal(errTradeDisabled.actionPath, '/ai/usage');

    const errQuota = mapChatError({
      response: { status: 403, data: { error: 'PLAN_LIMIT_REACHED', message: 'Quota reached' } },
    });
    assert.equal(errQuota.code, 'PLAN_LIMIT_REACHED');
    assert.equal(errQuota.actionPath, '/pricing');
    assert.equal(errQuota.retryable, false);

    const errAcc = mapChatError({
      response: { status: 403, data: { error: 'INVALID_ACCOUNT_CONTEXT' } },
    });
    assert.equal(errAcc.code, 'INVALID_ACCOUNT_CONTEXT');
    assert.equal(errAcc.actionPath, '/accounts');

    const err429 = mapChatError({ response: { status: 429, data: {} } });
    assert.equal(err429.code, 'RATE_LIMITED');
    assert.equal(err429.retryable, true);

    const err504 = mapChatError({
      response: { status: 504, data: { error: 'AI_TIMEOUT' } },
    });
    assert.equal(err504.code, 'AI_TIMEOUT');
    assert.equal(err504.retryable, true);
    assert.ok(err504.message.includes('No journal data was changed'));

    const err503Analytics = mapChatError({
      response: { status: 503, data: { error: 'ANALYTICS_UNAVAILABLE' } },
    });
    assert.equal(err503Analytics.code, 'ANALYTICS_UNAVAILABLE');
    assert.equal(err503Analytics.retryable, true);

    const err503Support = mapChatError(
      { response: { status: 503, data: { error: 'AI_PROVIDER_UNAVAILABLE' } } },
      'SUPPORT'
    );
    assert.equal(err503Support.code, 'AI_PROVIDER_UNAVAILABLE');
    assert.ok(err503Support.message.includes('Support Chat'));

    const errNetwork = mapChatError({ message: 'Network Error' });
    assert.equal(errNetwork.code, 'NETWORK_ERROR');
    assert.equal(errNetwork.retryable, true);

    const err500 = mapChatError({
      response: {
        status: 500,
        data: { error: 'INTERNAL_ERROR', message: 'Invalid prisma.aiRequest.create() P2022 sql trace' },
      },
    });
    assert.equal(err500.code, 'INTERNAL_ERROR');
    assert.equal(err500.retryable, true);
    assert.equal(err500.message.includes('P2022'), false);
    assert.equal(err500.message.includes('prisma'), false);
  });

  it('5. UnifiedAssistantWidget & AskJahzPage preserve concurrency safety, mode isolation, and remove legacy error string', async () => {
    const widgetSrc = await readFile(
      path.join(clientRoot, 'src/components/UnifiedAssistantWidget.jsx'),
      'utf8'
    );
    const pageSrc = await readFile(
      path.join(clientRoot, 'src/pages/ai/AskJahzPage.jsx'),
      'utf8'
    );

    for (const [name, src] of [
      ['UnifiedAssistantWidget.jsx', widgetSrc],
      ['AskJahzPage.jsx', pageSrc],
    ]) {
      assert.ok(src.includes('messagesByMode'), `${name} should keep separate mode histories`);
      assert.ok(src.includes('inFlightRef'), `${name} should enforce synchronous in-flight guard`);
      assert.ok(src.includes('AbortController'), `${name} should use AbortController`);
      assert.ok(src.includes('requestSeqRef'), `${name} should guard stale responses with sequence tracking`);
      assert.ok(src.includes('buildChatRequestMessages'), `${name} should strip greetings/errors before POST`);
      assert.ok(src.includes("targetMode === 'ANALYTICS' ? extractActiveAnalyticsContext"), `${name} should pass context only in ANALYTICS mode`);
      assert.ok(src.includes('mapChatError'), `${name} should use mapChatError`);
      assert.ok(
        src.includes('Retry') && src.includes('retryable'),
        `${name} should support Retry action`
      );
      assert.equal(
        src.includes('Connection issue. Could not reach analytics.'),
        false,
        `${name} must not contain legacy generic connection error`
      );
      assert.equal(src.includes('window.alert('), false, `${name} must not call window.alert`);
      assert.equal(src.includes('window.confirm('), false, `${name} must not call window.confirm`);
      assert.equal(src.includes('window.prompt('), false, `${name} must not call window.prompt`);
    }

    // Verify AskJahzPage preserves Log Trade with AI entry point
    assert.ok(pageSrc.includes('AiTradeCaptureModal'));
    assert.ok(pageSrc.includes('Log Trade with AI'));
  });
});
