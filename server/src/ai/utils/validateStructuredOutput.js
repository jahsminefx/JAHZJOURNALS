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

  // If not directly parseable, try to find the outermost JSON structure
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (innerErr) {
        // Fall back
      }
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = cleaned.slice(firstBracket, lastBracket + 1).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (innerErr) {
        // Fall back
      }
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
        // Formulate a repair prompt (support both string prompts and multimodal array prompts)
        const repairMsg = `\n\nThere was an error validating your previous JSON response against the required schema. Error details: ${error.message}. Please correct your response and provide valid JSON ONLY matching the requested structure.`;
        if (typeof userPrompt === 'string') {
          userPrompt += repairMsg;
        } else if (Array.isArray(userPrompt)) {
          const textItem = userPrompt.find((item) => item && item.type === 'text');
          if (textItem) {
            textItem.text += repairMsg;
          } else {
            userPrompt.push({ type: 'text', text: repairMsg });
          }
        }
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
