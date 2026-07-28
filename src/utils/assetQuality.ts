export type InternetStatus = "checking" | "online" | "offline";

export interface InternetProbeOptions {
  networkOnline: boolean;
  probeUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export interface PreferredModelUrlOptions {
  localUrl: string;
  hdUrl: string | null;
  hdAssetsEnabled: boolean;
  internetStatus: InternetStatus;
}

const DEFAULT_PROBE_TIMEOUT_MS = 4_000;

export async function checkInternetAccess({
  networkOnline,
  probeUrl,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  fetcher = fetch,
}: InternetProbeOptions): Promise<boolean> {
  if (!networkOnline) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetcher(probeUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolvePreferredModelUrl({
  localUrl,
  hdUrl,
  hdAssetsEnabled,
  internetStatus,
}: PreferredModelUrlOptions): string {
  if (internetStatus === "online" && hdAssetsEnabled && hdUrl) {
    return hdUrl;
  }

  return localUrl;
}
