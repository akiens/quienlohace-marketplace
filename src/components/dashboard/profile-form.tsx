"use client";

import { useActionState, useState } from "react";

import { saveProfile } from "@/app/actions/profile";
import type { FormState } from "@/app/actions/auth";
import { CATEGORIES } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import { Button, Icon } from "@/components/ui";
import { LocationPicker } from "@/components/dashboard/location-picker";
import { MAX_LOCATIONS, type PaymentMethod, type Provider } from "@/types";

const PAYMENT_OPTIONS: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Otros",
];

const MAX_SERVICES = 12;

/**
 * Formulario del perfil. Usa Server Actions: los datos se envían y validan en
 * el servidor, y funciona incluso antes de que hidrate el JavaScript.
 */
export function ProfileForm({ provider }: { provider: Provider | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveProfile,
    {},
  );

  const [services, setServices] = useState<string[]>(
    provider?.services.length ? provider.services : [""],
  );
  const [subcategoryId, setSubcategoryId] = useState(
    provider?.subcategoryId ?? "",
  );
  const [locationId, setLocationId] = useState(provider?.locationId ?? "");
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>(
    provider?.serviceAreaIds ?? [],
  );

  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.message ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-card border border-[#D6EFE0] bg-[#F4FBF7] p-4 text-[14px] font-medium text-[#1E8C56]"
        >
          <Icon name="check_circle" filled className="text-[18px]" />
          {state.message}
        </p>
      ) : null}

      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <Section title="Datos principales">
        <Field label="Nombre del perfil" error={errors.name} required>
          <input
            name="name"
            defaultValue={provider?.name ?? ""}
            maxLength={80}
            required
            className={inputClass(errors.name)}
            placeholder="Ej.: Juan Electricidad"
          />
        </Field>

        <Field label="Tipo" error={errors.kind}>
          <select
            name="kind"
            defaultValue={provider?.kind ?? "individual"}
            className={inputClass(errors.kind)}
          >
            <option value="individual">Profesional independiente</option>
            <option value="business">Empresa / equipo</option>
          </select>
        </Field>

        <Field
          label="Descripción"
          error={errors.description}
          hint="Contá qué hacés y qué te diferencia. Entre 20 y 600 caracteres."
          required
        >
          <textarea
            name="description"
            defaultValue={provider?.description ?? ""}
            rows={4}
            maxLength={600}
            required
            className={`${inputClass(errors.description)} h-auto resize-y py-2.5`}
          />
        </Field>
      </Section>

      <Section title="Rubro">
        <Field
          label="Subcategoría"
          error={errors.subcategoryId}
          hint="La categoría se asigna sola según lo que elijas."
          required
        >
          <select
            name="subcategoryId"
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            required
            className={inputClass(errors.subcategoryId)}
          >
            <option value="">Elegí una subcategoría…</option>
            {CATEGORIES.map((category) => (
              <optgroup key={category.id} label={category.short}>
                {category.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field
          label="Servicios"
          error={errors.services}
          hint={`Lo que ofrecés concretamente. Hasta ${MAX_SERVICES}.`}
          required
        >
          <div className="flex flex-col gap-2">
            {services.map((service, index) => (
              <div key={index} className="flex gap-2">
                <input
                  name="services"
                  value={service}
                  onChange={(event) => {
                    const next = [...services];
                    next[index] = event.target.value;
                    setServices(next);
                  }}
                  maxLength={60}
                  placeholder="Ej.: Instalaciones eléctricas"
                  className={inputClass(undefined)}
                />
                {services.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setServices(services.filter((_, i) => i !== index))
                    }
                    aria-label={`Quitar servicio ${index + 1}`}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-input border border-line-strong text-ink-soft hover:bg-surface-muted"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                ) : null}
              </div>
            ))}

            {services.length < MAX_SERVICES ? (
              <button
                type="button"
                onClick={() => setServices([...services, ""])}
                className="flex items-center gap-1.5 self-start text-[14px] font-semibold text-brand-800 hover:underline"
              >
                <Icon name="add" className="text-[18px]" />
                Agregar servicio
              </button>
            ) : null}
          </div>
        </Field>
      </Section>

      <Section title="Ubicación y zonas">
        <Field
          label="Dónde estás ubicado"
          error={errors.locationId}
          required
        >
          <LocationPicker
            name="locationId"
            value={locationId}
            onChange={setLocationId}
          />
        </Field>

        <Field
          label="Zonas donde trabajás"
          error={errors.serviceAreaIds}
          hint={`Puede ser distinto de dónde estás ubicado. Hasta ${MAX_LOCATIONS}.`}
          required
        >
          <div className="flex flex-col gap-2.5">
            {serviceAreaIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {serviceAreaIds.map((id) => (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-3 pr-1.5 text-[13px] font-semibold text-brand-800"
                  >
                    <input type="hidden" name="serviceAreaIds" value={id} />
                    {locationLabelById(id)}
                    <button
                      type="button"
                      aria-label={`Quitar ${locationLabelById(id)}`}
                      onClick={() =>
                        setServiceAreaIds(serviceAreaIds.filter((x) => x !== id))
                      }
                    >
                      <Icon name="close" className="text-[15px] text-[#5B6B87]" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {serviceAreaIds.length < MAX_LOCATIONS ? (
              <LocationPicker
                value=""
                onChange={(id) => {
                  if (id && !serviceAreaIds.includes(id)) {
                    setServiceAreaIds([...serviceAreaIds, id]);
                  }
                }}
                addMode
              />
            ) : (
              <p className="text-[13px] text-ink-soft">
                Llegaste al máximo de {MAX_LOCATIONS} zonas.
              </p>
            )}
          </div>
        </Field>
      </Section>

      <Section title="Contacto">
        <Field
          label="WhatsApp"
          error={errors.whatsapp}
          hint="Sólo números, con código de país. Ej.: 59899123456"
        >
          <input
            name="whatsapp"
            defaultValue={provider?.whatsapp ?? ""}
            inputMode="numeric"
            maxLength={20}
            className={inputClass(errors.whatsapp)}
            placeholder="59899123456"
          />
        </Field>

        <Field label="Teléfono" error={errors.phone}>
          <input
            name="phone"
            defaultValue={provider?.phone ?? ""}
            maxLength={40}
            className={inputClass(errors.phone)}
            placeholder="099 123 456"
          />
        </Field>

        <Field label="Horarios" error={errors.schedule}>
          <input
            name="schedule"
            defaultValue={provider?.schedule ?? ""}
            maxLength={160}
            className={inputClass(errors.schedule)}
            placeholder="Lunes a viernes · 9:00 a 18:00"
          />
        </Field>

        <Field label="Formas de pago" error={errors.paymentMethods}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {PAYMENT_OPTIONS.map((method) => (
              <label
                key={method}
                className="flex cursor-pointer items-center gap-2 text-[14px] text-ink-muted"
              >
                <input
                  type="checkbox"
                  name="paymentMethods"
                  value={method}
                  defaultChecked={provider?.paymentMethods.includes(method)}
                  className="h-4 w-4 accent-brand-800"
                />
                {method}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar perfil"}
        </Button>
        <p className="text-[13px] text-ink-soft">
          Guardar no publica el perfil: eso se hace desde el botón de arriba.
        </p>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-semibold text-ink">
        {label}
        {required ? <span className="text-[#D92D20]"> *</span> : null}
      </label>
      {hint ? <p className="text-[13px] text-ink-soft">{hint}</p> : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#D92D20]">
          <Icon name="error" className="text-[15px]" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-card border border-[#FDA29B] bg-[#FFFBFA] p-4 text-[14px] font-medium text-[#B42318]"
    >
      <Icon name="error" className="text-[18px]" />
      {children}
    </p>
  );
}

function inputClass(error?: string): string {
  return [
    "h-11 w-full rounded-input border bg-white px-3 text-[15px] text-ink outline-none",
    "transition-colors placeholder:text-ink-faint focus:border-brand-800",
    error ? "border-[#D92D20]" : "border-line-strong",
  ].join(" ");
}
