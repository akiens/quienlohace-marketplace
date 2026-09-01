"use client";

import { useActionState, useMemo, useState } from "react";

import { saveProfile } from "@/app/actions/profile";
import type { FormState } from "@/app/actions/auth";
import { CATEGORIES } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import { limitFor } from "@/domain/plans";
import { Button, Icon } from "@/components/ui";
import { LocationPicker } from "@/components/dashboard/location-picker";
import {
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type PlanLimits,
  type Provider,
  type ServiceMode,
} from "@/types";

const PAYMENT_OPTIONS: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Otros",
];

const SERVICE_MODES: ServiceMode[] = [
  "on_site",
  "at_business",
  "remote",
  "hybrid",
];

/**
 * Etapas del onboarding (RF-166 a RF-171).
 *
 * El formulario es uno solo: se envía completo y se valida entero en el
 * servidor. Las etapas sólo controlan qué se ve, para no enfrentar a un
 * proveedor nuevo con veinte campos de golpe. Los campos ocultos siguen en
 * el DOM, así que cambiar de paso nunca pierde lo escrito.
 */
const STEPS = [
  { id: "identidad", label: "Identidad", icon: "badge" },
  { id: "rubro", label: "Rubro", icon: "category" },
  { id: "zonas", label: "Ubicación", icon: "location_on" },
  { id: "contacto", label: "Contacto", icon: "call" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function ProfileForm({
  provider,
  plan,
}: {
  provider: Provider | null;
  plan: PlanLimits;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveProfile,
    {},
  );

  const [step, setStep] = useState<StepId>("identidad");
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
  const [name, setName] = useState(provider?.name ?? "");
  const [description, setDescription] = useState(provider?.description ?? "");
  const [whatsapp, setWhatsapp] = useState(provider?.whatsapp ?? "");
  const [phone, setPhone] = useState(provider?.phone ?? "");

  const errors = state.errors ?? {};
  const maxServices = limitFor(plan, "services");
  const maxAreas = limitFor(plan, "serviceAreas");

  /**
   * Qué falta para poder publicar (RF-172). Se calcula acá para que el
   * proveedor vea el estado real mientras completa, en vez de descubrirlo
   * recién al guardar.
   */
  const completion = useMemo(() => {
    const filledServices = services.filter((s) => s.trim().length > 0);
    return {
      identidad: name.trim().length >= 2 && description.trim().length >= 20,
      rubro: subcategoryId !== "" && filledServices.length > 0,
      zonas: locationId !== "" && serviceAreaIds.length > 0,
      contacto: whatsapp.trim().length > 0 || phone.trim().length > 0,
    } satisfies Record<StepId, boolean>;
  }, [
    name,
    description,
    subcategoryId,
    services,
    locationId,
    serviceAreaIds,
    whatsapp,
    phone,
  ]);

  const missing = STEPS.filter((s) => !completion[s.id]);

  // Un error del servidor puede referirse a un paso que no está a la vista;
  // este mapa permite señalarlo en la barra de pasos.
  const stepHasError: Record<StepId, boolean> = {
    identidad: Boolean(errors.name || errors.description || errors.kind),
    rubro: Boolean(errors.subcategoryId || errors.services),
    zonas: Boolean(errors.locationId || errors.serviceAreaIds),
    contacto: Boolean(
      errors.phone || errors.whatsapp || errors.schedule || errors.paymentMethods,
    ),
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.message ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-card border border-[#D6EFE0] bg-[#F4FBF7] px-4 py-3 text-[14px] font-medium text-[#1E8C56]"
        >
          <Icon name="check_circle" filled className="text-[18px]" />
          {state.message}
        </p>
      ) : null}

      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <StepBar
        current={step}
        completion={completion}
        hasError={stepHasError}
        onSelect={setStep}
      />

      <div className="rounded-card border border-line bg-white">
        {/* Cada panel se oculta con `hidden`, no se desmonta: los valores
            siguen en el formulario aunque el paso no esté a la vista. */}
        <Panel active={step === "identidad"}>
          <Row>
            <Field label="Nombre del perfil" error={errors.name} required half>
              <input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                placeholder="Ej.: Electricidad Pérez"
                className={inputClass(errors.name)}
              />
            </Field>

            <Field label="Tipo" error={errors.kind} half>
              <select
                name="kind"
                defaultValue={provider?.kind ?? "individual"}
                className={inputClass(errors.kind)}
              >
                <option value="individual">Profesional independiente</option>
                <option value="business">Empresa / equipo</option>
              </select>
            </Field>
          </Row>

          <Field
            label="Descripción"
            error={errors.description}
            hint={`${description.trim().length}/600 · mínimo 20 caracteres`}
            required
          >
            <textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={4}
              maxLength={600}
              placeholder="Contá en pocas líneas qué hacés, tu experiencia y qué te diferencia."
              className={`${inputClass(errors.description)} h-auto resize-y py-2.5 leading-relaxed`}
            />
          </Field>
        </Panel>

        <Panel active={step === "rubro"}>
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
            hint={`Lo que ofrecés concretamente. Tu plan ${plan.name} permite hasta ${maxServices}.`}
            required
            counter={`${services.filter((s) => s.trim()).length}/${maxServices}`}
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
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-input border border-line-strong text-ink-soft transition-colors hover:bg-surface-muted"
                    >
                      <Icon name="close" className="text-[18px]" />
                    </button>
                  ) : null}
                </div>
              ))}

              {services.length < maxServices ? (
                <button
                  type="button"
                  onClick={() => setServices([...services, ""])}
                  className="flex items-center gap-1.5 self-start text-[14px] font-semibold text-brand-800 hover:underline"
                >
                  <Icon name="add" className="text-[18px]" />
                  Agregar servicio
                </button>
              ) : (
                <PlanHint planName={plan.name} what="servicios" limit={maxServices} />
              )}
            </div>
          </Field>
        </Panel>

        <Panel active={step === "zonas"}>
          <Row>
            <Field
              label="Dónde estás ubicado"
              error={errors.locationId}
              required
              half
            >
              <LocationPicker
                name="locationId"
                value={locationId}
                onChange={setLocationId}
              />
            </Field>

            <Field label="Modalidad" error={errors.serviceMode} half>
              <select
                name="serviceMode"
                defaultValue={provider?.serviceMode ?? "on_site"}
                className={inputClass(errors.serviceMode)}
              >
                {SERVICE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {SERVICE_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </Field>
          </Row>

          <Field
            label="Zonas donde trabajás"
            error={errors.serviceAreaIds}
            hint="Puede ser distinto de dónde estás ubicado."
            required
            counter={`${serviceAreaIds.length}/${maxAreas}`}
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
                          setServiceAreaIds(
                            serviceAreaIds.filter((x) => x !== id),
                          )
                        }
                      >
                        <Icon name="close" className="text-[15px] text-[#5B6B87]" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              {serviceAreaIds.length < maxAreas ? (
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
                <PlanHint planName={plan.name} what="zonas" limit={maxAreas} />
              )}
            </div>
          </Field>
        </Panel>

        <Panel active={step === "contacto"}>
          <Row>
            <Field
              label="WhatsApp"
              error={errors.whatsapp}
              hint="Sólo números, con código de país."
              half
            >
              <input
                name="whatsapp"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                inputMode="numeric"
                maxLength={20}
                className={inputClass(errors.whatsapp)}
                placeholder="59899123456"
              />
            </Field>

            <Field label="Teléfono" error={errors.phone} half>
              <input
                name="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
                className={inputClass(errors.phone)}
                placeholder="099 123 456"
              />
            </Field>
          </Row>

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
        </Panel>

        <Footer
          step={step}
          onStep={setStep}
          pending={pending}
          missing={missing.map((s) => s.label)}
        />
      </div>
    </form>
  );
}

/** Barra de pasos: dice dónde estás, qué falta y dónde hay un error. */
function StepBar({
  current,
  completion,
  hasError,
  onSelect,
}: {
  current: StepId;
  completion: Record<StepId, boolean>;
  hasError: Record<StepId, boolean>;
  onSelect: (id: StepId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STEPS.map((step) => {
        const active = step.id === current;
        const done = completion[step.id];
        const failed = hasError[step.id];

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={active ? "step" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-input border px-3 py-2.5 text-[13.5px] font-semibold transition-colors sm:flex-none sm:px-4 ${
              active
                ? "border-brand-800 bg-brand-800 text-white"
                : failed
                  ? "border-[#FDA29B] bg-[#FFFBFA] text-[#B42318]"
                  : "border-line-strong bg-white text-ink-muted hover:border-[#C6CEDC] hover:bg-surface-muted"
            }`}
          >
            <Icon
              name={failed ? "error" : done ? "check_circle" : step.icon}
              filled={done && !failed}
              className={`text-[17px] ${
                active
                  ? "text-white"
                  : failed
                    ? "text-[#B42318]"
                    : done
                      ? "text-[#1E8C56]"
                      : "text-ink-faint"
              }`}
            />
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pie con navegación entre pasos y el guardado. */
function Footer({
  step,
  onStep,
  pending,
  missing,
}: {
  step: StepId;
  onStep: (id: StepId) => void;
  pending: boolean;
  missing: string[];
}) {
  const index = STEPS.findIndex((s) => s.id === step);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-line-soft bg-surface-muted px-5 py-3.5">
      {previous ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onStep(previous.id)}
        >
          <Icon name="arrow_back" className="text-[17px]" />
          {previous.label}
        </Button>
      ) : null}

      {next ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onStep(next.id)}
        >
          {next.label}
          <Icon name="arrow_forward" className="text-[17px]" />
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {missing.length > 0 ? (
          <span className="text-[12.5px] text-ink-soft">
            Falta completar: {missing.join(", ")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1E8C56]">
            <Icon name="check_circle" filled className="text-[15px]" />
            Listo para publicar
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel de un paso.
 *
 * Se oculta con `hidden:` de Tailwind y no con el atributo `hidden`: la clase
 * `flex` define `display`, y ganaría sobre el atributo dejando el panel a la
 * vista. Los campos siguen montados, así que cambiar de paso no pierde nada.
 */
function Panel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${active ? "flex" : "hidden"} flex-col gap-4 p-5`}>
      {children}
    </div>
  );
}

/** Dos campos por fila en pantallas anchas; apilados en móvil. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  error,
  hint,
  required = false,
  half = false,
  counter,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  half?: boolean;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${half ? "" : "w-full"}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-ink-muted">
          {label}
          {required ? <span className="text-[#B42318]"> *</span> : null}
        </span>
        {counter ? (
          <span className="text-[12px] tabular-nums text-ink-faint">
            {counter}
          </span>
        ) : null}
      </span>

      {children}

      {error ? (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]">
          <Icon name="error" className="text-[15px]" />
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12.5px] text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/** Aviso al tocar el techo del plan, con la vía para ampliarlo (RF-171). */
function PlanHint({
  planName,
  what,
  limit,
}: {
  planName: string;
  what: string;
  limit: number;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 rounded-input bg-surface-muted px-3 py-2 text-[12.5px] text-ink-soft">
      <Icon name="info" className="text-[15px] text-ink-faint" />
      Tu plan {planName} permite hasta {limit} {what}.
      <a href="/planes" className="font-semibold text-brand-800 hover:underline">
        Ver planes
      </a>
    </p>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-card border border-[#FDA29B] bg-[#FFFBFA] px-4 py-3 text-[14px] font-medium text-[#B42318]"
    >
      <Icon name="error" className="text-[18px]" />
      {children}
    </p>
  );
}

function inputClass(error?: string): string {
  return `h-11 w-full rounded-input border bg-white px-3.5 text-[14.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-800 ${
    error ? "border-[#FDA29B]" : "border-line-strong"
  }`;
}
