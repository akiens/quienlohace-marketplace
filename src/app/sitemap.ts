import type { MetadataRoute } from "next";

import { SERVICE_SECTORS, listSpecialties } from "@/data/taxonomy";
import { listProfileSlugs } from "@/application/profiles";
import { siteUrl } from "@/lib/site-url";
import { listPublicServiceCardPaths } from "@/application/service-cards";
import { serviceCardHref } from "@/lib/service-cards";

/**
 * Los perfiles publicados salen de la base, que no existe durante el build.
 */
export const dynamic = "force-dynamic";

const BASE_URL = siteUrl();

/**
 * Sólo se indexan páginas con contenido real: no generamos URLs vacías
 * únicamente para inflar el número de rutas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/buscar", priority: 0.8 },
    { path: "/destacados", priority: 0.7 },
    // Precios y límites: contenido que se busca, y es la puerta de entrada
    // de los proveedores que evalúan publicar.
    { path: "/planes", priority: 0.7 },
    { path: "/como-funciona", priority: 0.6 },
    { path: "/sobre-nosotros", priority: 0.5 },
    { path: "/contacto", priority: 0.5 },
    { path: "/faq", priority: 0.5 },
  ].map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    priority: route.priority,
  }));

  const categoryRoutes = SERVICE_SECTORS.flatMap((sector) => [
    {
      url: `${BASE_URL}/categorias/${sector.slug}`,
      lastModified: new Date(),
      priority: 0.8,
    },
    ...listSpecialties(sector.id).map((specialty) => ({
      url: `${BASE_URL}/categorias/${sector.slug}/${specialty.slug}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
  ]);

  const [profileSlugs, serviceCards] = await Promise.all([
    listProfileSlugs(),
    listPublicServiceCardPaths(),
  ]);
  const providerRoutes = profileSlugs.map((slug) => ({
    url: `${BASE_URL}/profesionales/${slug}`,
    lastModified: new Date(),
    priority: 0.6,
  }));

  const serviceRoutes = serviceCards.map((card) => ({
    url: `${BASE_URL}${serviceCardHref(card)}`,
    lastModified: new Date(),
    priority: 0.65,
  }));

  return [...staticRoutes, ...categoryRoutes, ...providerRoutes, ...serviceRoutes];
}
