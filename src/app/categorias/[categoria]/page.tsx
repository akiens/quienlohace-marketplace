import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProviderGrid } from "@/components/provider-grid";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Icon } from "@/components/ui";
import { CATEGORIES, getCategoryBySlug } from "@/data/categories";
import { listByCategory } from "@/application/providers";

type Params = { categoria: string };

/** Las páginas de categoría se pregeneran: son la base del SEO del marketplace. */
export function generateStaticParams(): Params[] {
  return CATEGORIES.map((category) => ({ categoria: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const category = getCategoryBySlug(categoria);
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
  const category = getCategoryBySlug(categoria);
  if (!category) notFound();

  const providers = await listByCategory(category.id);

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: category.short },
        ]}
      />

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
              {category.providerCount} profesionales ·{" "}
              {category.subcategories.length} subcategorías
            </p>
          </div>
        </div>
      </header>

      {/* Navegación interna: enlaza categoría con subcategorías para indexación. */}
      <nav aria-label="Subcategorías" className="flex flex-wrap gap-2">
        {category.subcategories.map((sub) => (
          <Link
            key={sub.id}
            href={`/categorias/${category.slug}/${sub.slug}`}
            className="rounded-full border border-line-strong bg-white px-3.5 py-2 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-100 hover:text-brand-800"
          >
            {sub.name}
          </Link>
        ))}
      </nav>

      <ProviderGrid
        providers={providers}
        showAd
        emptyTitle={`Todavía no hay profesionales en ${category.short}`}
        emptyBody="Estamos sumando perfiles en este rubro. Si ofrecés este servicio, publicá tu perfil gratis y aparecé entre los primeros."
      />
    </div>
  );
}
