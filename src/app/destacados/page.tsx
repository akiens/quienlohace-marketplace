import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProfileGrid } from "@/components/profile-grid";
import { listFeatured } from "@/application/profiles";

/**
 * Los destacados salen de la base y rotan (BR-006): se resuelve por pedido.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profesionales destacados",
  description:
    "Profesionales y empresas con mayor visibilidad dentro de QuienLoHace.",
};

export default async function FeaturedPage() {
  const providers = await listFeatured();

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Destacados" }]} />

      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink sm:text-[28px]">
          Profesionales destacados
        </h1>
        {/* Los resultados pagos se identifican siempre, nunca se camuflan. */}
        <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
          Estos perfiles contrataron mayor visibilidad dentro de QuienLoHace.
          Aparecen identificados con el distintivo <strong>Destacado</strong> en
          todo el sitio.
        </p>
      </header>

      <ProfileGrid profiles={providers} showAd />
    </div>
  );
}
