import { PAYMENT_METHOD_LABELS, SERVICE_MODE_LABELS, type ServiceCard } from "@/types";

const money = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

export const SERVICE_TIER_LABELS = {
  economy: "Económico",
  standard: "Estándar",
  premium: "Premium",
} as const;

export function serviceCardPrice(card: ServiceCard): string {
  const min = card.priceMinCents === null ? null : money.format(card.priceMinCents / 100);
  const max = card.priceMaxCents === null ? null : money.format(card.priceMaxCents / 100);
  if (card.priceKind === "quote") return "Precio a convenir";
  if (card.priceKind === "range" && min && max) return `${min} – ${max}`;
  if (card.priceKind === "from" && min) return `Desde ${min}`;
  return min ?? "Precio a convenir";
}

export function serviceCardDuration(card: ServiceCard): string | null {
  const format = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  };
  if (card.durationMinMinutes === null) return null;
  if (card.durationMaxMinutes && card.durationMaxMinutes !== card.durationMinMinutes) {
    return `${format(card.durationMinMinutes)} – ${format(card.durationMaxMinutes)}`;
  }
  return format(card.durationMinMinutes);
}

export function serviceCardFacts(card: ServiceCard) {
  return [
    { icon: "workspaces", label: SERVICE_MODE_LABELS[card.serviceMode] },
    ...(serviceCardDuration(card)
      ? [{ icon: "schedule", label: serviceCardDuration(card)! }]
      : []),
    ...(card.paymentMethod
      ? [{ icon: "payments", label: PAYMENT_METHOD_LABELS[card.paymentMethod] }]
      : []),
  ];
}
