"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { FormState } from "@/app/actions/auth";
import { deleteServiceCard, saveServiceCard } from "@/app/actions/service-cards";
import { FormAlert } from "@/components/form-alert";
import { Button, Icon, SECONDARY_SURFACE } from "@/components/ui";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { SERVICE_TIER_LABELS, serviceCardPrice } from "@/lib/service-cards";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type ProfileImage,
  type ServiceCard,
  type ServiceCardPriceKind,
  type ServiceCardTier,
  type ServiceModeCode,
} from "@/types";

const EMPTY_STATE: FormState = {};
const INPUT = "h-11 w-full rounded-input border border-line-strong bg-white px-3.5 text-[16px] text-ink outline-none focus:border-brand-800 sm:text-[14.5px]";
const PRICES: { value: ServiceCardPriceKind; label: string }[] = [
  { value: "quote", label: "A convenir" },
  { value: "fixed", label: "Precio fijo" },
  { value: "from", label: "Desde" },
  { value: "range", label: "Rango" },
];
const MODES = Object.keys(SERVICE_MODE_LABELS) as ServiceModeCode[];
const PAYMENTS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const TIERS = Object.keys(SERVICE_TIER_LABELS) as ServiceCardTier[];

export function ServiceCardsManager({
  cards,
  specialtyIds,
  images,
  limit,
  profilePublished,
}: {
  cards: ServiceCard[];
  specialtyIds: string[];
  images: ProfileImage[];
  limit: number;
  profilePublished: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ServiceCard | "new" | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveServiceCard, EMPTY_STATE);
  const activeCount = cards.filter((card) => card.isActive && specialtyIds.includes(card.specialtyId)).length;
  const canCreate = activeCount < limit;

  useEffect(() => {
    if (!state.message) return;
    router.refresh();
  }, [state.message, router]);

  return (
    <section className="min-w-0 overflow-hidden rounded-card border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-header-gradient px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-input bg-white/90 text-brand-800 shadow-sm">
          <Icon name="sell" className="text-[20px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-ink">Cartas de servicio</h2>
          <p className="text-[12.5px] text-ink-soft">
            {activeCount} de {limit} disponibles en tu plan
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setSelected("new")}
          disabled={!canCreate || specialtyIds.length === 0}
        >
          <Icon name="add" className="text-[17px]" />
          Nueva carta
        </Button>
      </header>

      <FormAlert
        message={state.errors?.form ?? state.message}
        tone={state.errors ? "error" : "success"}
        resetKey={state}
        className="top-[60px]"
      />

      <div className="p-3 sm:p-5">
        {!profilePublished ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-input border border-brand-600/20 bg-brand-100 px-3.5 py-3 text-[13px] leading-relaxed text-brand-800">
            <Icon name="visibility_off" className="mt-0.5 flex-none text-[17px]" />
            <p>
              Podés crear y preparar tus cartas ahora. Permanecerán privadas
              hasta que publiques el perfil.
            </p>
          </div>
        ) : null}
        {cards.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((card) => (
              <article key={card.id} className="flex min-w-0 gap-3 rounded-input border border-line-soft bg-surface-muted p-3.5">
                <div className="relative h-20 w-24 flex-none overflow-hidden rounded-input bg-card-gradient">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon name={sectorOfSpecialty(card.specialtyId)?.icon ?? "handyman"} className="absolute bottom-[-8px] right-0 text-[62px] text-white/20" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-ink">{card.title}</h3>
                    <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-brand-800">{SERVICE_TIER_LABELS[card.tier]}</span>
                  </div>
                  <p className="text-[13px] font-bold text-brand-800">{serviceCardPrice(card)}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <StatusBadge
                      card={card}
                      specialtyActive={specialtyIds.includes(card.specialtyId)}
                      profilePublished={profilePublished}
                    />
                    <button type="button" onClick={() => setSelected(card)} className="relative z-10 text-[12.5px] font-semibold text-brand-800 hover:underline">Editar</button>
                    <form action={async (data) => {
                      if (!window.confirm(`¿Eliminar “${card.title}”?`)) return;
                      await deleteServiceCard(data);
                      router.refresh();
                    }}>
                      <input type="hidden" name="id" value={card.id} />
                      <button className="text-[12.5px] font-semibold text-danger hover:underline">Eliminar</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Icon name="design_services" className="text-[34px] text-ink-faint" />
            <p className="font-semibold text-ink">Convertí un servicio en una propuesta concreta</p>
            <p className="max-w-lg text-[13.5px] text-ink-soft">Indicá qué incluye, cuánto cuesta y cómo se brinda. La carta podrá aparecer por separado en las búsquedas.</p>
          </div>
        )}

        {!canCreate && cards.length > 0 ? (
          <p className="mt-3 rounded-input bg-brand-100 px-3 py-2 text-[12.5px] text-brand-800">
            Alcanzaste el límite actual. Podés editar tus cartas o consultar otros planes.
          </p>
        ) : null}

        {selected ? (
          <Editor
            key={selected === "new" ? "new" : selected.id}
            card={selected === "new" ? null : selected}
            specialtyIds={specialtyIds}
            images={images}
            action={action}
            pending={pending}
            errors={state.errors ?? {}}
            onCancel={() => setSelected(null)}
          />
        ) : null}
      </div>
    </section>
  );
}

function StatusBadge({ card, specialtyActive, profilePublished }: { card: ServiceCard; specialtyActive: boolean; profilePublished: boolean }) {
  const label = !specialtyActive
    ? "Especialidad inactiva"
    : !card.isActive
      ? "Oculta por el plan"
      : !card.isPublished
        ? "Borrador"
        : profilePublished
          ? "Publicada"
          : "Lista para publicar";
  const style = specialtyActive && card.isActive && card.isPublished && profilePublished ? "bg-[#E8F6EF] text-[#19734A]" : "bg-white text-ink-soft";
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${style}`}>{label}</span>;
}

function Editor({ card, specialtyIds, images, action, pending, errors, onCancel }: {
  card: ServiceCard | null;
  specialtyIds: string[];
  images: ProfileImage[];
  action: (payload: FormData) => void;
  pending: boolean;
  errors: Record<string, string>;
  onCancel: () => void;
}) {
  const [priceKind, setPriceKind] = useState<ServiceCardPriceKind>(card?.priceKind ?? "quote");
  const usableImages = images.filter((image) => image.lifecycle === "confirmed");
  return (
    <form action={action} className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
      {card ? <input type="hidden" name="id" value={card.id} /> : null}
      <div>
        <h3 className="text-[17px] font-bold text-ink">{card ? "Editar carta" : "Nueva carta"}</h3>
        <p className="text-[13px] text-ink-soft">Los datos deben describir una oferta concreta que alguien pueda comparar.</p>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Nombre del servicio" error={errors.title} wide>
          <input name="title" defaultValue={card?.title} maxLength={90} required className={INPUT} placeholder="Ej. Pintura completa de un ambiente" />
        </Field>
        <Field label="Especialidad" error={errors.specialtyId}>
          <select name="specialtyId" defaultValue={card?.specialtyId} required className={INPUT}>
            <option value="">Elegí una especialidad</option>
            {specialtyIds.map((id) => <option key={id} value={id}>{getSpecialty(id)?.name ?? id}</option>)}
          </select>
        </Field>
        <Field label="Nivel de la propuesta" error={errors.tier}>
          <select name="tier" defaultValue={card?.tier ?? "standard"} className={INPUT}>
            {TIERS.map((tier) => <option key={tier} value={tier}>{SERVICE_TIER_LABELS[tier]}</option>)}
          </select>
        </Field>
        <Field label="Descripción e inclusiones" error={errors.description} wide>
          <textarea name="description" defaultValue={card?.description} minLength={20} maxLength={800} required className={`${INPUT} min-h-28 resize-y py-3`} placeholder="Contá qué incluye, para quién sirve y qué resultado puede esperar." />
        </Field>
        <Field label="Tipo de precio" error={errors.priceKind}>
          <select name="priceKind" value={priceKind} onChange={(event) => setPriceKind(event.target.value as ServiceCardPriceKind)} className={INPUT}>
            {PRICES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        {priceKind !== "quote" ? (
          <Field label={priceKind === "range" ? "Precio mínimo (UYU)" : "Precio (UYU)"} error={errors.priceMin}>
            <input name="priceMin" type="number" min="1" step="1" defaultValue={card?.priceMinCents ? card.priceMinCents / 100 : undefined} required className={INPUT} />
          </Field>
        ) : null}
        {priceKind === "range" ? (
          <Field label="Precio máximo (UYU)" error={errors.priceMax}>
            <input name="priceMax" type="number" min="1" step="1" defaultValue={card?.priceMaxCents ? card.priceMaxCents / 100 : undefined} required className={INPUT} />
          </Field>
        ) : null}
        <Field label="Modalidad" error={errors.serviceMode}>
          <select name="serviceMode" defaultValue={card?.serviceMode ?? "at_customer"} className={INPUT}>
            {MODES.map((mode) => <option key={mode} value={mode}>{SERVICE_MODE_LABELS[mode]}</option>)}
          </select>
        </Field>
        <Field label="Forma de pago principal" error={errors.paymentMethod}>
          <select name="paymentMethod" defaultValue={card?.paymentMethod ?? ""} className={INPUT}>
            <option value="">A coordinar</option>
            {PAYMENTS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}
          </select>
        </Field>
        <Field label="Duración mínima (minutos)" error={errors.durationMinMinutes}>
          <input name="durationMinMinutes" type="number" min="1" defaultValue={card?.durationMinMinutes ?? undefined} className={INPUT} placeholder="Ej. 60" />
        </Field>
        <Field label="Duración máxima (minutos)" error={errors.durationMaxMinutes}>
          <input name="durationMaxMinutes" type="number" min="1" defaultValue={card?.durationMaxMinutes ?? undefined} className={INPUT} placeholder="Opcional" />
        </Field>
        <Field label="Horario o disponibilidad" error={errors.schedule} wide>
          <input name="schedule" defaultValue={card?.schedule} maxLength={160} className={INPUT} placeholder="Ej. Lunes a viernes, coordinando con 48 h" />
        </Field>
        {usableImages.length > 0 ? (
          <Field label="Imagen de la carta" error={errors.imageId} wide>
            <select name="imageId" defaultValue={card?.imageId ?? ""} className={INPUT}>
              <option value="">Usar diseño de la categoría</option>
              {usableImages.map((image) => <option key={image.id} value={image.id}>{image.alt || (image.kind === "gallery" ? `Galería ${image.sortOrder + 1}` : image.kind === "cover" ? "Portada" : "Foto de perfil")}</option>)}
            </select>
          </Field>
        ) : null}
      </div>

      <label className="flex items-start gap-3 rounded-input border border-line-soft bg-surface-muted p-3.5">
        <input type="checkbox" name="isPublished" defaultChecked={card?.isPublished ?? true} className="mt-1 h-4 w-4 accent-brand-800" />
        <span><strong className="block text-[14px] text-ink">Mostrar esta carta cuando el perfil esté publicado</strong><span className="text-[12.5px] text-ink-soft">Si la desmarcás queda guardada como borrador.</span></span>
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={`h-11 rounded-input px-5 text-[14px] font-semibold ${SECONDARY_SURFACE}`}>Cancelar</button>
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar carta"}</Button>
      </div>
    </form>
  );
}

function Field({ label, error, wide = false, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </label>
  );
}
