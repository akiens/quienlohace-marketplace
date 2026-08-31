/**
 * URL pública del sitio, en un solo lugar.
 *
 * Se toma de la variable `APP_URL` de wrangler.jsonc, así pasar del dominio
 * de pruebas (`*.workers.dev`) al definitivo es cambiar una línea de
 * configuración y no tocar el código.
 *
 * Vive fuera de `infrastructure/` a propósito: la usan `sitemap.ts` y
 * `robots.ts`, que se evalúan también durante el build, cuando todavía no hay
 * bindings de Cloudflare disponibles.
 */
const FALLBACK = "https://quienlohace-marketplace.akiens-dev.workers.dev";

export function siteUrl(): string {
  // `process.env` queda poblado con las `vars` del Worker en tiempo de
  // ejecución; en build cae al valor por defecto.
  const configured = process.env.APP_URL?.trim();
  return (configured || FALLBACK).replace(/\/$/, "");
}
