import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProviderGrid } from "@/components/provider-grid";
import { Icon } from "@/components/ui";
import { CATEGORIES, getCategoryBySlug } from "@/data/categories";
import { listBySubcategory } from "@/application/providers";

type Params = { categoria: string; subcategoria: string };

export function generateStaticParams(): Params[] {
  return CATEGORIES.flatMap((category) =>
    category.subcategories.map((sub) => ({
      categoria: category.slug,
      subcategoria: sub.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { categoria, subcategoria } = await params;
  const category = getCategoryBySlug(categoria);
  const sub = category?.subcategories.find((s) => s.slug === subcategoria);
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
  const category = getCategoryBySlug(categoria);
  const subcategory = category?.subcategories.find(
    (s) => s.slug === subcategoria,
  );
  if (!category || !subcategory) notFound();

  const providers = await listBySubcategory(subcategory.id);

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: category.short, href: `/categorias/${category.slug}` },
          { label: subcategory.name },
        ]}
      />

      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-brand-900">
          <Icon name={category.icon} className="text-[24px] text-accent" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink sm:text-[28px]">
            {subcategory.name}
          </h1>
          <p className="text-[14.5px] text-ink-soft">
            {providers.length}{" "}
            {providers.length === 1 ? "profesional" : "profesionales"} en{" "}
            {category.short}
          </p>
        </div>
      </header>

      <nav aria-label="Otras subcategorías" className="flex flex-wrap gap-2">
        {category.subcategories.map((sub) => {
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

      <ProviderGrid
        providers={providers}
        showAd
        emptyTitle={`Todavía no hay profesionales en ${subcategory.name}`}
        emptyBody={
          <>
            Probá con la categoría completa{" "}
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
