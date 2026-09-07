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
import { listBySpecialty } from "@/application/profiles";

type Params = { categoria: string; subcategoria: string };

/**
 * Las rutas se pregeneran —salen del catálogo y son la base del SEO— pero el
 * contenido se resuelve por pedido: los perfiles viven en D1, y el binding no
 * existe durante el build. `force-dynamic` es lo que separa una cosa de la
 * otra: `generateStaticParams` sigue enumerando las URLs y cada visita lee la
 * base.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams(): Params[] {
  return SERVICE_SECTORS.flatMap((sector) =>
    listSpecialties(sector.id).map((specialty) => ({
      categoria: sector.slug,
      subcategoria: specialty.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { categoria, subcategoria } = await params;
  const category = getServiceSectorBySlug(categoria);
  const sub = category
    ? listSpecialties(category.id).find((s) => s.slug === subcategoria)
    : undefined;
  if (!category || !sub) return {};

  return {
    title: `${sub.name} en Uruguay`,
    description: `Profesionales y empresas de ${sub.name.toLowerCase()} en Uruguay. Compará perfiles y contactá directo por WhatsApp.`,
    alternates: { canonical: `/categorias/${category.slug}/${sub.slug}` },
  };
}

export default async function SubcategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { categoria, subcategoria } = await params;
  const category = getServiceSectorBySlug(categoria);
  const specialties = category ? listSpecialties(category.id) : [];
  const subcategory = specialties.find((s) => s.slug === subcategoria);
  if (!category || !subcategory) notFound();

  const profiles = await listBySpecialty(subcategory.id);

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-brand-900">
          <Icon name={category.icon} className="text-[24px] text-accent" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink sm:text-[28px]">
            {subcategory.name}
          </h1>
          <p className="text-[14.5px] text-ink-soft">
            {profiles.length}{" "}
            {profiles.length === 1 ? "profesional" : "profesionales"} en{" "}
            {category.short}
          </p>
        </div>
      </header>

      <nav aria-label="Otras especialidades" className="flex flex-wrap gap-2">
        {specialties.map((sub) => {
          const current = sub.id === subcategory.id;
          return (
            <Link
              key={sub.id}
              href={`/categorias/${category.slug}/${sub.slug}`}
              aria-current={current ? "page" : undefined}
              className={`rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
                current
                  ? "border-brand-800 bg-brand-100 text-brand-800"
                  : "border-line-strong bg-white text-ink-muted hover:border-brand-600 hover:bg-brand-100 hover:text-brand-800"
              }`}
            >
              {sub.name}
            </Link>
          );
        })}
      </nav>

      <ProfileGrid
        profiles={profiles}
        showAd
        emptyTitle={`Todavía no hay profesionales en ${subcategory.name}`}
        emptyBody={
          <>
            Probá con el rubro completo{" "}
            <Link
              href={`/categorias/${category.slug}`}
              className="font-semibold text-brand-800 underline underline-offset-2"
            >
              {category.short}
            </Link>
            , o publicá tu perfil si ofrecés este servicio.
          </>
        }
      />
    </div>
  );
}
