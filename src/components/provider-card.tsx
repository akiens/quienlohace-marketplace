import Link from "next/link";

import { locationLabelById } from "@/data/locations";
import { getSubcategory } from "@/data/categories";
import type { Provider } from "@/types";
import {
  Chip,
  FeaturedBadge,
  Icon,
  RatingLine,
  SECONDARY_SURFACE,
  VerifiedBadge,
} from "@/components/ui";
import { whatsappHref } from "@/lib/contact";

/** Iniciales del proveedor, para el avatar cuando no hay imagen. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * Un proveedor = una card, aunque ofrezca varios servicios.
 * `match` resalta el servicio que coincide con la búsqueda en curso.
 */
export function ProviderCard({
  provider,
  match,
}: {
  provider: Provider;
  match?: string;
}) {
  const subcategory = getSubcategory(provider.subcategoryId);
  const location = locationLabelById(provider.locationId);
  const highlight = match ?? subcategory?.name;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-[#C6CEDC] hover:shadow-card-hover">
      {/* Portada: gradiente propio de card con el icono de la categoría, que
          se recorta a propósito contra el borde inferior derecho. */}
      <div className="relative h-[132px] flex-none overflow-hidden bg-card-gradient">
        <div className="absolute inset-0 bg-hatch" />
        <Icon
          name={provider.icon}
          className="pointer-events-none absolute bottom-[-14px] right-[10px] text-[104px] leading-none text-white/[.14]"
        />
        {provider.featured ? (
          <div className="absolute left-2.5 top-2.5">
            <FeaturedBadge />
          </div>
        ) : null}
        {provider.verified && !provider.featured ? (
          <div className="absolute right-2.5 top-2.5">
            <VerifiedBadge />
          </div>
        ) : null}
      </div>

      <div className="relative z-[2] flex flex-1 flex-col gap-3 px-[18px] pb-[18px]">
        <div className="-mt-[26px] flex h-[54px] w-[54px] items-center justify-center rounded-[14px] border border-line bg-white shadow-[0_2px_6px_rgba(23,32,51,.08)]">
          <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-brand-100 text-[15px] font-extrabold tracking-[-.3px] text-brand-800">
            {initials(provider.name)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-[17px] font-bold tracking-[-.2px] text-ink">
            <Link
              href={`/profesionales/${provider.slug}`}
              // El enlace cubre la card entera, así todo el bloque es clickeable
              // sin anidar enlaces ni romper la navegación por teclado.
              className="after:absolute after:inset-0 after:content-[''] hover:underline"
            >
              {provider.name}
            </Link>
          </h3>

          <RatingLine
            rating={provider.rating}
            reviewCount={provider.reviewCount}
          />

          <p className="flex items-center gap-1.5 text-[13.5px] text-ink-soft">
            <Icon name="location_on" className="text-[16px] text-ink-faint" />
            {location}
          </p>
        </div>

        <div className="h-px bg-line-soft" />

        {highlight ? (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
              Coincide con
            </p>
            <p className="text-[14px] font-semibold text-brand-800">
              {highlight}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {provider.services.slice(0, 3).map((service) => (
            <Chip key={service}>{service}</Chip>
          ))}
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <Link
            href={`/profesionales/${provider.slug}`}
            className="flex h-10 flex-1 items-center justify-center rounded-input bg-brand-800 text-[14px] font-semibold text-white transition-colors hover:bg-brand-900"
            tabIndex={-1}
          >
            Ver perfil
          </Link>
          {/* Contactar no requiere cuenta: es la acción principal del marketplace. */}
          <a
            href={whatsappHref(provider)}
            target="_blank"
            rel="noopener noreferrer"
            // Se eleva sobre el enlace que cubre la card para seguir siendo clickeable.
            // En cards angostas queda sólo el icono: el texto apretaría el
            // botón principal. El nombre accesible se mantiene igual.
            aria-label={`Escribir por WhatsApp a ${provider.name}`}
            className={`relative z-[1] flex h-10 flex-none items-center justify-center gap-1.5 rounded-input px-3 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
          >
            <Icon name="chat" className="text-[18px] text-whatsapp" />
            <span className="hidden sm:inline xl:hidden">WhatsApp</span>
          </a>
        </div>
      </div>
    </article>
  );
}

/** Placeholder con la misma silueta que la card, para estados de carga. */
export function ProviderCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full animate-pulse flex-col overflow-hidden rounded-card border border-line bg-white"
    >
      <div className="h-[132px] bg-surface-sunken" />
      <div className="flex flex-1 flex-col gap-3 px-[18px] pb-[18px]">
        <div className="-mt-[26px] h-[54px] w-[54px] rounded-[14px] border border-line bg-white" />
        <div className="h-4 w-2/3 rounded bg-surface-sunken" />
        <div className="h-3 w-1/2 rounded bg-surface-sunken" />
        <div className="h-px bg-line-soft" />
        <div className="flex gap-1.5">
          <div className="h-6 w-20 rounded-full bg-surface-sunken" />
          <div className="h-6 w-16 rounded-full bg-surface-sunken" />
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <div className="h-10 flex-1 rounded-input bg-surface-sunken" />
          <div className="h-10 w-28 rounded-input bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}
