import Link from "next/link";

import { Icon, RatingLine } from "@/components/ui";
import { locationLabelById } from "@/data/locations";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import {
  SERVICE_TIER_LABELS,
  serviceCardHref,
  serviceCardFacts,
  serviceCardPrice,
} from "@/lib/service-cards";
import type { ServiceCard } from "@/types";

const TIER_STYLE = {
  economy: "bg-[#E8F6EF] text-[#19734A]",
  standard: "bg-brand-100 text-brand-800",
  premium: "bg-[#F5EAFE] text-[#7D31B8]",
} as const;

export function ServiceOfferCard({ card, interactive = true }: { card: ServiceCard; interactive?: boolean }) {
  const specialty = getSpecialty(card.specialtyId);
  const sector = sectorOfSpecialty(card.specialtyId);

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-[#C6CEDC] hover:shadow-card-hover">
      <div className="relative aspect-[16/10] overflow-hidden bg-card-gradient">
        {card.imageUrl ? (
          // Las imágenes del proveedor ya pasaron por el pipeline de R2.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-hatch" />
            <Icon
              name={sector?.icon ?? card.providerIcon}
              className="absolute -bottom-7 right-3 text-[128px] leading-none text-white/[.14]"
            />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#101F3C]/45 to-transparent" />
        {specialty ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-bold text-ink shadow-sm">
            {specialty.name}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[17px] font-bold leading-snug tracking-[-.2px] text-ink">
            {interactive ? (
              <Link href={serviceCardHref(card)} className="after:absolute after:inset-0">
                {card.title}
              </Link>
            ) : card.title}
          </h3>
          <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${TIER_STYLE[card.tier]}`}>
            {SERVICE_TIER_LABELS[card.tier]}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <p className="flex min-w-0 items-center gap-1 text-[13.5px] font-semibold text-ink-muted">
            <span className="truncate">{card.providerName}</span>
            {card.providerVerified ? <Icon name="verified" filled className="flex-none text-[16px] text-success" /> : null}
          </p>
          <RatingLine rating={card.providerRating} reviewCount={card.providerReviewCount} />
        </div>

        <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">{card.description}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line-soft pt-3">
          {serviceCardFacts(card).slice(0, 2).map((fact) => (
            <span key={fact.icon} className="flex items-center gap-1 text-[12.5px] text-ink-muted">
              <Icon name={fact.icon} className="text-[15px] text-brand-700" />
              {fact.label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-0.5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[.55px] text-ink-faint">Precio</p>
            <p className="truncate text-[18px] font-extrabold tracking-[-.3px] text-brand-800">
              {serviceCardPrice(card)}
            </p>
          </div>
          <span className="flex min-w-0 items-center gap-1 text-[12.5px] text-ink-soft">
            <Icon name="location_on" className="flex-none text-[15px]" />
            <span className="truncate">{locationLabelById(card.providerLocationId)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
