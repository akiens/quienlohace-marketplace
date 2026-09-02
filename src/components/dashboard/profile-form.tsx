"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { saveProfile } from "@/app/actions/profile";
import {
  clearProfileDraft,
  profileDraftServerSnapshot,
  profileDraftSnapshot,
  subscribeProfileDraft,
  writeProfileDraft,
  type ProfileDraft,
} from "@/lib/profile-draft";
import type { FormState } from "@/app/actions/auth";
import { CATEGORIES } from "@/data/categories";
import { locationLabelById, locationLevelLabel } from "@/data/locations";
import { allowsFeature, formatPrice, limitFor } from "@/domain/plans";
import { Button, Icon } from "@/components/ui";
import { LocationPicker } from "@/components/dashboard/location-picker";
import {
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type PlanLimits,
  type Provider,
  type SocialPlatform,
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
const ALL_STEPS = [
  { id: "identidad", label: "Identidad", icon: "badge", feature: null },
  { id: "rubro", label: "Rubro", icon: "category", feature: null },
  { id: "zonas", label: "Ubicación", icon: "location_on", feature: null },
  { id: "contacto", label: "Contacto", icon: "call", feature: null },
  { id: "galeria", label: "Galería", icon: "photo_library", feature: "gallery" },
  { id: "redes", label: "Redes", icon: "share", feature: "social" },
  { id: "equipo", label: "Equipo", icon: "groups", feature: "team" },
  { id: "pago", label: "Pago", icon: "credit_card", feature: "paid" },
] as const;

type StepId = (typeof ALL_STEPS)[number]["id"];

/** Las redes que ofrece el formulario, en el orden en que se muestran. */
const SOCIAL_FIELDS: Array<{ platform: SocialPlatform; label: string }> = [
  { platform: "instagram", label: "Instagram" },
  { platform: "facebook", label: "Facebook" },
  { platform: "website", label: "Sitio web" },
  { platform: "linkedin", label: "LinkedIn" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "youtube", label: "YouTube" },
  { platform: "x", label: "X" },
];

/**
 * Lee el borrador y monta el formulario con él.
 *
 * El borrador vive en `localStorage`, que en el servidor no existe: si los
 * campos arrancaran con lo guardado, el HTML del servidor —siempre vacío— y
 * el primer render del cliente dirían cosas distintas y React abortaría la
 * hidratación.
 *
 * `useSyncExternalStore` da primero el snapshot del servidor (vacío, igual
 * que el HTML) y después el del cliente. La `key` hace que al aparecer el
 * borrador el formulario se monte de nuevo, ya con los valores en su estado
 * inicial: hidratación limpia y campos completos, sin un efecto que los vaya
 * llenando de a uno.
 */
export function ProfileForm({
  provider,
  plan,
}: {
  provider: Provider | null;
  plan: PlanLimits;
}) {
  const stored = useSyncExternalStore(
    subscribeProfileDraft,
    profileDraftSnapshot,
    profileDraftServerSnapshot,
  );

  // Con perfil manda la base y el borrador no interviene.
  const draft = provider ? null : stored;

  return (
    <ProfileFormFields
      key={draft ? "con-borrador" : "sin-borrador"}
      provider={provider}
      plan={plan}
      draft={draft}
    />
  );
}

function ProfileFormFields(props: {
  provider: Provider | null;
  plan: PlanLimits;
  draft: ProfileDraft | null;
}) {
  const { provider, plan } = props;

  const [state, action, pending] = useActionState<FormState, FormData>(
    saveProfile,
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);

  /*
   * Ya resuelto por quien monta este componente, que además lo usa como
   * `key`: acá el borrador es fijo y los campos pueden arrancar con él.
   */
  const draft = props.draft;

  const [requestedStep, setRequestedStep] = useState<StepId>(() =>
    // Volver al paso donde se estaba: reanudar desde el principio obligaría a
    // recorrer de nuevo todo lo ya completado.
    draft?.step && ALL_STEPS.some((s) => s.id === draft.step)
      ? (draft.step as StepId)
      : "identidad",
  );

  /*
   * Sólo se muestran los pasos que el plan habilita: a quien tiene Cobre no
   * le sirve ver tres pasos que no puede usar. Lo que ya estaba cargado no se
   * pierde por dejar de verse — sigue guardado e inactivo (RF-053).
   */
  const STEPS = useMemo(
    () =>
      ALL_STEPS.filter((step) => {
        if (!step.feature) return true;
        // El paso de pago no depende de una capacidad sino del precio.
        if (step.feature === "paid") return plan.priceCents > 0;
        return allowsFeature(plan, step.feature);
      }),
    [plan],
  );
  // Sólo servicios confirmados: la fila en blanco dejó de existir cuando
  // pasaron a agregarse de a uno, como las zonas.
  const [services, setServices] = useState<string[]>(
    draft?.services ?? provider?.services ?? [],
  );
  /** Lo tipeado que todavía no se confirmó. */
  const [pendingService, setPendingService] = useState("");
  const [duplicateService, setDuplicateService] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState(
    draft?.subcategoryId ?? provider?.subcategoryId ?? "",
  );
  const [locationId, setLocationId] = useState(
    draft?.locationId ?? provider?.locationId ?? "",
  );
  const [extraSubcategoryIds, setExtraSubcategoryIds] = useState<string[]>(
    draft?.subcategoryIds ?? provider?.subcategoryIds ?? [],
  );
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>(
    draft?.serviceAreaIds ?? provider?.serviceAreaIds ?? [],
  );
  /** La última zona repetida que se intentó agregar, para avisarlo. */
  const [duplicateArea, setDuplicateArea] = useState<string | null>(null);
  /** La subcategoría elegida que todavía no se confirmó. */
  const [pendingSubcategoryId, setPendingSubcategoryId] = useState("");
  const [duplicateSubcategory, setDuplicateSubcategory] = useState<
    string | null
  >(null);
  const [name, setName] = useState(draft?.name ?? provider?.name ?? "");
  const [description, setDescription] = useState(
    draft?.description ?? provider?.description ?? "",
  );
  const [phone, setPhone] = useState(draft?.phone ?? provider?.phone ?? "");
  // Alcanza con saber si hay al menos una red cargada, no cuál.
  const [socialTouched, setSocialTouched] = useState(
    Object.keys(draft?.socialLinks ?? {}).length > 0 ||
      (provider?.socialLinks?.length ?? 0) > 0,
  );
  const [teamMembers, setTeamMembers] = useState<TeamRow[]>(
    draft?.teamMembers?.map((member) => ({
      name: member.name ?? "",
      role: member.role ?? "",
      subtitle: member.subtitle ?? "",
      bio: member.bio ?? "",
    })) ??
      provider?.teamMembers?.map((member) => ({
        name: member.name,
        role: member.role,
        subtitle: member.subtitle,
        bio: member.bio,
      })) ??
      [],
  );
  // Por defecto sí: en el rubro casi todos atienden por WhatsApp.
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    draft?.whatsappEnabled ?? provider?.whatsappEnabled ?? true,
  );

  const errors = state.errors ?? {};
  const maxServices = limitFor(plan, "services");
  const maxAreas = limitFor(plan, "serviceAreas");
  const maxSubcategories = limitFor(plan, "subcategories");

  /**
   * Qué falta para poder publicar (RF-172). Se calcula acá para que el
   * proveedor vea el estado real mientras completa, en vez de descubrirlo
   * recién al guardar.
   */
  /*
   * Los campos no controlados (tipo, modalidad, horarios, formas de pago,
   * redes) no tienen estado en React: su valor vive en el DOM, así que el
   * borrador se les aplica escribiéndolos una vez montado el formulario.
   *
   * Los controlados no pasan por acá: arrancan del borrador en su propio
   * `useState`, sin un render extra.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!draft || !form) return;

    const setField = (name: string, value: string) => {
      const field = form.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) {
        field.value = value;
      }
    };

    if (draft.kind) setField("kind", draft.kind);
    if (draft.serviceMode) setField("serviceMode", draft.serviceMode);
    if (draft.schedule) setField("schedule", draft.schedule);

    for (const [platform, url] of Object.entries(draft.socialLinks ?? {})) {
      if (url) setField(`social_${platform}`, url);
    }

    if (draft.paymentMethods?.length) {
      const chosen = new Set(draft.paymentMethods);
      for (const box of form.querySelectorAll<HTMLInputElement>(
        'input[name="paymentMethods"]',
      )) {
        box.checked = chosen.has(box.value);
      }
    }
  }, [draft]);

  /**
   * Confirma el servicio tipeado. Vacío no agrega nada y repetido avisa, en
   * vez de descartarse en silencio como pasaba con las zonas.
   */
  function addService() {
    const value = pendingService.trim();
    if (!value) return;
    if (services.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDuplicateService(value);
      return;
    }
    setDuplicateService(null);
    setServices([...services, value]);
    setPendingService("");
  }

  const completion = useMemo(() => {
    return {
      identidad: name.trim().length >= 2 && description.trim().length >= 20,
      rubro: subcategoryId !== "" && services.length > 0,
      zonas: locationId !== "" && serviceAreaIds.length > 0,
      contacto: phone.trim().length > 0,
      /*
       * Estos pasos son opcionales, pero el tilde verde tiene que querer
       * decir "hay algo cargado". Marcarlos siempre como hechos haría que el
       * recorrido apareciera casi completo sin haber escrito nada.
       */
      galeria: false,
      redes: socialTouched,
      equipo: teamMembers.length > 0,
      // El cobro todavía no existe, así que nunca se da por hecho.
      pago: false,
    } satisfies Record<StepId, boolean>;
  }, [
    name,
    description,
    subcategoryId,
    services,
    locationId,
    serviceAreaIds,
    phone,
    socialTouched,
    teamMembers,
  ]);

  /*
   * Al bajar de plan el paso donde se estaba puede dejar de existir (por
   * ejemplo Equipo al pasar de Platino a Cobre). En ese caso se retrocede al
   * anterior que siga disponible y que todavía no esté completo; si están
   * todos completos, al último disponible.
   *
   * Se deriva en vez de corregirse desde un efecto: así nunca hay un render
   * intermedio apuntando a un paso que ya no se muestra, que es lo que
   * dejaba el formulario en blanco y sin ningún paso marcado.
   */
  const step: StepId = useMemo(() => {
    if (STEPS.some((s) => s.id === requestedStep)) return requestedStep;

    const position = ALL_STEPS.findIndex((s) => s.id === requestedStep);
    const earlier = STEPS.filter(
      (s) => ALL_STEPS.findIndex((a) => a.id === s.id) < position,
    );

    const pending = earlier.find((s) => !completion[s.id]);
    return pending?.id ?? earlier[earlier.length - 1]?.id ?? "identidad";
  }, [requestedStep, STEPS, completion]);

  const setStep = setRequestedStep;

  /*
   * Guarda el borrador cada vez que cambia algo. Los campos no controlados se
   * leen del DOM en el momento, que es donde está su valor.
   *
   * Sólo durante el alta: con perfil creado la base ya guarda todo y un
   * borrador paralelo sólo podría contradecirla.
   */
  useEffect(() => {
    if (provider) return;

    const form = formRef.current;
    const read = (name: string): string => {
      const field = form?.elements.namedItem(name);
      return field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
        ? field.value
        : "";
    };

    const socialLinks: Record<string, string> = {};
    for (const field of SOCIAL_FIELDS) {
      const url = read(`social_${field.platform}`);
      if (url) socialLinks[field.platform] = url;
    }

    const paymentMethods = form
      ? Array.from(
          form.querySelectorAll<HTMLInputElement>(
            'input[name="paymentMethods"]:checked',
          ),
          (box) => box.value,
        )
      : [];

    writeProfileDraft({
      step,
      name,
      kind: read("kind"),
      description,
      subcategoryId,
      subcategoryIds: extraSubcategoryIds,
      services,
      locationId,
      serviceMode: read("serviceMode") as ServiceMode,
      serviceAreaIds,
      phone,
      whatsappEnabled,
      schedule: read("schedule"),
      paymentMethods,
      socialLinks,
      teamMembers,
    });
  }, [
    provider,
    step,
    name,
    description,
    subcategoryId,
    extraSubcategoryIds,
    services,
    locationId,
    serviceAreaIds,
    phone,
    whatsappEnabled,
    teamMembers,
    socialTouched,
  ]);

  /*
   * Guardado: el borrador cumplió su función y se descarta. Dejarlo haría que
   * una recarga posterior reviviera datos viejos por encima de los guardados.
   */
  useEffect(() => {
    if (state.message && !state.errors) clearProfileDraft();
  }, [state.message, state.errors]);


  /*
   * Sólo los pasos obligatorios cuentan para habilitar el botón. Galería,
   * redes, equipo y pago son opcionales: el perfil se publica sin ellos.
   */
  const REQUIRED_STEPS: StepId[] = ["identidad", "rubro", "zonas", "contacto"];
  const missing = STEPS.filter(
    (s) => REQUIRED_STEPS.includes(s.id) && !completion[s.id],
  );
  /*
   * El botón se habilita cuando están los datos con los que el perfil ya
   * puede publicarse, sin importar el plan. El pago no entra todavía: sin
   * cobro implementado, exigirlo dejaría a los planes pagos sin poder crear
   * el perfil.
   */
  const canSubmit = missing.length === 0;

  // Un error del servidor puede referirse a un paso que no está a la vista;
  // este mapa permite señalarlo en la barra de pasos.
  const stepHasError: Record<StepId, boolean> = {
    identidad: Boolean(errors.name || errors.description || errors.kind),
    rubro: Boolean(errors.subcategoryId || errors.services),
    zonas: Boolean(errors.locationId || errors.serviceAreaIds),
    contacto: Boolean(
      errors.phone || errors.whatsapp || errors.schedule || errors.paymentMethods,
    ),
    galeria: false,
    redes: Boolean(errors.socialLinks),
    equipo: Boolean(errors.teamMembers),
    pago: false,
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      {/*
        El plan con el que se crea el perfil. Sólo cuenta la primera vez: si
        el perfil ya existe, el servidor usa el suyo y descarta este valor.
      */}
      <input type="hidden" name="planId" value={plan.id} />

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
        steps={STEPS}
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

          {maxSubcategories > 1 ? (
            <Field
              label="Otras subcategorías"
              error={errors.subcategoryIds}
              hint={`Si trabajás en más de un rubro. Tu plan ${plan.name} permite hasta ${maxSubcategories}.`}
              counter={`${extraSubcategoryIds.length + 1}/${maxSubcategories}`}
              group
            >
              <div className="flex flex-col gap-2.5">
                {extraSubcategoryIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {extraSubcategoryIds.map((id) => (
                      <ItemChip
                        key={id}
                        name="subcategoryIds"
                        value={id}
                        label={subcategoryLabel(id)}
                        onRemove={() =>
                          setExtraSubcategoryIds(
                            extraSubcategoryIds.filter((x) => x !== id),
                          )
                        }
                      />
                    ))}
                  </div>
                ) : null}

                {/* +1: la principal también cuenta contra el tope del plan. */}
                {extraSubcategoryIds.length + 1 < maxSubcategories ? (
                  <>
                    {/*
                      Elegir y agregar en dos pasos, igual que las zonas: antes
                      el select agregaba solo al cambiar y no había forma de
                      mirar la opción antes de confirmarla.
                    */}
                    <select
                      aria-label="Otra subcategoría"
                      value={pendingSubcategoryId}
                      onChange={(event) =>
                        setPendingSubcategoryId(event.target.value)
                      }
                      className={inputClass(undefined)}
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

                    <AddButton
                      label="Agregar subcategoría"
                      onClick={() => {
                        const id = pendingSubcategoryId;
                        if (!id) return;
                        if (
                          id === subcategoryId ||
                          extraSubcategoryIds.includes(id)
                        ) {
                          setDuplicateSubcategory(id);
                          return;
                        }
                        setDuplicateSubcategory(null);
                        setExtraSubcategoryIds([...extraSubcategoryIds, id]);
                        setPendingSubcategoryId("");
                      }}
                    />

                    {duplicateSubcategory ? (
                      <p
                        role="alert"
                        className="text-[13px] font-medium text-[#B42318]"
                      >
                        Ya agregaste {subcategoryLabel(duplicateSubcategory)}.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <PlanHint
                    planName={plan.name}
                    what="subcategorías"
                    limit={maxSubcategories}
                  />
                )}
              </div>
            </Field>
          ) : null}

          <Field
            label="Servicios"
            error={errors.services}
            hint={`Lo que ofrecés concretamente. Tu plan ${plan.name} permite hasta ${maxServices}.`}
            required
            counter={`${services.length}/${maxServices}`}
            group
          >
            <div className="flex flex-col gap-2.5">
              {services.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {services.map((service) => (
                    <ItemChip
                      key={service}
                      name="services"
                      value={service}
                      label={service}
                      onRemove={() => {
                        setServices(services.filter((x) => x !== service));
                        if (duplicateService === service) {
                          setDuplicateService(null);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {services.length < maxServices ? (
                <>
                  <input
                    aria-label="Servicio"
                    value={pendingService}
                    onChange={(event) => setPendingService(event.target.value)}
                    // Enter agrega en vez de enviar el formulario entero.
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addService();
                      }
                    }}
                    maxLength={60}
                    placeholder="Ej.: Instalaciones eléctricas"
                    className={inputClass(undefined)}
                  />

                  <AddButton label="Agregar servicio" onClick={addService} />

                  {duplicateService ? (
                    <p
                      role="alert"
                      className="text-[13px] font-medium text-[#B42318]"
                    >
                      Ya agregaste {duplicateService}.
                    </p>
                  ) : null}
                </>
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
              hint="Precisá hasta donde quieras: alcanza con el departamento."
              required
              half
              group
            >
              <LocationPicker
                name="locationId"
                value={locationId}
                onChange={setLocationId}
              />
            </Field>

            <Field label="Modalidad" error={errors.serviceMode} half group>
              {/*
                El campo de al lado rotula cada selector por dentro
                («Departamento», «Localidad»…). Sin un rótulo acá los dos
                controles arrancarían a distinta altura, así que este dice
                qué se elige y de paso empareja las filas.
              */}
              <label
                htmlFor="serviceMode"
                className="text-[12.5px] font-semibold text-ink-muted"
              >
                Cómo trabajás
              </label>
              <select
                id="serviceMode"
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
            hint="Puede ser distinto de dónde estás ubicado. Precisá hasta donde quieras y tocá «Agregar zona»."
            required
            counter={`${serviceAreaIds.length}/${maxAreas}`}
            group
          >
            <div className="flex flex-col gap-2.5">
              {serviceAreaIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {serviceAreaIds.map((id) => (
                    <ItemChip
                      key={id}
                      name="serviceAreaIds"
                      value={id}
                      label={locationLabelById(id)}
                      detail={locationLevelLabel(id)}
                      onRemove={() => {
                        setServiceAreaIds(
                          serviceAreaIds.filter((x) => x !== id),
                        );
                        // Quitarla despeja el aviso: ya no está repetida.
                        if (duplicateArea === id) setDuplicateArea(null);
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {serviceAreaIds.length < maxAreas ? (
                <>
                  <LocationPicker
                    value=""
                    onChange={(id) => {
                      if (!id) return;
                      /*
                       * Repetir una zona no agrega nada y antes se descartaba
                       * en silencio: se veía como si el botón no funcionara.
                       */
                      if (serviceAreaIds.includes(id)) {
                        setDuplicateArea(id);
                        return;
                      }
                      setDuplicateArea(null);
                      setServiceAreaIds([...serviceAreaIds, id]);
                    }}
                    addMode
                  />
                  {duplicateArea ? (
                    <p
                      role="alert"
                      className="text-[13px] font-medium text-[#B42318]"
                    >
                      Ya agregaste {locationLabelById(duplicateArea)}.
                    </p>
                  ) : null}
                </>
              ) : (
                <PlanHint planName={plan.name} what="zonas" limit={maxAreas} />
              )}
            </div>
          </Field>
        </Panel>

        <Panel active={step === "contacto"}>
          {/*
            Un solo número: de él salen el enlace de llamada y el de WhatsApp
            (RF-013). Antes se pedía dos veces el mismo dato y podían quedar
            distintos.
          */}
          <Field
            label="Teléfono"
            error={errors.phone}
            hint="Con característica. Ej: 099 123 456"
          >
            <input
              name="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              className={inputClass(errors.phone)}
              placeholder="099 123 456"
            />
          </Field>

          <label className="flex items-center gap-2.5 text-[14px] text-ink-muted">
            <input
              type="checkbox"
              name="whatsappEnabled"
              checked={whatsappEnabled}
              onChange={(event) => setWhatsappEnabled(event.target.checked)}
              className="h-4 w-4 accent-brand-800"
            />
            Este número recibe WhatsApp
          </label>

          <Field label="Horarios" error={errors.schedule}>
            <input
              name="schedule"
              defaultValue={provider?.schedule ?? ""}
              maxLength={160}
              className={inputClass(errors.schedule)}
              placeholder="Lunes a viernes · 9:00 a 18:00"
            />
          </Field>

          <Field label="Formas de pago" error={errors.paymentMethods} group>
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

        {allowsFeature(plan, "gallery") ? (
          <Panel active={step === "galeria"}>
            <Field
              label="Galería de trabajos"
              hint={`Tu plan ${plan.name} permite hasta ${limitFor(plan, "galleryImages")} imágenes.`}
            >
              {/*
                La subida vive en su propia acción porque un archivo no puede
                viajar en el mismo envío que el resto del formulario sin
                perderse al recargar. Hasta que exista, se avisa.
              */}
              <p className="rounded-input border border-dashed border-line-strong bg-surface-muted px-4 py-6 text-center text-[13.5px] text-ink-soft">
                La carga de imágenes se habilita cuando termines de completar
                el perfil y lo guardes.
              </p>
            </Field>
          </Panel>
        ) : null}

        {allowsFeature(plan, "social") ? (
          <Panel active={step === "redes"}>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Dejá vacías las que no uses. Se muestran en tu perfil público.
            </p>
            {SOCIAL_FIELDS.map((field) => (
              <Field
                key={field.platform}
                label={field.label}
                error={errors[`socialLinks.${field.platform}`]}
              >
                <input
                  name={`social_${field.platform}`}
                  defaultValue={
                    provider?.socialLinks?.find(
                      (link) => link.platform === field.platform,
                    )?.url ?? ""
                  }
                  type="url"
                  maxLength={300}
                  placeholder="https://"
                  onInput={(event) =>
                    setSocialTouched(
                      event.currentTarget.value.trim().length > 0 ||
                        socialTouched,
                    )
                  }
                  className={inputClass(undefined)}
                />
              </Field>
            ))}
          </Panel>
        ) : null}

        {allowsFeature(plan, "team") ? (
          <Panel active={step === "equipo"}>
            <TeamEditor
              members={teamMembers}
              onChange={setTeamMembers}
              max={limitFor(plan, "teamMembers")}
              planName={plan.name}
            />
          </Panel>
        ) : null}

        {plan.priceCents > 0 ? (
          <Panel active={step === "pago"}>
            <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line-strong bg-surface-muted p-6">
              <span className="flex items-center gap-2 text-[15px] font-bold text-ink">
                <Icon name="credit_card" className="text-[20px] text-brand-800" />
                Pago del plan {plan.name}
              </span>
              <p className="text-[14px] leading-relaxed text-ink-soft">
                El cobro todavía no está disponible. Mientras tanto podés crear
                y publicar tu perfil igual: cuando habilitemos los pagos te
                avisamos para completar la suscripción.
              </p>
              <span className="text-[19px] font-bold tracking-[-.4px] text-ink">
                {formatPrice(plan)}
              </span>
            </div>
          </Panel>
        ) : null}

        <Footer
          steps={STEPS}
          step={step}
          onStep={setStep}
          pending={pending}
          canSubmit={canSubmit}
          isNew={provider === null}
          missing={missing.map((s) => s.label)}
        />
      </div>
    </form>
  );
}

/** Nombre legible de una subcategoría; su id si no se encuentra. */
function subcategoryLabel(id: string): string {
  for (const category of CATEGORIES) {
    const found = category.subcategories.find((sub) => sub.id === id);
    if (found) return found.name;
  }
  return id;
}

/** Fila del editor de equipo: lo que se escribe, sin id todavía. */
type TeamRow = { name: string; role: string; subtitle: string; bio: string };

/**
 * Editor de integrantes (RF-016).
 *
 * Los campos van como listas paralelas (`teamName`, `teamRole`…): la acción
 * las vuelve a unir por posición. Es lo que permite mandar un número variable
 * de filas en un formulario normal.
 */
function TeamEditor({
  members,
  onChange,
  max,
  planName,
}: {
  members: TeamRow[];
  onChange: (rows: TeamRow[]) => void;
  max: number;
  planName: string;
}) {
  const update = (index: number, patch: Partial<TeamRow>) => {
    onChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] leading-relaxed text-ink-soft">
        Quiénes trabajan con vos. Tu plan {planName} permite hasta {max}.
      </p>

      {members.map((member, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface-muted p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">
              Integrante {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(members.filter((_, i) => i !== index))}
              aria-label={`Quitar integrante ${index + 1}`}
              className="rounded-input p-1 text-ink-soft hover:bg-white"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>

          <Row>
            <Field label="Nombre" half required>
              <input
                name="teamName"
                value={member.name}
                onChange={(event) => update(index, { name: event.target.value })}
                maxLength={80}
                className={inputClass(undefined)}
              />
            </Field>
            <Field label="Título" half>
              <input
                name="teamRole"
                value={member.role}
                onChange={(event) => update(index, { role: event.target.value })}
                maxLength={80}
                placeholder="Ej.: Electricista"
                className={inputClass(undefined)}
              />
            </Field>
          </Row>

          <Field label="Subtítulo">
            <input
              name="teamSubtitle"
              value={member.subtitle}
              onChange={(event) =>
                update(index, { subtitle: event.target.value })
              }
              maxLength={80}
              placeholder="Ej.: 10 años de experiencia"
              className={inputClass(undefined)}
            />
          </Field>

          <Field label="Descripción">
            <textarea
              name="teamBio"
              value={member.bio}
              onChange={(event) => update(index, { bio: event.target.value })}
              rows={2}
              maxLength={300}
              className={`${inputClass(undefined)} h-auto resize-y py-2.5 leading-relaxed`}
            />
          </Field>
        </div>
      ))}

      {members.length < max ? (
        <button
          type="button"
          onClick={() =>
            onChange([...members, { name: "", role: "", subtitle: "", bio: "" }])
          }
          className="flex items-center gap-1.5 self-start text-[14px] font-semibold text-brand-800 hover:underline"
        >
          <Icon name="add" className="text-[18px]" />
          Agregar integrante
        </button>
      ) : (
        <PlanHint planName={planName} what="integrantes" limit={max} />
      )}
    </div>
  );
}

/** Barra de pasos: dice dónde estás, qué falta y dónde hay un error. */
function StepBar({
  steps,
  current,
  completion,
  hasError,
  onSelect,
}: {
  /** Sólo los pasos que habilita el plan. */
  steps: ReadonlyArray<(typeof ALL_STEPS)[number]>;
  current: StepId;
  completion: Record<StepId, boolean>;
  hasError: Record<StepId, boolean>;
  onSelect: (id: StepId) => void;
}) {
  return (
    /*
     * Los pasos van unidos por una línea para que se lean como un recorrido y
     * no como pestañas sueltas. La línea vive detrás de los nodos (`-z-10`) y
     * se recorta a la altura del círculo.
     */
    <ol className="flex items-start overflow-x-auto pb-1">
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = completion[step.id];
        const failed = hasError[step.id];
        const previousDone = index > 0 && completion[steps[index - 1]!.id];

        return (
          <li
            key={step.id}
            className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5"
          >
            {/* Tramo que llega desde el paso anterior. */}
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-[18px] -z-10 h-0.5 w-full ${
                  previousDone ? "bg-[#7CC9A3]" : "bg-line-strong"
                }`}
              />
            ) : null}

            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={active ? "step" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                failed
                  ? "border-[#D92D20] bg-[#FFFBFA] text-[#B42318]"
                  : active
                    ? "border-brand-800 bg-brand-800 text-white"
                    : done
                      ? "border-[#1E8C56] bg-[#E8F6EF] text-[#1E8C56]"
                      : "border-line-strong bg-white text-ink-faint hover:border-[#C6CEDC]"
              }`}
            >
              <Icon
                name={failed ? "error" : done && !active ? "check" : step.icon}
                filled={done && !failed}
                className="text-[18px]"
              />
            </button>

            <span
              className={`px-1 text-center text-[12.5px] font-semibold leading-tight ${
                failed
                  ? "text-[#B42318]"
                  : active
                    ? "text-ink"
                    : done
                      ? "text-[#1E8C56]"
                      : "text-ink-soft"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Pie con navegación entre pasos y el guardado. */
function Footer({
  steps,
  step,
  onStep,
  pending,
  canSubmit,
  isNew,
  missing,
}: {
  steps: ReadonlyArray<(typeof ALL_STEPS)[number]>;
  step: StepId;
  onStep: (id: StepId) => void;
  pending: boolean;
  canSubmit: boolean;
  isNew: boolean;
  missing: string[];
}) {
  const index = steps.findIndex((s) => s.id === step);
  const previous = steps[index - 1];
  const next = steps[index + 1];

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
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
          {pending
            ? "Guardando…"
            : isNew
              ? "Crear perfil"
              : "Guardar cambios"}
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
  group = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  half?: boolean;
  counter?: string;
  /**
   * Para campos con más de un control adentro (varios selectores, una lista
   * de etiquetas con su botón de quitar).
   *
   * Un `<label>` sin `htmlFor` manda cualquier clic sobre él al primer control
   * que contenga. Envolviendo una lista, eso significaba que tocar el vacío
   * del campo apretaba el botón de quitar de la primera etiqueta y borraba
   * una zona sin que nadie la hubiera tocado. Un grupo se rinde como
   * `fieldset` y no reenvía nada.
   */
  group?: boolean;
  children: React.ReactNode;
}) {
  const heading = (
    <>
      <span className="text-[13.5px] font-semibold text-ink-muted">
        {label}
        {required ? <span className="text-[#B42318]"> *</span> : null}
      </span>
      {counter ? (
        <span className="text-[12px] tabular-nums text-ink-faint">
          {counter}
        </span>
      ) : null}
    </>
  );

  const footer = error ? (
    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]">
      <Icon name="error" className="text-[15px]" />
      {error}
    </span>
  ) : hint ? (
    <span className="text-[12.5px] text-ink-faint">{hint}</span>
  ) : null;

  const className = `flex flex-col gap-1.5 ${half ? "" : "w-full"}`;

  if (group) {
    return (
      <fieldset className={className}>
        {/* `legend` en flujo normal: no se quiere el corte del borde. */}
        <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2">
          {heading}
        </legend>
        {children}
        {footer}
      </fieldset>
    );
  }

  return (
    <label className={className}>
      <span className="flex items-baseline justify-between gap-2">
        {heading}
      </span>
      {children}
      {footer}
    </label>
  );
}

/**
 * Botón para sumar un elemento a una lista (zonas, subcategorías, servicios).
 *
 * Es blanco con borde, no del color de las etiquetas: cuando compartía el
 * `brand-100` de éstas parecía una etiqueta más en vez de la acción que las
 * agrega.
 */
function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1 self-start rounded-input border border-line-strong bg-white pl-1.5 pr-2.5 text-[13px] font-semibold text-brand-800 transition-colors hover:bg-surface-muted"
    >
      <Icon name="add" className="text-[16px]" />
      {label}
    </button>
  );
}

/**
 * Etiqueta de un elemento ya agregado, con su botón de quitar.
 *
 * Las tres listas del formulario se ven igual: lo agregado se lee de un
 * vistazo y se saca desde el mismo lugar.
 */
function ItemChip({
  name,
  value,
  label,
  detail,
  onRemove,
}: {
  /** Cuando se envía con el formulario, el campo que lo transporta. */
  name?: string;
  value: string;
  label: string;
  /** Dato secundario, como el nivel de una ubicación. */
  detail?: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-3 pr-1.5 text-[13px] font-semibold text-brand-800">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {label}
      {detail ? (
        <span className="font-medium text-[#5B6B87]">{detail}</span>
      ) : null}
      <button type="button" aria-label={`Quitar ${label}`} onClick={onRemove}>
        <Icon name="close" className="text-[15px] text-[#5B6B87]" />
      </button>
    </span>
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
