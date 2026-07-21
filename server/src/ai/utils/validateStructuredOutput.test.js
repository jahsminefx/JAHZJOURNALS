const { test } = require('node:test');
const assert = require('node:assert');
const { z } = require('zod');
const { validateStructuredOutput } = require('./validateStructuredOutput');

test('validateStructuredOutput handles valid JSON matching schema', async () => {
  const mockProvider = {
    generateStructuredJSON: async () => ({
      content: '{"summary": "great", "score": 100}',
      model: 'test-model',
      provider: 'test-provider',
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    })
  };

  const schema = z.object({
    summary: z.string(),
    score: z.number()
  });

  const result = await validateStructuredOutput(mockProvider, 'system', 'user', schema, 1);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.summary, 'great');
  assert.strictEqual(result.data.score, 100);
});

test('validateStructuredOutput retries on invalid JSON matching schema', async () => {
  let callCount = 0;
  const mockProvider = {
    generateStructuredJSON: async () => {
      callCount++;
      if (callCount === 1) {
        // Return valid JSON but missing required score property
        return { content: '{"summary": "great"}' };
      }
      return { content: '{"summary": "fixed", "score": 90}' };
    }
  };

  const schema = z.object({
    summary: z.string(),
    score: z.number()
  });

  const result = await validateStructuredOutput(mockProvider, 'system', 'user', schema, 1);
  assert.strictEqual(callCount, 2);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.score, 90);
});

test('validateStructuredOutput fails permanently after exceeding retries', async () => {
  const mockProvider = {
    generateStructuredJSON: async () => ({
      content: '{"random": "value"}'
    })
  };

  const schema = z.object({
    score: z.number()
  });

  const result = await validateStructuredOutput(mockProvider, 'system', 'user', schema, 1); // 1 repair attempt
  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});
