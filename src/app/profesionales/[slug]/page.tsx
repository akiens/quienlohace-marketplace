import type { Metadata } from "next";
import Link from "next/link";

import { Banner } from "@/components/banner";
import { ReviewForm } from "@/components/review-form";
import { ReviewList } from "@/components/review-list";
import {
  Chip,
  Icon,
  RatingLine,
  SECONDARY_SURFACE,
  VerifiedBadge,
} from "@/components/ui";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { locationLabelById } from "@/data/locations";
import {
  findProfileBySlug,
  findSimilarProfiles,
  findVisibleProfileBySlug,
  listReviews,
} from "@/application/profiles";
import { NotFoundPage } from "@/components/not-found-page";
import { PAYMENT_METHOD_LABELS, SERVICE_MODE_LABELS } from "@/types";
import { getCurrentUser } from "@/lib/session";
import {
  canShowPhone,
  canUseWhatsapp,
  phoneHref,
  whatsappHref,
} from "@/lib/contact";

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
  const profile = await findProfileBySlug(slug);

  /*
   * Sólo los publicados aportan metadatos. Uno sin publicar no debería
   * aparecer en buscadores ni en la vista previa de un enlace compartido,
   * aunque su dueño sí pueda verlo.
   */
  if (!profile || profile.profileStatus !== "active") {
    return { title: "Perfil no encontrado", robots: { index: false } };
  }

  /*
   * Dónde se lo ubica: el local si lo hay, y si no la primera zona donde
   * trabaja. Un perfil a domicilio no tiene local (BR-015) pero siempre tiene
   * al menos un área (BR-016).
   */
  const where =
    profile.locations.find((item) => item.isPrimary && item.isActive)
      ?.locationId ??
    profile.serviceAreaIds[0] ??
    "uruguay";

  return {
    title: `${profile.name} · ${locationLabelById(where)}`,
    description: profile.description,
    alternates: { canonical: `/profesionales/${profile.slug}` },
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
  const visible = await findVisibleProfileBySlug(slug, user?.id ?? null);

  if (!visible) {
    // El nombre buscado sale de la URL y sirve para sugerir parecidos.
    const suggestions = await findSimilarProfiles(slug);
    return (
      <NotFoundPage
        title="No existe un perfil público para un proveedor con este nombre"
        message="Puede que el enlace esté desactualizado, que el nombre esté escrito distinto o que ese perfil todavía no se haya publicado."
        suggestions={suggestions}
      />
    );
  }

  const { profile, isPreview } = visible;

  /*
   * Las imágenes vienen con el perfil, ya filtradas por plan: la consulta
   * pública sólo trae las activas, así que lo que excede el plan no aparece
   * acá aunque siga guardado (RF-053).
   */
  const images = profile.images;
  const avatar = images.find((image) => image.kind === "avatar") ?? null;
  const cover = images.find((image) => image.kind === "cover") ?? null;
  const gallery = images.filter((image) => image.kind === "gallery");

  /*
   * La especialidad principal es la primera: el formulario las ordena por
   * prioridad y ése es el criterio estable que también usan los cupos (TR-016).
   */
  const subcategory = getSpecialty(profile.specialtyIds[0] ?? "");
  const category = subcategory ? sectorOfSpecialty(subcategory.id) : undefined;

  const reviews = await listReviews(profile.id);

  const primaryLocation = profile.locations.find(
    (item) => item.isPrimary && item.isActive,
  );
  const location = locationLabelById(
    primaryLocation?.locationId ?? profile.serviceAreaIds[0] ?? "uruguay",
  );

  // BR-004: los canales se ofrecen sólo si el perfil los hizo públicos.
  const showPhone = canShowPhone(profile);
  const showWhatsapp = canUseWhatsapp(profile);
  // BR-019: la insignia se muestra únicamente aprobada.
  const verified = profile.verificationStatus === "verified";
  const activeServices = profile.services.filter((item) => item.isActive);

  // Datos estructurados: ayudan a que el perfil se entienda como un negocio local.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.name,
    description: profile.description,
    ...(showPhone ? { telephone: profile.phoneE164 } : {}),
    areaServed: profile.serviceAreaIds.map((id) => locationLabelById(id)),
    ...(profile.rating !== null && profile.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: profile.rating,
            reviewCount: profile.reviewCount,
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
        <Banner tone="info" icon="visibility_off">
          <strong className="font-semibold">
            Vista previa: así se verá tu perfil cuando lo publiques.
          </strong>{" "}
          Todavía no es visible para nadie más.{" "}
          <Link href="/dashboard" className="font-semibold underline">
            Volver a mi perfil
          </Link>
        </Banner>
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
              name={profile.icon}
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
                alt={`Foto de ${profile.name}`}
                className="h-[72px] w-[72px] flex-none rounded-[18px] border border-line object-cover"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-[18px] border border-line bg-brand-100 text-[22px] font-extrabold text-brand-800">
                {profile.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {verified ? <VerifiedBadge /> : null}
                <Chip>
                  {profile.type === "business"
                    ? "Empresa"
                    : "Profesional independiente"}
                </Chip>
              </div>

              <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
                {profile.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <RatingLine
                  rating={profile.rating}
                  reviewCount={profile.reviewCount}
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
            {profile.description}
          </p>

          {/*
            Contacto directo: sin login, sin intermediarios. Cada canal aparece
            sólo si el perfil lo tiene habilitado y público (BR-004): ofrecer un
            teléfono que su dueño ocultó sería publicarlo igual.
          */}
          <div className="flex flex-wrap gap-2.5">
            {showWhatsapp ? (
              <a
                href={whatsappHref(profile)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center gap-2 rounded-input bg-whatsapp px-5 text-[15px] font-bold text-white transition-colors hover:bg-[#1E8C56]"
              >
                <Icon name="chat" className="text-[19px]" />
                Escribir por WhatsApp
              </a>
            ) : null}
            {showPhone ? (
              <a
                href={phoneHref(profile)}
                className={`flex h-11 items-center gap-2 rounded-input px-5 text-[15px] font-semibold ${SECONDARY_SURFACE}`}
              >
                <Icon name="call" className="text-[19px] text-brand-800" />
                {profile.phone}
              </a>
            ) : null}
            {profile.contactEmail ? (
              <a
                href={`mailto:${profile.contactEmail}`}
                className={`flex h-11 items-center gap-2 rounded-input px-5 text-[15px] font-semibold ${SECONDARY_SURFACE}`}
              >
                <Icon name="mail" className="text-[19px] text-brand-800" />
                {profile.contactEmail}
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <Panel title="Servicios">
              <div className="flex flex-wrap gap-2">
                {activeServices.map((service) => (
                  <Chip key={service.id} className="text-[13.5px]">
                    {service.name}
                  </Chip>
                ))}
              </div>
            </Panel>

            {/* La ubicación del profesional es distinta de dónde trabaja. */}
            <Panel title="Zonas donde trabaja">
              <div className="flex flex-wrap gap-2">
                {profile.serviceAreaIds.map((id) => (
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
                <ReviewList reviews={reviews} totalCount={profile.reviewCount} />
                <ReviewForm profileId={profile.id} providerSlug={profile.slug} />
              </div>
            </Panel>
          </div>

          <aside className="flex flex-col gap-6">
            <Panel title="Información">
              <dl className="flex flex-col gap-4">
                {/*
                  Los horarios son hasta diez líneas de texto libre (BR-024):
                  van como lista y no unidas por separadores, que es lo que
                  permite escribir "Domingos: cerrado" en su propio renglón.
                */}
                {profile.scheduleEntries.length > 0 ? (
                  <InfoRow icon="schedule" label="Horarios">
                    <ul className="flex flex-col gap-0.5">
                      {profile.scheduleEntries.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                      ))}
                    </ul>
                  </InfoRow>
                ) : null}

                {/*
                  BR-017: con más de una modalidad la atención es híbrida, y eso
                  se deriva acá al mostrar en vez de guardarse (TR-001).
                */}
                {profile.serviceModes.length > 0 ? (
                  <InfoRow icon="handshake" label="Cómo atiende">
                    {profile.serviceModes
                      .map((mode) => SERVICE_MODE_LABELS[mode])
                      .join(" · ")}
                  </InfoRow>
                ) : null}

                <InfoRow icon="location_on" label="Ubicación">
                  {location}
                </InfoRow>

                {profile.paymentMethods.length > 0 ? (
                  <InfoRow icon="payments" label="Formas de pago">
                    {profile.paymentMethods
                      .map((method) => PAYMENT_METHOD_LABELS[method])
                      .join(" · ")}
                  </InfoRow>
                ) : null}
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
