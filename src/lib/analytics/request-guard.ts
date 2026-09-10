import "server-only";

import { getAppUrl } from "@/infrastructure/cloudflare";

export function hasAllowedAnalyticsOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const allowed = new Set([new URL(request.url).origin, new URL(getAppUrl()).origin]);
    return allowed.has(origin);
  } catch {
    return false;
  }
}
