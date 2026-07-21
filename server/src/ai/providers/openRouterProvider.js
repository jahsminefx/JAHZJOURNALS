const OpenAI = require('openai');

const createOpenRouterProvider = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
      'X-Title': 'JAHZJOURNALS AI Coach',
    },
    timeout: 45000,
  });

  const textModel = process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.1-8b-instruct';
  const visionModel = process.env.OPENROUTER_VISION_MODEL || 'openai/gpt-4o-mini';

  return {
    generateStructuredJSON: async (systemPrompt, userPrompt, useVision = false) => {
      const model = useVision ? visionModel : textModel;
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1500,
          temperature: 0.2
        });

        const content = response.choices[0]?.message?.content;
        return {
          content,
          model,
          provider: 'openrouter',
          usage: response.usage
        };
      } catch (error) {
        throw new Error(`OpenRouter completion failed: ${error.message}`);
      }
    },
    generateChatCompletion: async (messages, tools = []) => {
      try {
        const payload = {
          model: textModel,
          messages,
          temperature: 0.1
        };
        if (tools && tools.length > 0) {
          payload.tools = tools;
        }

        const response = await client.chat.completions.create(payload);

        let u = undefined;
        if (response.usage) u = response.usage;

        return {
          message: response.choices[0]?.message,
          model: textModel,
          provider: 'openrouter',
          usage: u
        };
      } catch (error) {
        throw new Error(`OpenRouter chat completion failed: ${error.message}`);
      }
    }
  };
};

module.exports = {
  createOpenRouterProvider,
};
