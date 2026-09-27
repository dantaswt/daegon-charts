const retryAt = new Map<string, number>();

/** Bound external requests and respect rate limits without replacing live data. */
export async function externalFetch(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const host = new URL(url).hostname;
  if ((retryAt.get(host) ?? 0) > Date.now()) throw new Error(`Service temporarily rate limited: ${host}`);
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  if (response.status === 429 || (host === "itunes.apple.com" && response.status === 403)) {
    const retryAfter = response.headers.get("retry-after");
    const seconds = Number(retryAfter);
    const delay = retryAfter && Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : 60_000;
    retryAt.set(host, Date.now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60_000));
  }
  return response;
}
