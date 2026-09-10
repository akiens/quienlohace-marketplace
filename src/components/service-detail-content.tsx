import Link from "next/link";

import { PublicProfileGallery } from "@/components/public-profile-gallery";
import { Chip, Icon, RatingLine, SECONDARY_SURFACE } from "@/components/ui";
import { locationLabelById } from "@/data/locations";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { canShowPhone, canUseWhatsapp, phoneHref, whatsappHref } from "@/lib/contact";
import {
  SERVICE_TIER_LABELS,
  serviceCardDuration,
  serviceCardFacts,
  serviceCardPrice,
} from "@/lib/service-cards";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type Profile,
  type ServiceCard,
} from "@/types";

/**
 * Contenido visual de la ruta pública de una carta.
 *
 * La ruta y la vista previa del dashboard renderizan este mismo árbol para
 * que un borrador se pueda revisar sin publicarlo y sin mantener dos diseños
 * que terminarían separándose.
 */
export function ServiceDetailContent({
  card,
  profile,
  embedded = false,
}: {
  card: ServiceCard;
  profile: Profile;
  embedded?: boolean;
}) {
  const specialty = getSpecialty(card.specialtyId);
  const sector = sectorOfSpecialty(card.specialtyId);
  const showWhatsapp = canUseWhatsapp(profile);
  const showPhone = canShowPhone(profile);
  const message = `Hola ${profile.name}, te contacto desde QuienLoHace por “${card.title}”.`;
  const samples = card.images.slice(1);

  return (
    <main
      className={
        embedded
          ? "w-full min-w-0 max-w-full px-1 py-3 sm:px-5 sm:py-6"
          : "shell min-w-0 py-6 sm:py-10"
      }
    >
      <nav
        className="mb-5 flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-ink-soft"
        aria-label="Navegación"
      >
        <Link href="/buscar" className="hover:text-brand-800">
          Servicios
        </Link>
        <Icon name="chevron_right" className="flex-none text-[15px]" />
        <Link
          href={`/profesionales/${profile.slug}`}
          className="min-w-0 break-words hover:text-brand-800"
        >
          {profile.name}
        </Link>
        <Icon name="chevron_right" className="flex-none text-[15px]" />
        <span className="min-w-0 break-words">{card.title}</span>
      </nav>

      <div className="grid min-w-0 max-w-full gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start">
        <div className="flex min-w-0 max-w-full flex-col gap-6">
          <section className="min-w-0 max-w-full overflow-hidden rounded-card border border-line bg-white shadow-panel">
            <div className="relative aspect-[16/8] max-h-[480px] overflow-hidden bg-card-gradient">
              {card.imageUrl ? (
                // Las imágenes ya fueron procesadas y se sirven desde R2.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt={`Portada de ${card.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-hatch" />
                  <Icon
                    name={sector?.icon ?? profile.icon}
                    className="absolute -bottom-12 right-[8%] text-[240px] leading-none text-white/[.14]"
                  />
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#101F3C]/60 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex min-w-0 flex-wrap gap-2 sm:inset-x-5 sm:bottom-5">
                {specialty ? (
                  <span className="max-w-full break-words rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-ink shadow-sm">
                    {specialty.name}
                  </span>
                ) : null}
                <span className="max-w-full rounded-full bg-[#F5EAFE] px-3 py-1.5 text-[12px] font-bold text-[#7D31B8]">
                  {SERVICE_TIER_LABELS[card.tier]}
                </span>
              </div>
            </div>
            <div className="min-w-0 p-4 sm:p-6">
              <h1 className="break-words text-[27px] font-extrabold leading-tight tracking-[-.6px] text-ink sm:text-[34px]">
                {card.title}
              </h1>
              <p className="mt-4 whitespace-pre-line break-words text-[15px] leading-7 text-ink-muted">
                {card.description}
              </p>
            </div>
          </section>

          {samples.length ? (
            <section className="min-w-0 max-w-full rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
              <h2 className="mb-1 text-[18px] font-bold text-ink">
                Muestras del servicio
              </h2>
              <p className="mb-4 text-[13.5px] text-ink-soft">
                Fotos adicionales de esta propuesta.
              </p>
              <PublicProfileGallery images={samples} />
            </section>
          ) : null}

          <section className="min-w-0 max-w-full rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
            <h2 className="mb-4 text-[18px] font-bold text-ink">
              Detalles de la propuesta
            </h2>
            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Detail
                icon="workspaces"
                label="Modalidad"
                value={SERVICE_MODE_LABELS[card.serviceMode]}
              />
              <Detail
                icon="schedule"
                label="Duración"
                value={serviceCardDuration(card) ?? "A coordinar"}
              />
              <Detail
                icon="payments"
                label="Forma de pago"
                value={
                  card.paymentMethod
                    ? PAYMENT_METHOD_LABELS[card.paymentMethod]
                    : "A coordinar"
                }
              />
              <Detail
                icon="calendar_month"
                label="Disponibilidad"
                value={card.schedule || "A coordinar"}
              />
            </dl>
          </section>
        </div>

        <aside className="flex min-w-0 max-w-full flex-col gap-5 lg:sticky lg:top-20">
          <section className="min-w-0 rounded-card border border-brand-600/30 bg-white p-5 shadow-panel">
            <p className="text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
              Precio de la propuesta
            </p>
            <p className="mt-1 break-words text-[25px] font-extrabold tracking-[-.5px] text-brand-800">
              {serviceCardPrice(card)}
            </p>
            <div className="my-4 h-px bg-line-soft" />
            <div className="grid min-w-0 gap-2.5">
              {showWhatsapp ? (
                <a
                  href={whatsappHref(profile, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-input bg-whatsapp px-4 py-2 text-center text-[14px] font-bold text-white hover:bg-success"
                >
                  <Icon name="chat" className="flex-none text-[19px]" />
                  <span className="min-w-0 break-words">
                    Consultar por WhatsApp
                  </span>
                </a>
              ) : null}
              {showPhone ? (
                <a
                  href={phoneHref(profile)}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-input px-4 py-2 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
                >
                  <Icon name="call" className="flex-none text-[18px]" />
                  Llamar
                </a>
              ) : null}
              {profile.contactEmail ? (
                <a
                  href={`mailto:${profile.contactEmail}?subject=${encodeURIComponent(card.title)}`}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-input px-4 py-2 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
                >
                  <Icon name="mail" className="flex-none text-[18px]" />
                  Enviar correo
                </a>
              ) : null}
            </div>
          </section>

          <section className="min-w-0 rounded-card border border-line bg-white p-5 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
              Ofrecido por
            </p>
            <Link
              href={`/profesionales/${profile.slug}`}
              className="mt-2 flex min-w-0 items-center gap-3 rounded-input hover:bg-surface-muted"
            >
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-input bg-brand-100 text-[16px] font-extrabold text-brand-800">
                {profile.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold text-ink">
                  <span className="min-w-0 break-words">{profile.name}</span>
                  {card.providerVerified ? (
                    <Icon
                      name="verified"
                      filled
                      className="flex-none text-[16px] text-success"
                    />
                  ) : null}
                </span>
                <span className="mt-1 block">
                  <RatingLine
                    rating={card.providerRating}
                    reviewCount={card.providerReviewCount}
                  />
                </span>
              </span>
            </Link>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              <Chip className="max-w-full break-words">
                {locationLabelById(card.providerLocationId)}
              </Chip>
              {serviceCardFacts(card)
                .slice(0, 1)
                .map((fact) => (
                  <Chip key={fact.icon} className="max-w-full break-words">
                    {fact.label}
                  </Chip>
                ))}
            </div>
            <Link
              href={`/profesionales/${profile.slug}`}
              className="mt-4 block text-center text-[13.5px] font-semibold text-brand-800 hover:underline"
            >
              Ver perfil completo
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-input border border-line-soft bg-surface-muted p-3.5">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-input bg-brand-100 text-brand-800">
        <Icon name={icon} className="text-[18px]" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[.5px] text-ink-faint">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-[14px] font-medium text-ink-muted">
          {value}
        </dd>
      </div>
    </div>
  );
}
