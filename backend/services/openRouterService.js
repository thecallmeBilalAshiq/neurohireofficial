const dotenv = require('dotenv');

dotenv.config();

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

let openrouterClient = null;
let clientPromise = null;

function isLlmAvailable() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function getOpenRouterClient() {
  if (openrouterClient) return openrouterClient;
  if (!clientPromise) {
    clientPromise = (async () => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        console.warn('Warning: OPENROUTER_API_KEY not set. LLM functionality will not work.');
        return null;
      }
      const { OpenRouter } = await import('@openrouter/sdk');
      openrouterClient = new OpenRouter({ apiKey });
      return openrouterClient;
    })();
  }
  return clientPromise;
}

function extractTextFromOutput(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  const getStr = (v) => (typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : ''));
  if (output.content) return getStr(output.content);
  if (output.text) return getStr(output.text);
  if (output.result) return getStr(output.result);
  if (output.data) return getStr(output.data);
  if (output.message && output.message.content) return getStr(output.message.content);
  if (output.message) return getStr(output.message);
  if (Array.isArray(output)) {
    return output
      .map((item) => (typeof item === 'string' ? item : (item?.content ?? item?.text ?? JSON.stringify(item))))
      .join('\n');
  }
  return JSON.stringify(output);
}

/**
 * Run an OpenRouter chat completion (streaming, accumulated).
 * Returns a Bytez-compatible shape: { error, output }.
 */
async function runLlmInternal(modelName, messages, maxTokens) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OpenRouter LLM request timed out')), 45000)
  );

  const requestPromise = (async () => {
    const client = await getOpenRouterClient();
    if (!client) {
      return { error: new Error('LLM model not initialized'), output: null };
    }

    const chatRequest = {
      model: modelName,
      messages,
      stream: true,
    };
    if (maxTokens != null && maxTokens > 0) {
      chatRequest.max_tokens = maxTokens;
    }

    const stream = await client.chat.send({ chatRequest });

    let output = '';
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        output += content;
      }
    }

    return { error: null, output };
  })();

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[OpenRouter] Model ${modelName} error:`, error.message || error);
    // Return a clean error object without request/auth details
    return { error: new Error(error.message || 'LLM request failed'), output: null };
  }
}

/**
 * Run an OpenRouter chat completion (streaming, accumulated).
 * Returns a Bytez-compatible shape: { error, output }.
 * Automatically retries with fallback model on failure/timeout.
 */
async function runLlm(messages, maxTokens) {
  let result = await runLlmInternal(OPENROUTER_MODEL, messages, maxTokens);

  if (result.error) {
    const fallbackModel = OPENROUTER_MODEL === 'google/gemma-2-9b-it:free'
      ? 'meta-llama/llama-3-8b-instruct:free'
      : 'google/gemma-2-9b-it:free';

    console.warn(`[OpenRouter] Primary model ${OPENROUTER_MODEL} failed. Retrying with fallback: ${fallbackModel}`);
    result = await runLlmInternal(fallbackModel, messages, maxTokens);
  }

  return result;
}

const LLM_UNAVAILABLE_MSG =
  'LLM service not available. Please ensure @openrouter/sdk is installed and OPENROUTER_API_KEY is set.';

module.exports = {
  OPENROUTER_MODEL,
  LLM_UNAVAILABLE_MSG,
  isLlmAvailable,
  runLlm,
  extractTextFromOutput,
};
