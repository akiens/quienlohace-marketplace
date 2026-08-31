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
