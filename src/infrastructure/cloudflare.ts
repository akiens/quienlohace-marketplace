import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Único punto donde se tocan los bindings de Cloudflare. Todo lo demás
 * trabaja contra los puertos de `src/domain/ports.ts`.
 *
 * `server-only` hace que el build falle si alguien importa esto desde un
 * componente de cliente: el navegador nunca debe acercarse a D1.
 */

/**
 * `CloudflareEnv` lo genera wrangler desde wrangler.jsonc
 * (`npm run cf-typegen`): los bindings quedan tipados desde la configuración
 * real, sin una lista paralela que se desactualice.
 */
function env(): CloudflareEnv {
  return getCloudflareContext().env;
}

export function getDb(): D1Database {
  const db = env().DB;
  if (!db) {
    throw new Error(
      "Falta el binding D1 `DB`. Revisá wrangler.jsonc y que estés corriendo con el runtime de Workers.",
    );
  }
  return db;
}

export function getAnalyticsDb(): D1Database {
  const db = (env() as CloudflareEnv & { ANALYTICS_DB?: D1Database }).ANALYTICS_DB;
  if (!db) throw new Error("Falta el binding D1 `ANALYTICS_DB`.");
  return db;
}

export function getAnalyticsRawBucket(): R2Bucket {
  const bucket = (env() as CloudflareEnv & { ANALYTICS_RAW?: R2Bucket }).ANALYTICS_RAW;
  if (!bucket) throw new Error("Falta el binding R2 privado `ANALYTICS_RAW`.");
  return bucket;
}

export function analyticsEnabled(): boolean {
  try {
    return String((env() as CloudflareEnv & { ANALYTICS_ENABLED?: string }).ANALYTICS_ENABLED) !== "false";
  } catch {
    return false;
  }
}

export function getAnalyticsSessionSecret(): string | null {
  let boundValue: string | undefined;
  try {
    boundValue = (env() as CloudflareEnv & { ANALYTICS_SESSION_SECRET?: string }).ANALYTICS_SESSION_SECRET;
  } catch {}
  const value = boundValue ?? process.env.ANALYTICS_SESSION_SECRET;
  return value && new TextEncoder().encode(value).byteLength >= 32 ? value : null;
}

/** Mantiene telemetría fuera del tiempo crítico de una respuesta de negocio. */
export function runInBackground(task: Promise<unknown>): void {
  const guarded = task.catch((error) => {
    console.error("background task failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  });
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    void guarded;
  }
}

export function getMediaBucket(): R2Bucket {
  const bucket = env().MEDIA;
  if (!bucket) {
    throw new Error("Falta el binding R2 `MEDIA`. Revisá wrangler.jsonc.");
  }
  return bucket;
}

export function getAppUrl(): string {
  return env().APP_URL ?? "http://localhost:3000";
}

/**
 * Indica si hay runtime de Cloudflare disponible. Permite que el sitio siga
 * funcionando con los datos de ejemplo mientras la base no esté configurada.
 */
export function hasCloudflareRuntime(): boolean {
  try {
    return Boolean(getCloudflareContext().env);
  } catch {
    return false;
  }
}
