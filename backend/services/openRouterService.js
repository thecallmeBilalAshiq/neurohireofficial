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
async function runLlm(messages, maxTokens) {
  try {
    const client = await getOpenRouterClient();
    if (!client) {
      return { error: new Error('LLM model not initialized'), output: null };
    }

    const chatRequest = {
      model: OPENROUTER_MODEL,
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
  } catch (error) {
    console.error('OpenRouter LLM error:', error);
    return { error, output: null };
  }
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
