import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReviewForm } from "@/components/review-form";
import { ReviewList } from "@/components/review-list";
import {
  Chip,
  FeaturedBadge,
  Icon,
  RatingLine,
  SECONDARY_SURFACE,
  VerifiedBadge,
} from "@/components/ui";
import { getCategory, getSubcategory } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import {
  findProviderBySlug,
  findSimilarProviders,
  findVisibleProviderBySlug,
  listReviews,
} from "@/application/providers";
import { NotFoundPage } from "@/components/not-found-page";
import { getCurrentUser } from "@/lib/session";
import { phoneHref, whatsappHref } from "@/lib/contact";

type Params = { slug: string };

/**
 * La página depende de quién mira: el dueño ve su perfil aún sin publicar, y
 * cualquier otra persona ve el aviso de que no existe. Una respuesta cacheada
 * y compartida serviría la versión equivocada —incluido un perfil despublicado
 * a quien no debe verlo—, así que se rinde por pedido.
 *
 * Antes era `revalidate = 3600`, que valía cuando la página era igual para
 * todo el mundo.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provider = await findProviderBySlug(slug);

  /*
   * Sólo los publicados aportan metadatos. Uno sin publicar no debería
   * aparecer en buscadores ni en la vista previa de un enlace compartido,
   * aunque su dueño sí pueda verlo.
   */
  if (!provider || (provider.status ?? "active") !== "active") {
    return { title: "Perfil no encontrado", robots: { index: false } };
  }

  return {
    title: `${provider.name} · ${locationLabelById(provider.locationId)}`,
    description: provider.description,
    alternates: { canonical: `/profesionales/${provider.slug}` },
  };
}

export default async function ProviderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  /*
   * Un perfil sin publicar sólo lo ve su dueño, en vista previa. Para
   * cualquier otra persona la respuesta es la misma que ante un nombre que no
   * existe: que esté despublicado no es algo que haya que contar.
   */
  const user = await getCurrentUser();
  const visible = await findVisibleProviderBySlug(slug, user?.id ?? null);

  if (!visible) {
    // El nombre buscado sale de la URL y sirve para sugerir parecidos.
    const suggestions = await findSimilarProviders(slug);
    return (
      <NotFoundPage
        title="No existe un perfil público para un proveedor con este nombre"
        message="Puede que el enlace esté desactualizado, que el nombre esté escrito distinto o que ese perfil todavía no se haya publicado."
        suggestions={suggestions}
      />
    );
  }

  const { provider, isPreview } = visible;

  /*
   * Las imágenes vienen con el perfil, ya filtradas por plan: la consulta
   * pública sólo trae las activas, así que lo que excede el plan no aparece
   * acá aunque siga guardado (RF-053).
   */
  const images = provider.images ?? [];
  const avatar = images.find((image) => image.kind === "avatar") ?? null;
  const cover = images.find((image) => image.kind === "cover") ?? null;
  const gallery = images.filter((image) => image.kind === "gallery");

  const category = getCategory(provider.categoryId);
  const subcategory = getSubcategory(provider.subcategoryId);
  const reviews = await listReviews(provider.id);
  const location = locationLabelById(provider.locationId);

  // Datos estructurados: ayudan a que el perfil se entienda como un negocio local.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider.name,
    description: provider.description,
    telephone: provider.phone,
    areaServed: provider.serviceAreaIds.map((id) => locationLabelById(id)),
    ...(provider.rating !== null && provider.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: provider.rating,
            reviewCount: provider.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {isPreview ? (
        <div className="bg-accent-soft">
          <div className="shell flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-accent-ink">
              <Icon name="visibility_off" className="text-[18px]" />
              Vista previa: así se verá tu perfil cuando lo publiques.
            </span>
            <span className="text-[13.5px] text-accent-ink/80">
              Todavía no es visible para nadie más.
            </span>
            <Link
              href="/dashboard"
              className="ml-auto text-[13.5px] font-semibold text-accent-ink underline"
            >
              Volver a mi perfil
            </Link>
          </div>
        </div>
      ) : null}

      {/* Portada */}
      {/* z-0 explícito: sin él la portada crea un contexto de apilamiento que
          se dibuja por encima del header sticky y le tapa el logo. */}
      <div className="relative z-0 h-[150px] overflow-hidden bg-card-gradient sm:h-[200px]">
        {cover ? (
          /*
            La imagen que subió el proveedor manda; el degradado con el icono
            del rubro queda como respaldo para los perfiles que todavía no
            cargaron una.

            No pasa por `next/image`: la sirve `/media`, que ya la entrega
            desde R2 con cache inmutable, y el optimizador sólo agregaría un
            salto más sin nada que optimizar.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-hatch" />
            <Icon
              name={provider.icon}
              className="pointer-events-none absolute bottom-[-24px] right-6 text-[180px] leading-none text-white/[.12]"
            />
          </>
        )}
      </div>

      <div className="shell relative z-10 flex flex-col gap-8 pb-12">
        {/* La tarjeta monta sobre la portada: necesita z-index propio, si no
            la portada (que tiene z-0) se dibuja encima y corta el avatar. */}
        <div className="-mt-12 flex flex-col gap-5 rounded-card border border-line bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start gap-4">
            {/* Con foto se muestra la foto; sin ella, las iniciales, que es
                lo que había antes y sigue sirviendo de respaldo. */}
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.url}
                alt={`Foto de ${provider.name}`}
                className="h-[72px] w-[72px] flex-none rounded-[18px] border border-line object-cover"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-[18px] border border-line bg-brand-100 text-[22px] font-extrabold text-brand-800">
                {provider.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {provider.featured ? <FeaturedBadge /> : null}
                {provider.verified ? <VerifiedBadge /> : null}
                <Chip>
                  {provider.kind === "business" ? "Empresa" : "Profesional independiente"}
                </Chip>
              </div>

              <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
                {provider.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <RatingLine
                  rating={provider.rating}
                  reviewCount={provider.reviewCount}
                />
                <span className="flex items-center gap-1.5 text-[14px] text-ink-soft">
                  <Icon name="location_on" className="text-[17px] text-ink-faint" />
                  {location}
                </span>
                {category && subcategory ? (
                  <Link
                    href={`/categorias/${category.slug}/${subcategory.slug}`}
                    className="flex items-center gap-1.5 text-[14px] font-semibold text-brand-800 hover:underline"
                  >
                    <Icon name={category.icon} className="text-[17px]" />
                    {subcategory.name}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <p className="max-w-3xl text-[15px] leading-relaxed text-ink-muted">
            {provider.description}
          </p>

          {/* Contacto directo: sin login, sin intermediarios. */}
          <div className="flex flex-wrap gap-2.5">
            <a
              href={whatsappHref(provider)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center gap-2 rounded-input bg-whatsapp px-5 text-[15px] font-bold text-white transition-colors hover:bg-[#1E8C56]"
            >
              <Icon name="chat" className="text-[19px]" />
              Escribir por WhatsApp
            </a>
            <a
              href={phoneHref(provider)}
              className={`flex h-11 items-center gap-2 rounded-input px-5 text-[15px] font-semibold ${SECONDARY_SURFACE}`}
            >
              <Icon name="call" className="text-[19px] text-brand-800" />
              {provider.phone}
            </a>
          </div>
        </div>

        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            ...(category
              ? [{ label: category.short, href: `/categorias/${category.slug}` }]
              : []),
            { label: provider.name },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <Panel title="Servicios">
              <div className="flex flex-wrap gap-2">
                {provider.services.map((service) => (
                  <Chip key={service} className="text-[13.5px]">
                    {service}
                  </Chip>
                ))}
              </div>
            </Panel>

            {/* La ubicación del profesional es distinta de dónde trabaja. */}
            <Panel title="Zonas donde trabaja">
              <div className="flex flex-wrap gap-2">
                {provider.serviceAreaIds.map((id) => (
                  <Chip key={id} className="text-[13.5px]">
                    {locationLabelById(id)}
                  </Chip>
                ))}
              </div>
            </Panel>

            {/* Sólo con imágenes: un panel vacío diciendo que no hay
                trabajos cargados no le sirve a quien mira. */}
            {gallery.length > 0 ? (
              <Panel title="Trabajos">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((image) => (
                    <div
                      key={image.id}
                      className="aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.alt}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            <Panel title="Opiniones">
              <div className="flex flex-col gap-5">
                <ReviewList reviews={reviews} totalCount={provider.reviewCount} />
                <ReviewForm providerId={provider.id} providerSlug={provider.slug} />
              </div>
            </Panel>
          </div>

          <aside className="flex flex-col gap-6">
            <Panel title="Información">
              <dl className="flex flex-col gap-4">
                <InfoRow icon="schedule" label="Horarios">
                  {provider.schedule}
                </InfoRow>
                <InfoRow icon="location_on" label="Ubicación">
                  {location}
                </InfoRow>
                <InfoRow icon="payments" label="Formas de pago">
                  {provider.paymentMethods.join(" · ")}
                </InfoRow>
              </dl>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-white p-5">
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 text-[19px] text-brand-800" />
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] font-bold uppercase tracking-[.5px] text-ink-faint">
          {label}
        </dt>
        <dd className="text-[14px] leading-relaxed text-ink-muted">{children}</dd>
      </div>
    </div>
  );
}
