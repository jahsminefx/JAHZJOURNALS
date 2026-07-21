const { test } = require('node:test');
const assert = require('node:assert');
const { sanitizeAiInput, redactSensitiveData } = require('./sanitizeAiInput');

test('sanitizeAiInput strips emails and urls', () => {
  const input = "Contact me at user@example.com or visit https://mywebsite.com/secret";
  const sanitized = sanitizeAiInput(input);
  assert.strictEqual(sanitized, "Contact me at [REDACTED_EMAIL] or visit [URL]");
});

test('redactSensitiveData removes user identity', () => {
  const trade = {
    id: 'trade-1',
    tradingAccount: {
      userId: 'user-123',
      name: 'My Account'
    },
    notesBefore: 'I am taking this setup. Read about it here: http://example.com'
  };

  const safeTrade = redactSensitiveData(trade);
  assert.strictEqual(safeTrade.tradingAccount.userId, undefined);
  assert.strictEqual(safeTrade.notesBefore, 'I am taking this setup. Read about it here: [URL]');
});
