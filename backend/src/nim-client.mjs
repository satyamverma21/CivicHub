import OpenAI from "openai";

const clientCache = new Map();

function getClient({ apiKey, baseURL, timeoutMs }) {
  const cacheKey = `${baseURL}|${apiKey}|${timeoutMs}`;
  if (clientCache.has(cacheKey)) return clientCache.get(cacheKey);

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: timeoutMs
  });
  clientCache.set(cacheKey, client);
  return client;
}

export async function createNimChatCompletion({
  apiKey,
  baseURL,
  model,
  fallbackModels = [],
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  topP = 0.7,
  maxTokens = 1024,
  timeoutMs = 30000
}) {
  const uniqueModels = [];
  for (const candidate of [model, ...fallbackModels]) {
    const normalized = String(candidate || "").trim();
    if (!normalized || uniqueModels.includes(normalized)) continue;
    uniqueModels.push(normalized);
  }

  const openai = getClient({ apiKey, baseURL, timeoutMs });
  let lastError = null;

  for (const modelName of uniqueModels) {
    try {
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false
      });

      return {
        text: String(completion?.choices?.[0]?.message?.content || ""),
        model: modelName
      };
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      if (status === 403 || status === 404) {
        continue;
      }
      const providerMessage = String(
        error?.error?.message ||
        error?.message ||
        "Unknown NVIDIA NIM error"
      );
      const typedError = new Error(`NIM request failed${status ? ` (${status})` : ""}: ${providerMessage}`);
      typedError.statusCode = status || 502;
      throw typedError;
    }
  }

  const status = Number(lastError?.status || 0);
  const providerMessage = String(
    lastError?.error?.message ||
    lastError?.message ||
    "Unknown NVIDIA NIM error"
  );
  const typedError = new Error(
    `NIM access denied (${status || 403}). Check NIM_API_KEY and enabled model access. Tried models: ${uniqueModels.join(", ")}. Provider message: ${providerMessage}`
  );
  typedError.statusCode = status || 403;
  throw typedError;
}
