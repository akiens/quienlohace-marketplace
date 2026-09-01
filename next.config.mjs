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

  async redirects() {
    return [
      {
        // El registro vivía en `/entrar?perfil=1`. Se mantiene la redirección
        // para no romper enlaces ya compartidos; es permanente porque la ruta
        // nueva es la definitiva.
        //
        // Next arrastra los query params al destino, así que el enlace viejo
        // termina en `/registro?perfil=1`. El parámetro sobra pero es inocuo:
        // `/registro` ya no lo lee, y la página se sirve igual.
        source: "/entrar",
        has: [{ type: "query", key: "perfil", value: "1" }],
        destination: "/registro",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
