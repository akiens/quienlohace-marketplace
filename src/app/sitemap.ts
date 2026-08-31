import type { MetadataRoute } from "next";

import { CATEGORIES } from "@/data/categories";
import { listProviderSlugs } from "@/application/providers";
import { siteUrl } from "@/lib/site-url";

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
    { path: "/como-funciona", priority: 0.6 },
    { path: "/sobre-nosotros", priority: 0.5 },
    { path: "/contacto", priority: 0.5 },
    { path: "/faq", priority: 0.5 },
  ].map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    priority: route.priority,
  }));

  const categoryRoutes = CATEGORIES.flatMap((category) => [
    {
      url: `${BASE_URL}/categorias/${category.slug}`,
      lastModified: new Date(),
      priority: 0.8,
    },
    ...category.subcategories.map((sub) => ({
      url: `${BASE_URL}/categorias/${category.slug}/${sub.slug}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
  ]);

  const providerRoutes = (await listProviderSlugs()).map((slug) => ({
    url: `${BASE_URL}/profesionales/${slug}`,
    lastModified: new Date(),
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...providerRoutes];
}
