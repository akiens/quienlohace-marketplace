import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Conecta `next dev` con los bindings de Cloudflare (D1, R2, vars) leyendo
 * `wrangler.jsonc` y el estado local de `.wrangler/`.
 *
 * Sin esto, `getCloudflareContext()` no encuentra el entorno y todo lo que
 * toque la base falla en desarrollo: login, panel y opiniones. En `wrangler
 * dev` y en producción el runtime ya provee el contexto, así que esta llamada
 * sólo tiene efecto durante `next dev`.
 */
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
