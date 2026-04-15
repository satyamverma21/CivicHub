function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(task, options = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await task();
    } catch (error) {
      lastError = error;
      if (i === retries) {
        break;
      }
      const delay = baseDelayMs * 2 ** i;
      // eslint-disable-next-line no-await-in-loop
      await wait(delay);
    }
  }

  throw lastError || new Error("Request failed.");
}

export function withTimeout(promise, timeoutMs = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timed out.")), timeoutMs))
  ]);
}