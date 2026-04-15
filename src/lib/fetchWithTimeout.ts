/**
 * fetch() wrapper that aborts after `timeoutMs` milliseconds.
 * Throws a localised Turkish error on timeout.
 *
 * Usage:
 *   const res = await fetchWithTimeout(url, options, 10_000);
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Servis yanıt vermedi (${Math.round(timeoutMs / 1000)} sn). Lütfen tekrar deneyin.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps an Anthropic SDK call with a hard AbortController timeout.
 *
 * Usage:
 *   const response = await withClaudeTimeout(
 *     (signal) => anthropic.messages.create({...}, { signal }),
 *     30_000
 *   );
 */
export async function withClaudeTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = 30_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Yapay zeka servisi yanıt vermedi (${Math.round(timeoutMs / 1000)} sn). Lütfen tekrar deneyin.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
