const OpenAI = require('openai');

const createOpenAiProvider = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    timeout: 45000,
  });

  const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
  const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

  return {
    generateStructuredJSON: async (systemPrompt, userPrompt, useVision = false) => {
      const model = useVision ? visionModel : textModel;
      try {
        let response;
        try {
          response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1500,
            temperature: 0.2
          });
        } catch (rfError) {
          response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt + '\n\nIMPORTANT: You MUST reply ONLY with valid JSON matching the requested structure.' },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.2
          });
        }

        const content = response.choices[0]?.message?.content;
        return {
          content,
          model,
          provider: 'openai',
          usage: response.usage
        };
      } catch (error) {
        throw new Error(`OpenAI completion failed: ${error.message}`);
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
          payload.tool_choice = 'auto';
        }
        
        const response = await client.chat.completions.create(payload);
        return {
          message: response.choices[0]?.message,
          model: textModel,
          provider: 'openai',
          usage: response.usage
        };
      } catch (error) {
        throw new Error(`OpenAI chat completion failed: ${error.message}`);
      }
    }
  };
};

module.exports = {
  createOpenAiProvider,
};
