import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileGrid } from "@/components/profile-grid";
import { Icon } from "@/components/ui";
import {
  SERVICE_SECTORS,
  getServiceSectorBySlug,
  listSpecialties,
} from "@/data/taxonomy";
import { listByServiceSector } from "@/application/profiles";

type Params = { categoria: string };

/**
 * Las rutas se pregeneran —salen del catálogo y son la base del SEO— pero el
 * contenido se resuelve por pedido: los perfiles viven en D1, y el binding no
 * existe durante el build. `force-dynamic` es lo que separa una cosa de la
 * otra: `generateStaticParams` sigue enumerando las URLs y cada visita lee la
 * base.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams(): Params[] {
  return SERVICE_SECTORS.map((sector) => ({ categoria: sector.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const category = getServiceSectorBySlug(categoria);
  if (!category) return {};

  return {
    title: `${category.name} en Uruguay`,
    description: `Encontrá ${category.name.toLowerCase()} en todo Uruguay. Compará perfiles, opiniones y zonas de trabajo, y contactá directo.`,
    alternates: { canonical: `/categorias/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { categoria } = await params;
  const category = getServiceSectorBySlug(categoria);
  if (!category) notFound();

  const profiles = await listByServiceSector(category.id);
  const specialties = listSpecialties(category.id);

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-brand-900">
            <Icon name={category.icon} className="text-[24px] text-accent" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink sm:text-[28px]">
              {category.name}
            </h1>
            <p className="text-[14.5px] text-ink-soft">
              {profiles.length}{" "}
              {profiles.length === 1 ? "profesional" : "profesionales"} ·{" "}
              {specialties.length} especialidades
            </p>
          </div>
        </div>
      </header>

      {/* Navegación interna: enlaza el rubro con sus especialidades para indexación. */}
      <nav aria-label="Especialidades" className="flex flex-wrap gap-2">
        {specialties.map((sub) => (
          <Link
            key={sub.id}
            href={`/categorias/${category.slug}/${sub.slug}`}
            className="rounded-full border border-line-strong bg-white px-3.5 py-2 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-100 hover:text-brand-800"
          >
            {sub.name}
          </Link>
        ))}
      </nav>

      <ProfileGrid
        profiles={profiles}
        showAd
        emptyTitle={`Todavía no hay profesionales en ${category.short}`}
        emptyBody="Estamos sumando perfiles en este rubro. Si ofrecés este servicio, publicá tu perfil gratis y aparecé entre los primeros."
      />
    </div>
  );
}
