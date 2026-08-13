const { z } = require('zod');

const cleanJsonContent = (raw) => {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (cleaned.includes('```')) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
  }
  return cleaned;
};

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

      // Clean markdown fences if model included them
      const jsonString = cleanJsonContent(response.content);

      // Parse and validate with Zod
      const parsedObj = JSON.parse(jsonString);
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
        userPrompt = typeof userPrompt === 'string'
          ? userPrompt + `\n\nThere was an error validating your previous JSON response against the required schema. Error details: ${error.message}. Please correct your response and provide valid JSON ONLY.`
          : userPrompt;
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
  cleanJsonContent
};
