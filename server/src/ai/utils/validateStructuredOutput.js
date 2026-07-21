const { z } = require('zod');

const validateStructuredOutput = async (provider, systemPrompt, userPrompt, schema, repairAttempts = 1, useVision = false) => {
  let attempt = 0;
  let lastError = null;
  let lastContent = null;

  while (attempt <= repairAttempts) {
    try {
      const response = await provider.generateStructuredJSON(systemPrompt, userPrompt, useVision);
      lastContent = response;

      // Ensure content exists
      if (!response.content) {
        throw new Error('Empty response content from AI provider');
      }

      // Parse and validate with Zod
      const parsedObj = JSON.parse(response.content);
      const validatedData = schema.parse(parsedObj);

      return {
        success: true,
        data: validatedData,
        rawResponse: response.content,
        usage: response.usage,
        model: response.model,
        provider: response.provider,
      };

    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt <= repairAttempts) {
        // Formulate a repair prompt
        userPrompt = userPrompt + `\n\nThere was an error validating your previous JSON response against the required schema. Error details: ${error.message}. Please correct your response and provide valid JSON ONLY.`;
      }
    }
  }

  return {
    success: false,
    error: lastError.message,
    partialContent: lastContent?.content,
  };
};

module.exports = {
  validateStructuredOutput,
};
