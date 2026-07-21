const { createOpenAiProvider } = require('./openAiProvider');
const { createOpenRouterProvider } = require('./openRouterProvider');

const getProvider = () => {
  const providerType = process.env.AI_PROVIDER || 'openrouter';
  
  return {
    generateStructuredJSON: async (systemPrompt, userPrompt, useVision = false) => {
      if (providerType.toLowerCase() === 'openai') {
        const p = createOpenAiProvider();
        return p.generateStructuredJSON(systemPrompt, userPrompt, useVision);
      }
      const p = createOpenRouterProvider();
      return p.generateStructuredJSON(systemPrompt, userPrompt, useVision);
    },
    generateChatCompletion: async (messages, tools) => {
      if (providerType.toLowerCase() === 'openai') {
        const p = createOpenAiProvider();
        return p.generateChatCompletion(messages, tools);
      }
      const p = createOpenRouterProvider();
      return p.generateChatCompletion(messages, tools);
    }
  };
};

module.exports = {
  getProvider,
};
