"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { FormState } from "@/app/actions/auth";
import { deleteServiceCard, saveServiceCard } from "@/app/actions/service-cards";
import { ServiceDetailDialog } from "@/components/dashboard/service-detail-dialog";
import { ServicePicker } from "@/components/dashboard/service-picker";
import { FormAlert } from "@/components/form-alert";
import { ImageField } from "@/components/image-field";
import { ServiceOfferCard } from "@/components/service-offer-card";
import { Button, Icon, SECONDARY_SURFACE } from "@/components/ui";
import { SERVICE_TIER_LABELS } from "@/lib/service-cards";
import { useFieldErrors } from "@/lib/use-field-errors";
import { fieldErrors as validationErrors, serviceCardFieldSchemas, serviceCardSchema } from "@/lib/validation";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type Profile,
  type ProfileService,
  type ServiceCard,
  type ServiceCardPriceKind,
  type ServiceCardTier,
  type ServiceModeCode,
} from "@/types";

const EMPTY_STATE: FormState = {};
const INPUT = "h-11 w-full rounded-input border border-line-strong bg-white px-3.5 text-[16px] text-ink outline-none focus:border-brand-800 aria-[invalid=true]:border-danger sm:text-[14.5px]";
const PRICES: { value: ServiceCardPriceKind; label: string }[] = [
  { value: "quote", label: "A convenir" },
  { value: "fixed", label: "Precio fijo" },
  { value: "from", label: "Desde" },
  { value: "range", label: "Rango" },
];
const MODES = Object.keys(SERVICE_MODE_LABELS) as ServiceModeCode[];
const PAYMENTS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const TIERS = Object.keys(SERVICE_TIER_LABELS) as ServiceCardTier[];

export function ServiceCardsManager({ cards, profile, specialtyIds, limit, profilePublished, embedded = false }: {
  cards: ServiceCard[];
  profile: Profile;
  specialtyIds: string[];
  limit: number;
  profilePublished: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ServiceCard | "new" | null>(null);
  const [preview, setPreview] = useState<ServiceCard | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await saveServiceCard(previous, formData);
      if (result.message) {
        setSelected(null);
        router.refresh();
      }
      return result;
    },
    EMPTY_STATE,
  );
  const activeCount = cards.filter((card) => card.isActive && specialtyIds.includes(card.specialtyId)).length;
  const canCreate = activeCount < limit;
  const availableServices = profile.services.filter(
    (service) => service.isActive && specialtyIds.includes(service.specialtyId),
  );

  return (
    <section className={`w-full min-w-0 max-w-full bg-white ${embedded ? "border-b border-line-soft" : "rounded-card border border-line shadow-card"}`}>
      <h2 className="relative z-10 -ml-1 rounded-r-sm bg-header-gradient px-4 py-3 text-[15px] font-bold tracking-[-.2px] text-white shadow-[0_2px_6px_rgba(16,24,40,.18)] [text-shadow:0_1px_1px_rgba(0,0,0,.45)] after:absolute after:left-0 after:top-full after:h-1 after:w-1 after:bg-brand-950 after:[clip-path:polygon(0_0,100%_0,100%_100%)] sm:-ml-3 sm:px-5 sm:after:h-3 sm:after:w-3">
        Cartas de servicio
      </h2>
      <FormAlert
        message={state.message}
        tone="success"
        resetKey={state}
        className="top-[60px]"
      />

      <div className="min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-soft">{activeCount} de {limit} disponibles en tu plan</p>
          <Button type="button" size="sm" onClick={() => setSelected("new")} disabled={!canCreate || availableServices.length === 0 || selected !== null}>
            <Icon name="add" className="text-[17px]" /> Nueva carta
          </Button>
        </div>
        {!profilePublished ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-input border border-brand-600/20 bg-brand-100 px-3.5 py-3 text-[13px] leading-relaxed text-brand-800">
            <Icon name="visibility_off" className="mt-0.5 flex-none text-[17px]" />
            <p>Podés crear y preparar tus cartas ahora. Permanecerán privadas hasta que publiques el perfil.</p>
          </div>
        ) : null}
        {availableServices.length === 0 ? (
          <p className="mb-4 rounded-input border border-line-soft bg-surface-muted px-3.5 py-3 text-[13px] text-ink-soft">
            Para crear una carta, primero agregá al menos un servicio activo a tu perfil.
          </p>
        ) : null}

        {cards.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <div key={card.id} className="relative min-w-0 max-w-full">
                <ServiceOfferCard card={card} interactive={false} footer={(
                  <div className="grid min-w-0 grid-cols-3 border-t border-line-soft bg-surface-muted p-2">
                    <CardAction icon="visibility" label="Detalles" onClick={() => setPreview(card)} />
                    <CardAction icon="edit" label="Modificar" disabled={selected !== null} onClick={() => setSelected(card)} />
                    <form className="min-w-0" action={async (data) => {
                      if (!window.confirm(`¿Eliminar “${card.title}”?`)) return;
                      await deleteServiceCard(data);
                      router.refresh();
                    }}>
                      <input type="hidden" name="id" value={card.id} />
                      <button disabled={selected !== null} className="flex h-9 w-full min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-input px-0.5 text-[11px] font-semibold text-danger transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 min-[360px]:gap-1 min-[360px]:px-1 min-[360px]:text-[12px]">
                        <Icon name="delete" className="flex-none text-[16px]" /><span className="min-w-0 truncate">Eliminar</span>
                      </button>
                    </form>
                  </div>
                )} />
                <span className="absolute right-2.5 top-2.5 z-10">
                  <StatusBadge card={card} specialtyActive={specialtyIds.includes(card.specialtyId)} profilePublished={profilePublished} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Icon name="design_services" className="text-[34px] text-ink-faint" />
            <p className="font-semibold text-ink">Convertí un servicio en una propuesta concreta</p>
            <p className="max-w-lg text-[13.5px] text-ink-soft">Indicá qué incluye, cuánto cuesta y cómo se brinda. La carta podrá aparecer por separado en las búsquedas.</p>
          </div>
        )}
        {!canCreate && cards.length > 0 ? <p className="mt-3 rounded-input bg-brand-100 px-3 py-2 text-[12.5px] text-brand-800">Alcanzaste el límite actual. Podés editar tus cartas o consultar otros planes.</p> : null}
      </div>

      {selected ? (
        <EditorDialog
          key={selected === "new" ? "new" : selected.id}
          card={selected === "new" ? null : selected}
          services={availableServices}
          action={action}
          pending={pending}
          serverErrors={state.errors ?? {}}
          resetKey={state}
          onCancel={() => setSelected(null)}
        />
      ) : null}
      {preview ? <ServiceDetailDialog card={preview} profile={profile} onClose={() => setPreview(null)} /> : null}
    </section>
  );
}

function StatusBadge({ card, specialtyActive, profilePublished }: { card: ServiceCard; specialtyActive: boolean; profilePublished: boolean }) {
  const label = !specialtyActive ? "Especialidad inactiva" : !card.isActive ? "Oculta por el plan" : !card.isPublished ? "Borrador" : profilePublished ? "Publicada" : "Lista para publicar";
  const style = specialtyActive && card.isActive && card.isPublished && profilePublished ? "bg-[#E8F6EF] text-[#19734A]" : "bg-white text-ink-soft";
  return <span className={`block max-w-[calc(100vw-3rem)] truncate rounded-full px-2 py-0.5 text-[10.5px] font-bold shadow-card ${style}`}>{label}</span>;
}

function EditorDialog({ card, services, action, pending, serverErrors, resetKey, onCancel }: {
  card: ServiceCard | null;
  services: ProfileService[];
  action: (payload: FormData) => void;
  pending: boolean;
  serverErrors: Record<string, string>;
  resetKey: FormState;
  onCancel: () => void;
}) {
  const titleId = useId();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [serviceId, setServiceId] = useState(card?.serviceId ?? "");
  const [priceKind, setPriceKind] = useState<ServiceCardPriceKind>(card?.priceKind ?? "quote");
  const [description, setDescription] = useState(card?.description ?? "");
  const [initialImageIds] = useState(() => card?.images.map((image) => image.id) ?? []);
  const [imageSelection, setImageSelection] = useState({ keepIds: initialImageIds, busy: false });
  const [initialFormState] = useState(() => card ? JSON.stringify(serviceCardFromCard(card)) : "");
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState<Record<string, boolean>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: unknown) => {
    const schema = serviceCardFieldSchemas[field];
    if (!schema) return "";
    const parsed = schema.safeParse(value);
    return parsed.success ? "" : (parsed.error.issues[0]?.message ?? "Dato no válido.");
  }, []);
  const fieldErrorState = useFieldErrors(validateField);
  const currentInput = useCallback(() => formRef.current ? serviceCardInput(formRef.current) : null, []);
  const refreshDirty = useCallback(() => {
    const input = currentInput();
    if (input) {
      const imagesChanged = imageSelection.keepIds.join("|") !== initialImageIds.join("|");
      setDirty(card === null || JSON.stringify(input) !== initialFormState || imagesChanged);
    }
  }, [card, currentInput, imageSelection.keepIds, initialFormState, initialImageIds]);
  const cancel = useCallback(async () => {
    const pendingIds = imageSelection.keepIds.filter((id) => !initialImageIds.includes(id));
    await Promise.all(pendingIds.map((id) => fetch(`/api/service-card-images?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined)));
    onCancel();
  }, [imageSelection.keepIds, initialImageIds, onCancel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending && !imageSelection.busy) void cancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [cancel, imageSelection.busy, pending]);

  const errors: Record<string, string> = { ...serverErrors };
  for (const field of Object.keys(stale)) if (stale[field] && field !== "form") delete errors[field];
  Object.assign(errors, submitErrors, fieldErrorState.shown);
  const a11y = (field: string) => ({
    "aria-invalid": errors[field] ? true as const : undefined,
    "aria-describedby": errors[field] ? `${formId}-${field}-error` : undefined,
  });

  function handleInput(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) || !target.name) return;
    const field = target.name;
    setDirty(true);
    setStale((current) => ({ ...current, [field]: true }));
    setSubmitErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    fieldErrorState.edit(field, normalizeCardField(field, target));
    requestAnimationFrame(refreshDirty);
  }
  function handleBlur(event: React.FocusEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      if (target.name) fieldErrorState.blur(target.name, normalizeCardField(target.name, target));
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[90] flex items-center justify-center bg-[#101828]/70 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending && !imageSelection.busy) void cancel();
    }}>
      <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-pop sm:h-auto sm:max-h-[94dvh] sm:rounded-card sm:border sm:border-white/20">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-bold text-ink">{card ? "Editar carta" : "Nueva carta"}</h2>
            <p className="text-[12.5px] text-ink-soft">Convertí uno de tus servicios en una oferta concreta.</p>
          </div>
          <button ref={closeButton} type="button" onClick={() => void cancel()} disabled={pending || imageSelection.busy} aria-label="Cerrar editor" className={`flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-50 ${SECONDARY_SURFACE}`}><Icon name="close" className="text-[20px]" /></button>
        </header>
        <FormAlert message={errors.form ?? (Object.keys(serverErrors).length > 0 ? "Revisá los campos marcados." : undefined)} tone="error" resetKey={resetKey} />
        <form
          ref={formRef}
          action={action}
          noValidate
          onInput={handleInput}
          onBlur={handleBlur}
          onSubmit={(event) => {
            const input = currentInput();
            const parsed = serviceCardSchema.safeParse(input);
            if (!parsed.success) {
              event.preventDefault();
              setSubmitErrors(validationErrors(parsed.error));
              if (input) fieldErrorState.submitAll(input);
            }
          }}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-5"
        >
          <div className="flex flex-col gap-5">
            {card ? <input type="hidden" name="id" value={card.id} /> : null}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <input type="hidden" name="serviceId" value={serviceId} />
              <ServicePicker
                services={services}
                value={serviceId}
                error={errors.serviceId}
                errorId={`${formId}-serviceId-error`}
                onBlur={() => fieldErrorState.blur("serviceId", serviceId)}
                onChange={(nextServiceId) => {
                  setServiceId(nextServiceId);
                  setDirty(true);
                  setStale((current) => ({ ...current, serviceId: true }));
                  setSubmitErrors((current) => {
                    if (!current.serviceId) return current;
                    const next = { ...current };
                    delete next.serviceId;
                    return next;
                  });
                  fieldErrorState.edit("serviceId", nextServiceId);
                  requestAnimationFrame(refreshDirty);
                }}
              />
              <Field label="Título de la carta" error={errors.title} errorId={`${formId}-title-error`} wide>
                <input name="title" defaultValue={card?.title} maxLength={90} required className={INPUT} placeholder="Ej. Pintura completa de un ambiente" {...a11y("title")} />
              </Field>
              <Field label="Nivel de la propuesta" error={errors.tier} errorId={`${formId}-tier-error`}>
                <select name="tier" defaultValue={card?.tier ?? "standard"} className={INPUT} {...a11y("tier")}>
                  {TIERS.map((tier) => <option key={tier} value={tier}>{SERVICE_TIER_LABELS[tier]}</option>)}
                </select>
              </Field>
              <Field label="Descripción e inclusiones" error={errors.description} errorId={`${formId}-description-error`} counter={`${description.length}/800 · mínimo 20 caracteres`} wide>
                <textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={20} maxLength={800} required className={`${INPUT} min-h-28 resize-y py-3`} placeholder="Contá qué incluye, para quién sirve y qué resultado puede esperar." {...a11y("description")} />
              </Field>
              <Field label="Tipo de precio" error={errors.priceKind} errorId={`${formId}-priceKind-error`}>
                <select name="priceKind" value={priceKind} onChange={(event) => setPriceKind(event.target.value as ServiceCardPriceKind)} className={INPUT} {...a11y("priceKind")}>
                  {PRICES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              {priceKind !== "quote" && priceKind !== "range" ? (
                <Field label="Precio (UYU)" error={errors.priceMin} errorId={`${formId}-priceMin-error`}>
                  <input name="priceMin" type="number" min="1" step="1" defaultValue={card?.priceMinCents ? card.priceMinCents / 100 : undefined} required className={INPUT} {...a11y("priceMin")} />
                </Field>
              ) : null}
              {priceKind === "range" ? (
                <div className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2">
                  <Field label="Precio mínimo (UYU)" error={errors.priceMin} errorId={`${formId}-priceMin-error`}>
                    <input name="priceMin" type="number" min="1" step="1" defaultValue={card?.priceMinCents ? card.priceMinCents / 100 : undefined} required className={INPUT} {...a11y("priceMin")} />
                  </Field>
                  <Field label="Precio máximo (UYU)" error={errors.priceMax} errorId={`${formId}-priceMax-error`}>
                    <input name="priceMax" type="number" min="1" step="1" defaultValue={card?.priceMaxCents ? card.priceMaxCents / 100 : undefined} required className={INPUT} {...a11y("priceMax")} />
                  </Field>
                </div>
              ) : null}
              <Field label="Modalidad" error={errors.serviceMode} errorId={`${formId}-serviceMode-error`}>
                <select name="serviceMode" defaultValue={card?.serviceMode ?? "at_customer"} className={INPUT} {...a11y("serviceMode")}>
                  {MODES.map((mode) => <option key={mode} value={mode}>{SERVICE_MODE_LABELS[mode]}</option>)}
                </select>
              </Field>
              <Field label="Forma de pago principal" error={errors.paymentMethod} errorId={`${formId}-paymentMethod-error`}>
                <select name="paymentMethod" defaultValue={card?.paymentMethod ?? ""} className={INPUT} {...a11y("paymentMethod")}>
                  <option value="">A coordinar</option>
                  {PAYMENTS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}
                </select>
              </Field>
              <Field label="Duración mínima (minutos)" error={errors.durationMinMinutes} errorId={`${formId}-durationMinMinutes-error`}>
                <input name="durationMinMinutes" type="number" min="1" defaultValue={card?.durationMinMinutes ?? undefined} className={INPUT} placeholder="Ej. 60" {...a11y("durationMinMinutes")} />
              </Field>
              <Field label="Duración máxima (minutos)" error={errors.durationMaxMinutes} errorId={`${formId}-durationMaxMinutes-error`}>
                <input name="durationMaxMinutes" type="number" min="1" defaultValue={card?.durationMaxMinutes ?? undefined} className={INPUT} placeholder="Opcional" {...a11y("durationMaxMinutes")} />
              </Field>
              <Field label="Horario o disponibilidad" error={errors.schedule} errorId={`${formId}-schedule-error`} wide>
                <input name="schedule" defaultValue={card?.schedule} maxLength={160} className={INPUT} placeholder="Ej. Lunes a viernes, coordinando con 48 h" {...a11y("schedule")} />
              </Field>
              <div className="sm:col-span-2">
                <ImageField
                  field="service"
                  label="Imágenes del servicio"
                  hint="La primera será la portada de la carta. Podés agregar hasta tres muestras más; si no subís ninguna, usaremos el fondo de la categoría."
                  shape="grid"
                  initial={card?.images ?? []}
                  max={4}
                  endpoint={`/api/service-card-images${card ? `?cardId=${encodeURIComponent(card.id)}` : ""}`}
                  onChange={(next) => {
                    setImageSelection({ keepIds: next.keepIds, busy: next.busy });
                    const input = currentInput();
                    const fieldsChanged = input ? JSON.stringify(input) !== initialFormState : false;
                    setDirty(card === null || fieldsChanged || next.keepIds.join("|") !== initialImageIds.join("|"));
                  }}
                />
                {imageSelection.keepIds.map((id) => <input key={id} type="hidden" name="serviceImageId" value={id} />)}
                {errors.serviceImages ? <span id={`${formId}-serviceImages-error`} role="alert" className="mt-1 block text-[12px] text-danger">{errors.serviceImages}</span> : null}
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-input border border-line-soft bg-surface-muted p-3.5">
              <input type="checkbox" name="isPublished" defaultChecked={card?.isPublished ?? true} className="mt-1 h-4 w-4 accent-brand-800" />
              <span><strong className="block text-[14px] text-ink">Mostrar esta carta cuando el perfil esté publicado</strong><span className="text-[12.5px] text-ink-soft">Si la desmarcás queda guardada como borrador.</span></span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-4">
              <button type="button" onClick={() => void cancel()} disabled={pending || imageSelection.busy} className={`h-11 rounded-input px-5 text-[14px] font-semibold disabled:opacity-50 ${SECONDARY_SURFACE}`}>Cancelar</button>
              <Button type="submit" disabled={!dirty || pending || imageSelection.busy}>{pending || imageSelection.busy ? "Guardando…" : "Guardar carta"}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function serviceCardInput(form: HTMLFormElement) {
  const data = new FormData(form);
  const serviceId = String(data.get("serviceId") ?? "");
  return {
    serviceId,
    title: data.get("title"),
    description: data.get("description"),
    priceKind: data.get("priceKind"),
    priceMin: nullableNumber(data.get("priceMin")),
    priceMax: nullableNumber(data.get("priceMax")),
    tier: data.get("tier"),
    durationMinMinutes: nullableNumber(data.get("durationMinMinutes")),
    durationMaxMinutes: nullableNumber(data.get("durationMaxMinutes")),
    serviceMode: data.get("serviceMode"),
    paymentMethod: String(data.get("paymentMethod") ?? "").trim() || null,
    schedule: data.get("schedule") ?? "",
    imageId: null,
    isPublished: data.get("isPublished") === "on",
  };
}

function serviceCardFromCard(card: ServiceCard) {
  return {
    serviceId: card.serviceId,
    title: card.title,
    description: card.description,
    priceKind: card.priceKind,
    priceMin: card.priceMinCents === null ? null : card.priceMinCents / 100,
    priceMax: card.priceMaxCents === null ? null : card.priceMaxCents / 100,
    tier: card.tier,
    durationMinMinutes: card.durationMinMinutes,
    durationMaxMinutes: card.durationMaxMinutes,
    serviceMode: card.serviceMode,
    paymentMethod: card.paymentMethod,
    schedule: card.schedule,
    imageId: null,
    isPublished: card.isPublished,
  };
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

function normalizeCardField(field: string, target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
  if (["priceMin", "priceMax", "durationMinMinutes", "durationMaxMinutes"].includes(field)) return nullableNumber(target.value);
  if (field === "paymentMethod") return target.value || null;
  if (field === "isPublished" && target instanceof HTMLInputElement) return target.checked;
  return target.value;
}

function Field({ label, error, errorId, counter, wide = false, children }: { label: string; error?: string; errorId: string; counter?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink">
        <span>{label}</span>{counter ? <span className="font-normal text-ink-faint">{counter}</span> : null}
      </span>
      {children}
      {error ? <span id={errorId} role="alert" className="text-[12px] text-danger">{error}</span> : null}
    </label>
  );
}

function CardAction({ icon, label, disabled = false, onClick }: { icon: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex h-9 min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-input px-0.5 text-[11px] font-semibold text-brand-800 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 min-[360px]:gap-1 min-[360px]:px-1 min-[360px]:text-[12px]">
      <Icon name={icon} className="flex-none text-[16px]" /><span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
