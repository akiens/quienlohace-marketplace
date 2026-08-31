import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  // El entorno de pruebas en *.workers.dev no debe indexarse: competiría con
  // el dominio definitivo por el mismo contenido.
  const isPreview = base.includes(".workers.dev");

  if (isPreview) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El acceso a cuentas no aporta nada a la indexación.
      disallow: ["/entrar"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
