import { getCloudflareContext } from "@opennextjs/cloudflare";

import { runAnalyticsMaintenance } from "@/infrastructure/analytics-maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let expected: string | undefined;
  try {
    expected = (getCloudflareContext().env as CloudflareEnv & { ANALYTICS_JOB_TOKEN?: string }).ANALYTICS_JOB_TOKEN;
  } catch {}
  if (!expected) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${expected}`) return Response.json({ ok: false }, { status: 404 });
  try {
    return Response.json({ ok: true, ...(await runAnalyticsMaintenance()) });
  } catch (error) {
    console.error("analytics maintenance failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ ok: false, error: "maintenance_failed" }, { status: 500 });
  }
}
