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
import { clearSelectedPlan } from "@/lib/selected-plan";
import type { FormState } from "@/app/actions/auth";
import {
  SERVICE_SECTORS,
  getSpecialty,
  listSpecialties,
  sectorOfSpecialty,
} from "@/data/taxonomy";
import { MAX_SCHEDULE_ENTRIES, searchSchedules } from "@/data/schedules";
import {
  COUNTRY_ID,
  locationLabelById,
  locationTypeLabel,
  normalizeServiceAreas,
} from "@/data/locations";
import { allowsFeature, formatPrice, limitFor } from "@/domain/plans";
import { Button, Icon } from "@/components/ui";
import {
  SearchSelect,
  type SearchOption,
} from "@/components/dashboard/search-select";
import { SERVICE_SUGGESTIONS } from "@/data/taxonomy";
import { searchServices } from "@/data/services";

/**
 * De qué especialidad es cada sugerencia del catálogo. Se arma una vez: al
 * elegir una de la lista hay que saber dónde colgarla (BR-010).
 */
const SERVICE_SUGGESTION_SPECIALTY = new Map(
  SERVICE_SUGGESTIONS.map((item) => [item.id, item.specialtyId]),
);
import {
  SocialLinksEditor,
  type SocialLinkDraft,
} from "@/components/dashboard/social-links-editor";
import {
  GalleryField,
  SingleImageField,
} from "@/components/dashboard/image-uploader";
import { LocationPicker } from "@/components/dashboard/location-picker";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type PlanLimits,
  type Profile,
  type ProfileImage,
  type ServiceModeCode,
  type SocialPlatform,
} from "@/types";

/** Los códigos que persiste la base; la etiqueta en español es de la UI. */
const PAYMENT_OPTIONS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
  "other",
];

/**
 * BR-017: las tres modalidades. "Híbrida" no está: se deriva de elegir más de
 * una, y por eso el control es de selección múltiple y no una lista de radios.
 */
const SERVICE_MODES: ServiceModeCode[] = ["at_customer", "at_business", "remote"];

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
  { id: "rubro", label: "Especialidades", icon: "category", feature: null },
  { id: "servicios", label: "Servicios", icon: "build", feature: null },
  { id: "zonas", label: "Ubicación", icon: "location_on", feature: null },
  { id: "contacto", label: "Contacto", icon: "call", feature: null },
  /*
   * Después de los datos con los que el perfil ya puede publicarse, y
   * opcional: se puede crear el perfil sin ninguna imagen y agregarlas
   * después. Va acá y no antes para que lo obligatorio se complete de corrido
   * y subir fotos no se interponga entre el nombre y el rubro.
   *
   * La foto de perfil y la portada las incluyen todos los planes (RF-167):
   * son la cara del perfil, no una ventaja del plan pago. La galería, que sí
   * depende del plan, se muestra dentro de este mismo paso.
   */
  { id: "imagenes", label: "Imágenes", icon: "photo_camera", feature: null },
  { id: "redes", label: "Redes", icon: "share", feature: "social" },
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
/**
 * Cómo se presenta el formulario.
 *
 * `alta` es el asistente: un paso a la vez, con la barra de pasos arriba y el
 * recorrido guiado. `edicion` es el mismo formulario abierto de una vez, con
 * todos los campos a la vista y sólo Cancelar y Guardar: quien ya creó el
 * perfil viene a corregir un dato puntual, y hacerlo caminar los ocho pasos
 * para llegar al teléfono sería trabajo en vez de ayuda.
 *
 * Los campos, la validación y la acción son los mismos en los dos modos: sólo
 * cambia qué se muestra a la vez.
 */
export type ProfileFormMode = "alta" | "edicion";

export function ProfileForm({
  userId,
  profile,
  plan,
  images,
  mode = "alta",
  onCancel,
}: {
  /**
   * Dueño del borrador. `localStorage` es del navegador y no de la sesión: sin
   * esto, el alta de una cuenta rehidrataría lo que dejó otra.
   *
   * Sólo hace falta en el alta. Editando ya hay perfil, manda la base y el
   * borrador no se toca ni para leer ni para escribir.
   */
  userId?: string;
  profile: Profile | null;
  plan: PlanLimits;
  /**
   * Las imágenes ya subidas, del usuario y no del perfil: durante el alta
   * todavía no hay perfil al que pertenezcan.
   */
  images: ProfileImage[];
  mode?: ProfileFormMode;
  /** Sólo en edición: salir sin guardar. */
  onCancel?: () => void;
}) {
  /*
   * `useSyncExternalStore` exige un `getSnapshot` estable: uno nuevo en cada
   * render lo haría releer sin parar. Se memoiza por cuenta, que es lo único
   * de lo que depende.
   */
  const snapshot = useMemo(
    () => () => (userId ? profileDraftSnapshot(userId) : null),
    [userId],
  );

  const stored = useSyncExternalStore(
    subscribeProfileDraft,
    snapshot,
    profileDraftServerSnapshot,
  );

  // Con perfil manda la base y el borrador no interviene.
  const draft = profile ? null : stored;

  return (
    <ProfileFormFields
      key={draft ? "con-borrador" : "sin-borrador"}
      userId={userId}
      profile={profile}
      plan={plan}
      draft={draft}
      images={images}
      mode={mode}
      onCancel={onCancel}
    />
  );
}

function ProfileFormFields(props: {
  userId?: string;
  profile: Profile | null;
  plan: PlanLimits;
  draft: ProfileDraft | null;
  images: ProfileImage[];
  mode: ProfileFormMode;
  onCancel?: () => void;
}) {
  const { userId, profile, plan, mode } = props;

  /** En edición todo se muestra junto: no hay recorrido que seguir. */
  const editing = mode === "edicion";

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

  /*
   * Los pasos por los que ya se pasó.
   *
   * Ubicación no tiene nada que completar: el selector arranca en Uruguay y
   * las zonas se derivan de ahí, así que exigir un cambio para darlo por
   * hecho pediría tocar algo que ya está bien. Alcanza con haberlo mirado.
   *
   * Se arranca con el paso donde el borrador quedó: quien vuelve ya recorrió
   * lo anterior, y marcarlo como no visitado lo mandaría para atrás.
   */
  const [visited, setVisited] = useState<Set<StepId>>(() => {
    const resumed =
      draft?.step && ALL_STEPS.some((s) => s.id === draft.step)
        ? (draft.step as StepId)
        : "identidad";
    const upTo = ALL_STEPS.findIndex((s) => s.id === resumed);
    return new Set(ALL_STEPS.slice(0, upTo + 1).map((s) => s.id));
  });

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
  const [services, setServices] = useState<ServiceRow[]>(
    draft?.services ??
      profile?.services.map((item) => ({
        specialtyId: item.specialtyId,
        name: item.name,
      })) ??
      [],
  );
  /**
   * Lo tipeado en el buscador de servicios. Vive acá y no adentro del
   * selector porque el catálogo se filtra afuera: son 633 servicios y el
   * orden depende del rubro ya elegido.
   */
  const [serviceQuery, setServiceQuery] = useState("");
  /*
   * Las especialidades elegidas, en orden de prioridad: la primera es la
   * principal y ese orden es el que después usan los cupos del plan (TR-016).
   * Los rubros no se eligen — se derivan de acá (BR-010).
   */
  const [specialtyIds, setSpecialtyIds] = useState<string[]>(
    draft?.specialtyIds ?? profile?.specialtyIds ?? [],
  );
  /*
   * Las ubicaciones físicas: locales o sucursales (BR-015). Son opcionales —
   * quien trabaja a domicilio no tiene ninguna— y sólo se vuelven obligatorias
   * al declarar que se atiende en el negocio.
   */
  const [locations, setLocations] = useState<LocationRow[]>(
    draft?.locations ??
      profile?.locations.map((item) => ({
        locationId: item.locationId,
        name: item.name,
        address: item.address,
        isPrimary: item.isPrimary,
      })) ??
      [],
  );
  /** Lo elegido en el selector de local, a la espera de confirmarse. */
  const [pendingLocation, setPendingLocation] = useState("");
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>(
    draft?.serviceAreaIds ?? profile?.serviceAreaIds ?? [],
  );
  /* BR-017: una o varias; con más de una la atención es híbrida. */
  const [serviceModes, setServiceModes] = useState<ServiceModeCode[]>(
    draft?.serviceModes ?? profile?.serviceModes ?? ["at_customer"],
  );
  /* BR-024: hasta diez líneas de texto libre. */
  const [scheduleEntries, setScheduleEntries] = useState<string[]>(
    draft?.scheduleEntries ??
      profile?.scheduleEntries.map((entry) => entry.text) ??
      [],
  );
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [contactEmail, setContactEmail] = useState(
    draft?.contactEmail ?? profile?.contactEmail ?? "",
  );
  const [phonePublic, setPhonePublic] = useState(
    draft?.phonePublic ?? profile?.phonePublic ?? true,
  );
  /** La última zona repetida que se intentó agregar, para avisarlo. */
  const [duplicateArea, setDuplicateArea] = useState<string | null>(null);
  const [name, setName] = useState(draft?.name ?? profile?.name ?? "");
  const [description, setDescription] = useState(
    draft?.description ?? profile?.description ?? "",
  );
  const [phone, setPhone] = useState(draft?.phone ?? profile?.phone ?? "");
  /*
   * Las redes cargadas, con su dirección. Antes alcanzaba con saber si había
   * alguna —los campos vivían en el DOM—, pero ahora la lista es la fuente:
   * se agrega y se quita contra este estado.
   */
  const [socialLinks, setSocialLinks] = useState<SocialLinkDraft[]>(() => {
    const fromDraft = Object.entries(draft?.socialLinks ?? {})
      .filter(([, url]) => url)
      .map(([platform, url]) => ({
        platform: platform as SocialPlatform,
        url,
      }));
    if (fromDraft.length > 0) return fromDraft;

    return (profile?.socialLinks ?? []).map((link) => ({
      platform: link.platform,
      url: link.url,
    }));
  });
  /*
   * Las imágenes no salen del borrador: no viajan en el envío del formulario
   * sino en su propia acción, así que ya están guardadas en el servidor. Lo
   * que llega por `images` es la verdad, y el estado local sólo evita tener
   * que volver a pedir la página entera después de cada subida.
   */
  const [avatar, setAvatar] = useState<ProfileImage | null>(
    () => props.images.find((image) => image.kind === "avatar") ?? null,
  );
  const [cover, setCover] = useState<ProfileImage | null>(
    () => props.images.find((image) => image.kind === "cover") ?? null,
  );
  const [gallery, setGallery] = useState<ProfileImage[]>(() =>
    props.images.filter((image) => image.kind === "gallery"),
  );

  /*
   * Marca de "pago resuelto". Es provisional: no cobra nada ni consulta a
   * ninguna pasarela, sólo deja constancia de que el paso se dio por hecho
   * mientras el cobro no exista. Cuando se implemente de verdad, el estado
   * saldrá de la suscripción y esta casilla desaparece.
   *
   * Arranca de lo que ya venía marcado para que no se pierda al recargar.
   */
  const [paymentDone, setPaymentDone] = useState(
    draft?.paymentAcknowledged ?? false,
  );

  // Por defecto sí: en el rubro casi todos atienden por WhatsApp.
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    draft?.whatsappEnabled ?? profile?.whatsappEnabled ?? true,
  );

  const errors = state.errors ?? {};
  /*
   * Los topes del plan. `null` es "sin límite" (TR-002), y por eso las ayudas
   * de más abajo lo comprueban antes de comparar contra un número.
   */
  const maxServices = limitFor(plan, "services");
  const maxSpecialties = limitFor(plan, "specialties");
  const maxLocations = limitFor(plan, "locations");
  const maxSectors = limitFor(plan, "serviceSectors");

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

    if (draft.type) setField("type", draft.type);

    if (draft.paymentMethods?.length) {
      const chosen = new Set(draft.paymentMethods);
      for (const box of form.querySelectorAll<HTMLInputElement>(
        'input[name="paymentMethods"]',
      )) {
        box.checked = chosen.has(box.value);
      }
    }
  }, [draft]);

  const selectedSpecialties: SearchOption[] = useMemo(
    () =>
      specialtyIds.map((id) => ({
        value: id,
        label: subcategoryLabel(id),
        context: sectorOfSpecialty(id)?.short,
      })),
    [specialtyIds],
  );

  /**
   * Todas las especialidades, con su rubro debajo para distinguir homónimas
   * ("Veterinaria" existe en Mascotas y en Servicios rurales).
   */
  const specialtyOptions: SearchOption[] = useMemo(
    () =>
      SERVICE_SECTORS.flatMap((sector) =>
        listSpecialties(sector.id).map((specialty) => ({
          value: specialty.id,
          label: specialty.name,
          context: sector.short,
        })),
      ),
    [],
  );

  /**
   * Los rubros que se derivan de las especialidades elegidas (BR-010). Se
   * muestran para que se vea cuántos consume el plan, pero no se eligen.
   */
  const derivedSectors = useMemo(() => {
    const sectors = new Map<string, string>();
    for (const id of specialtyIds) {
      const sector = sectorOfSpecialty(id);
      if (sector) sectors.set(sector.id, sector.short);
    }
    return [...sectors.values()];
  }, [specialtyIds]);

  /*
   * El servicio se identifica por su especialidad más su nombre: el mismo
   * texto puede existir en dos especialidades del perfil y son dos servicios
   * distintos (BR-011 sólo prohíbe repetirlo dentro de una).
   */
  const selectedServices: SearchOption[] = useMemo(
    () =>
      services.map((service) => ({
        value: `${service.specialtyId}|${service.name}`,
        label: service.name,
        context: getSpecialty(service.specialtyId)?.name,
      })),
    [services],
  );

  /*
   * Los servicios que se ofrecen, filtrados por lo tipeado.
   *
   * Los del rubro ya elegido van primero —con y sin texto—: es lo que casi
   * siempre se está por agregar. La prioridad la resuelve `searchServices`,
   * que la aplica antes de recortar; ordenar acá, sobre lo ya recortado,
   * dejaba fuera justo los del rubro cuando no entraban en el recorte.
   */
  const serviceOptions: SearchOption[] = useMemo(() => {
    const matches = searchServices(serviceQuery, {
      limit: 60,
      // Se excluye lo ya agregado, comparando por nombre dentro del perfil.
      exclude: services.map((service) => service.name),
      preferSpecialties: specialtyIds,
    });

    /*
     * El valor es el id del catálogo y no el nombre: hay servicios homónimos
     * en rubros distintos ("Clases de danza" está en Música y en Deportes) y
     * con el nombre como valor eran la misma fila repetida.
     *
     * Lo que se guarda igual es el nombre —`services` es texto libre—, y de
     * eso se encarga `onSelect`.
     */
    return matches.map((service) => ({
      value: service.id,
      label: service.name,
      context: service.context,
    }));
  }, [serviceQuery, services, specialtyIds]);

  /**
   * Sugerencias de horario, filtradas por lo tipeado (TR-024). Se muestran
   * pocas de entrada: son un punto de partida, y el texto final se puede
   * editar antes de confirmarlo (BR-024).
   */
  const scheduleOptions: SearchOption[] = useMemo(
    () =>
      searchSchedules(scheduleQuery, 8)
        .filter((text) => !scheduleEntries.includes(text))
        .map((text) => ({ value: text, label: text })),
    [scheduleQuery, scheduleEntries],
  );

  const completion = useMemo(() => {
    return {
      identidad: name.trim().length >= 2 && description.trim().length >= 20,
      rubro: specialtyIds.length > 0,
      servicios: services.length > 0,
      /*
       * BR-016: todo perfil activo declara al menos un área, así que el paso
       * no está hecho hasta que haya una. Y si se atiende en el negocio hace
       * falta además un local (BR-015).
       */
      zonas:
        serviceAreaIds.length > 0 &&
        (!serviceModes.includes("at_business") || locations.length > 0),
      contacto: phone.trim().length > 0,
      /*
       * Estos pasos son opcionales, pero el tilde verde tiene que querer
       * decir "hay algo cargado". Marcarlos siempre como hechos haría que el
       * recorrido apareciera casi completo sin haber escrito nada.
       *
       * Las imágenes cuentan como hechas con la foto de perfil, que es la que
       * se ve en los listados; la portada y la galería son un extra.
       */
      imagenes: avatar !== null,
      redes: socialLinks.length > 0,
      /*
       * Mientras no haya cobro, lo marca la persona: es un marcador de que
       * el paso se revisó, no una confirmación de que se pagó.
       */
      pago: paymentDone,
    } satisfies Record<StepId, boolean>;
  }, [
    name,
    description,
    specialtyIds,
    services,
    serviceAreaIds,
    serviceModes,
    locations,
    phone,
    socialLinks,
    avatar,
    paymentDone,
  ]);

  /*
   * Al bajar de plan el paso donde se estaba puede dejar de existir (por
   * ejemplo Redes al pasar de Oro a Cobre). En ese caso se retrocede al
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
   * Anota el paso que se está mirando, comparando durante el render en vez de
   * desde un efecto: así el tilde aparece en el mismo render que muestra el
   * paso, sin un render intermedio donde ya se ve pero todavía no cuenta.
   */
  if (!visited.has(step)) {
    setVisited((current) => {
      if (current.has(step)) return current;
      return new Set(current).add(step);
    });
  }

  /*
   * Guarda el borrador cada vez que cambia algo. Los campos no controlados se
   * leen del DOM en el momento, que es donde está su valor.
   *
   * Sólo durante el alta: con perfil creado la base ya guarda todo y un
   * borrador paralelo sólo podría contradecirla.
   */
  useEffect(() => {
    // Con perfil no hay borrador que llevar; sin dueño no habría a nombre de
    // quién guardarlo, y uno anónimo es justamente el que se arrastra entre
    // cuentas.
    if (profile || !userId) return;

    const form = formRef.current;
    const read = (name: string): string => {
      const field = form?.elements.namedItem(name);
      return field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
        ? field.value
        : "";
    };

    const paymentMethods = form
      ? Array.from(
          form.querySelectorAll<HTMLInputElement>(
            'input[name="paymentMethods"]:checked',
          ),
          (box) => box.value,
        )
      : [];

    writeProfileDraft(
      {
        step,
        name,
        type: read("type"),
        description,
        contactEmail,
        specialtyIds,
        services,
        serviceModes,
        serviceAreaIds,
        locations,
        phone,
        phonePublic,
        whatsappEnabled,
        scheduleEntries,
        paymentMethods,
        paymentAcknowledged: paymentDone,
        socialLinks: Object.fromEntries(
          socialLinks.map((link) => [link.platform, link.url]),
        ),
      },
      userId,
    );
  }, [
    userId,
    profile,
    step,
    name,
    description,
    contactEmail,
    specialtyIds,
    services,
    serviceModes,
    serviceAreaIds,
    locations,
    phone,
    phonePublic,
    whatsappEnabled,
    scheduleEntries,
    paymentDone,
    socialLinks,
  ]);

  /*
   * Guardado: el borrador cumplió su función y se descarta, junto con el plan
   * que el alta recordaba. Dejarlos haría que una recarga posterior reviviera
   * datos viejos por encima de los guardados.
   *
   * Esto cubre el guardado que vuelve al cliente, que es el de edición. Al
   * crear el perfil la acción termina en un `redirect` y nunca devuelve
   * estado, así que el borrador queda: no molesta, porque lleva anotada la
   * cuenta y con perfil creado ya no se lee, y el alta lo pisa al empezar de
   * nuevo.
   */
  useEffect(() => {
    if (state.message && !state.errors) {
      clearProfileDraft();
      clearSelectedPlan();
    }
  }, [state.message, state.errors]);


  /*
   * Los pasos que hay que completar para poder guardar.
   *
   * Identidad, especialidades, servicios, zonas y contacto son los datos con
   * los que un perfil puede publicarse (BR-003). Imágenes y redes quedan
   * afuera: son opcionales y se pueden completar después.
   *
   * El pago entra sólo al crear o al cambiar de plan, y sólo si el plan
   * cuesta: ahí no se puede seguir sin resolverlo. Editando no corresponde —
   * la suscripción ya está resuelta y exigirla otra vez dejaría el perfil sin
   * poder guardarse. En Cobre el paso ni siquiera existe.
   */
  const REQUIRED_STEPS: StepId[] = [
    "identidad",
    "rubro",
    "servicios",
    "zonas",
    "contacto",
    ...(plan.priceCents > 0 && !editing ? (["pago"] as StepId[]) : []),
  ];
  const missing = STEPS.filter(
    (s) => REQUIRED_STEPS.includes(s.id) && !completion[s.id],
  );

  const canSubmit = missing.length === 0;

  /*
   * Si hay algo distinto de lo guardado (sólo en edición).
   *
   * Se compara el formulario entero serializado contra una foto tomada al
   * abrir. Podría llevarse campo por campo, pero el formulario mezcla estado
   * de React (nombre, servicios, zonas) con campos que viven en el DOM (tipo,
   * modalidad, horarios, formas de pago, redes): una comparación por campo
   * tendría que replicar esa lista y se desactualizaría al agregar uno. La
   * foto los toma a todos, incluidas las etiquetas que se agregan y quitan.
   *
   * Las imágenes quedan fuera a propósito: se suben y se borran por su cuenta
   * y ya están guardadas cuando vuelven, así que no son un cambio pendiente.
   */
  const [dirty, setDirty] = useState(false);
  const cleanSnapshot = useRef<string | null>(null);
  /*
   * De qué guardado es la foto vigente. Es estado y no una ref porque se
   * compara durante el render: leer una ref ahí no está permitido, y con
   * estado el ajuste ocurre en el mismo render sin pintar el botón encendido
   * un instante.
   */
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);

  /** El formulario serializado, para comparar contra la foto inicial. */
  const snapshot = (): string => {
    const form = formRef.current;
    if (!form) return "";
    /*
     * Los pares se ordenan: `FormData` los entrega en el orden del DOM, y
     * quitar una etiqueta y volver a ponerla la deja en otra posición sin que
     * el perfil haya cambiado.
     */
    return JSON.stringify(
      [...new FormData(form).entries()]
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => `${key}=${String(value)}`)
        .sort(),
    );
  };

  /*
   * La foto se toma después del primer pintado, cuando los campos que se
   * llenan desde el DOM ya tienen su valor. Tomarla durante el render los
   * encontraría vacíos y todo parecería cambiado apenas abrir.
   *
   * `savedAt` marca de qué guardado es la foto vigente: al volver un mensaje
   * nuevo del servidor, lo recién guardado pasa a ser el punto de partida y
   * el botón se apaga hasta que se toque algo otra vez.
   */
  useEffect(() => {
    if (!editing) return;
    cleanSnapshot.current = snapshot();
  }, [editing, state.message]);

  /*
   * Tras un guardado exitoso el formulario queda limpio: lo recién guardado
   * es el nuevo punto de partida y el botón se apaga hasta el próximo cambio.
   *
   * Se ajusta durante el render y no desde un efecto: es la forma que React
   * recomienda para el estado que se deriva de otro, y evita el render extra
   * en el que el botón se vería todavía encendido.
   */
  if (editing && state.message !== savedAt) {
    setSavedAt(state.message);
    setDirty(false);
  }

  /** Recalcula si hay cambios pendientes. La llaman los eventos del form. */
  const checkDirty = () => {
    if (!editing || cleanSnapshot.current === null) return;
    setDirty(snapshot() !== cleanSnapshot.current);
  };

  /*
   * Las listas (servicios, zonas, especialidades, locales, horarios) viajan
   * en campos ocultos que React agrega y quita. Eso no dispara `input` ni
   * `change` —no los tocó nadie, aparecieron—, así que se recalcula cuando
   * cambian.
   *
   * `whatsappEnabled` y la ubicación también entran acá: son controlados y su
   * valor cambia sin que el evento llegue a burbujear en todos los casos.
   */
  useEffect(() => {
    checkDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    services,
    serviceAreaIds,
    specialtyIds,
    serviceModes,
    locations,
    scheduleEntries,
    whatsappEnabled,
    phonePublic,
    contactEmail,
    name,
    description,
    phone,
  ]);

  /*
   * En edición el botón pide además que haya algo para guardar: apretarlo sin
   * cambios mandaría el mismo perfil al servidor y respondería «guardado» sin
   * haber guardado nada, que es peor que no poder apretarlo.
   */
  const canSave = canSubmit && (!editing || dirty);

  // Un error del servidor puede referirse a un paso que no está a la vista;
  // este mapa permite señalarlo en la barra de pasos.
  const stepHasError: Record<StepId, boolean> = {
    identidad: Boolean(errors.name || errors.description || errors.type),
    rubro: Boolean(errors.specialtyIds),
    servicios: Boolean(errors.services),
    zonas: Boolean(
      errors.serviceModes || errors.locations || errors.serviceAreaIds,
    ),
    contacto: Boolean(
      errors.phone ||
        errors.contactEmail ||
        errors.scheduleEntries ||
        errors.paymentMethods,
    ),
    imagenes: false,
    redes: Boolean(errors.socialLinks),
    pago: false,
  };

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-5"
      /*
       * Se escucha en el formulario y no en cada campo: `input` y `change`
       * burbujean, así que un solo par de manejadores alcanza para los
       * cincuenta y pico de campos, incluidos los que se agregan después.
       */
      onInput={checkDirty}
      onChange={checkDirty}
    >
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

      {/* La barra de pasos es del recorrido guiado: en edición no hay
          recorrido, están todos los campos a la vez. */}
      {editing ? null : (
        <StepBar
          steps={STEPS}
          current={step}
          completion={completion}
          hasError={stepHasError}
          onSelect={setStep}
        />
      )}

      {/*
        Con sombra, para que la caja se apoye sobre el fondo en vez de
        confundirse con él. `shadow-card` no alcanzaba: está pensada para
        tarjetas chicas y a esta escala, con borde propio y sobre el gris del
        fondo, no se distinguía de no tener nada.
      */}
      <div className="rounded-card border border-line bg-white shadow-panel">
        {/* Cada panel se oculta con `hidden`, no se desmonta: los valores
            siguen en el formulario aunque el paso no esté a la vista. */}
        <Panel active={step === "identidad"} editing={editing} title="Identidad">
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

            <Field label="Tipo" error={errors.type} half>
              <select
                name="type"
                defaultValue={profile?.type ?? "individual"}
                className={inputClass(errors.type)}
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

        <Panel
          active={step === "rubro"}
          editing={editing}
          title="Especialidades"
        >
          <Field
            label="Especialidades"
            error={errors.specialtyIds}
            hint={
              maxSpecialties === null
                ? "En qué trabajás. La primera es la principal."
                : `En qué trabajás. La primera es la principal; tu plan ${plan.name} permite hasta ${maxSpecialties}.`
            }
            required
            counter={`${specialtyIds.length}/${maxSpecialties ?? "∞"}`}
            group
          >
            {/*
              No hay campo de rubro: el rubro se deriva de la especialidad
              (BR-010). Elegir las dos cosas permitiría decir que se trabaja
              en un rubro sin ninguna especialidad suya.
            */}
            <SearchSelect
              label="Especialidades"
              name="specialtyIds"
              options={specialtyOptions}
              selected={selectedSpecialties}
              max={maxSpecialties ?? undefined}
              error={errors.specialtyIds}
              placeholder="Buscá tu especialidad…"
              emptyLabel="No encontramos esa especialidad."
              onSelect={(option) => {
                if (specialtyIds.includes(option.value)) return;
                setSpecialtyIds([...specialtyIds, option.value]);
              }}
              onRemove={(value) => {
                setSpecialtyIds(specialtyIds.filter((id) => id !== value));
                /*
                 * BR-010: al quitar una especialidad se van sus servicios.
                 * Dejarlos huérfanos los haría rechazar por la FK compuesta
                 * al guardar, con un error que no explicaría nada.
                 */
                setServices(
                  services.filter((service) => service.specialtyId !== value),
                );
              }}
            />

            {maxSpecialties !== null && specialtyIds.length >= maxSpecialties ? (
              <PlanHint
                planName={plan.name}
                what="especialidades"
                limit={maxSpecialties}
              />
            ) : null}

            {/*
              Los rubros que salen de lo elegido. Se muestran porque el plan
              los limita (BR-006) y sin verlos el tope sería inexplicable.
            */}
            {derivedSectors.length > 0 ? (
              <p className="text-[12.5px] text-ink-soft">
                Rubros: {derivedSectors.join(" · ")}
                {maxSectors !== null
                  ? ` (${derivedSectors.length}/${maxSectors})`
                  : ""}
              </p>
            ) : null}
          </Field>
        </Panel>

        <Panel active={step === "servicios"} editing={editing} title="Servicios">
          <Field
            label="Servicios"
            error={errors.services}
            hint={
              specialtyIds.length === 0
                ? "Primero elegí al menos una especialidad."
                : maxServices === null
                  ? "Lo que ofrecés concretamente."
                  : `Lo que ofrecés concretamente. Tu plan ${plan.name} permite hasta ${maxServices}.`
            }
            required
            counter={`${services.length}/${maxServices ?? "∞"}`}
            group
          >
            {/*
              Cada servicio viaja con su especialidad en listas paralelas: la
              base exige que pertenezca a una que el perfil ya eligió (BR-010),
              así que el nombre solo no alcanza.
            */}
            {services.map((service, index) => (
              <input
                key={`${service.specialtyId}-${service.name}-${index}`}
                type="hidden"
                name="serviceSpecialty"
                value={service.specialtyId}
              />
            ))}

            <SearchSelect
              label="Servicios"
              name="serviceName"
              options={serviceOptions}
              selected={selectedServices}
              max={maxServices ?? undefined}
              error={errors.services}
              placeholder="Buscá un servicio…"
              onQueryChange={setServiceQuery}
              externallyFiltered
              emptyLabel="No encontramos ese servicio. Escribilo y agregalo igual."
              allowCustom
              customHint="Si no está en la lista, escribilo y agregalo igual."
              onSelect={(option) => {
                /*
                 * A qué especialidad se lo cuelga: la del catálogo si vino de
                 * ahí, y si no la principal del perfil. Un servicio escrito a
                 * mano tiene que colgar de alguna, y la primera es la que la
                 * persona declaró como su actividad principal.
                 */
                const fromCatalog = option.value.includes("-")
                  ? SERVICE_SUGGESTION_SPECIALTY.get(option.value)
                  : undefined;
                const specialtyId = fromCatalog ?? specialtyIds[0];
                if (!specialtyId) return;

                // BR-011: no se repite dentro de la misma especialidad.
                const repeated = services.some(
                  (service) =>
                    service.specialtyId === specialtyId &&
                    service.name.toLowerCase() === option.label.toLowerCase(),
                );
                if (repeated) return;

                setServices([...services, { specialtyId, name: option.label }]);
              }}
              onRemove={(value) =>
                setServices(
                  services.filter(
                    (service) =>
                      `${service.specialtyId}|${service.name}` !== value,
                  ),
                )
              }
            />

            {maxServices !== null && services.length >= maxServices ? (
              <PlanHint
                planName={plan.name}
                what="servicios"
                limit={maxServices}
              />
            ) : null}
          </Field>
        </Panel>

        <Panel active={step === "zonas"} editing={editing} title="Ubicación">
          <Field
            label="Cómo prestás el servicio"
            error={errors.serviceModes}
            hint="Podés marcar más de una. Con varias, tu perfil se muestra como atención híbrida."
            required
            group
          >
            <div className="flex flex-col gap-1.5">
              {SERVICE_MODES.map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-muted"
                >
                  <input
                    type="checkbox"
                    name="serviceModes"
                    value={mode}
                    checked={serviceModes.includes(mode)}
                    onChange={(event) => {
                      setServiceModes(
                        event.target.checked
                          ? [...serviceModes, mode]
                          : serviceModes.filter((item) => item !== mode),
                      );
                    }}
                    className="h-4 w-4 accent-brand-800"
                  />
                  {SERVICE_MODE_LABELS[mode]}
                </label>
              ))}
            </div>
          </Field>

          {/*
            BR-015: el local sólo hace falta si se atiende ahí. Quien trabaja a
            domicilio o a distancia publica sin ninguno, así que el bloque
            aparece únicamente cuando corresponde pedirlo.
          */}
          {serviceModes.includes("at_business") ? (
            <Field
              label="Dónde atendés"
              error={errors.locations}
              hint="La dirección de tu local o consultorio. Uruguay entero no sirve acá: tiene que decir dónde estás."
              required
              counter={`${locations.length}/${maxLocations ?? "∞"}`}
              group
            >
              <div className="flex flex-col gap-2.5">
                {locations.map((item, index) => (
                  <div
                    key={`${item.locationId}-${index}`}
                    className="flex flex-col gap-2 rounded-input border border-line p-3"
                  >
                    <input type="hidden" name="locationId" value={item.locationId} />
                    <input
                      type="hidden"
                      name="locationName"
                      value={item.name ?? ""}
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-ink">
                        {locationLabelById(item.locationId)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setLocations(locations.filter((_, i) => i !== index))
                        }
                        aria-label={`Quitar ${locationLabelById(item.locationId)}`}
                        className="rounded p-1 hover:bg-surface-sunken"
                      >
                        <Icon name="close" className="text-[17px]" />
                      </button>
                    </div>

                    <input
                      name="locationAddress"
                      value={item.address ?? ""}
                      onChange={(event) => {
                        const next = [...locations];
                        next[index] = { ...item, address: event.target.value };
                        setLocations(next);
                      }}
                      maxLength={160}
                      placeholder="Dirección (opcional)"
                      className={inputClass()}
                    />

                    {/* BR-015: sólo una principal. */}
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-muted">
                      <input
                        type="radio"
                        name="primaryLocation"
                        value={index}
                        checked={item.isPrimary}
                        onChange={() =>
                          setLocations(
                            locations.map((row, i) => ({
                              ...row,
                              isPrimary: i === index,
                            })),
                          )
                        }
                        className="h-4 w-4 accent-brand-800"
                      />
                      Es mi ubicación principal
                    </label>
                  </div>
                ))}

                {maxLocations === null || locations.length < maxLocations ? (
                  <LocationPicker
                    value={pendingLocation}
                    allowCountry={false}
                    onChange={(id) => {
                      if (!id || id === COUNTRY_ID) return;
                      if (locations.some((item) => item.locationId === id)) {
                        return;
                      }
                      setLocations([
                        ...locations,
                        {
                          locationId: id,
                          name: null,
                          address: null,
                          // La primera que se agrega es la principal.
                          isPrimary: locations.length === 0,
                        },
                      ]);
                      setPendingLocation("");
                    }}
                    addMode
                  />
                ) : (
                  <PlanHint
                    planName={plan.name}
                    what="ubicaciones"
                    limit={maxLocations}
                  />
                )}
              </div>
            </Field>
          ) : null}

          <Field
            label="Zonas donde trabajás"
            error={errors.serviceAreaIds}
            hint="Dónde llegás con tu servicio, que puede ser distinto de dónde estás. Elegir Uruguay significa todo el país."
            required
            counter={`${serviceAreaIds.length}`}
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
                      detail={locationTypeLabel(id)}
                      onRemove={() => {
                        setServiceAreaIds(
                          serviceAreaIds.filter((x) => x !== id),
                        );
                        if (duplicateArea === id) setDuplicateArea(null);
                      }}
                    />
                  ))}
                </div>
              ) : null}

              <LocationPicker
                value=""
                onChange={(id) => {
                  if (!id) return;
                  /*
                   * Repetir una zona no agrega nada y antes se descartaba en
                   * silencio: se veía como si el botón no funcionara.
                   */
                  if (serviceAreaIds.includes(id)) {
                    setDuplicateArea(id);
                    return;
                  }
                  setDuplicateArea(null);
                  /*
                   * TR-018: se normaliza al agregar. Elegir Uruguay reemplaza
                   * lo demás y un departamento absorbe sus localidades, así
                   * que lo que se ve es lo que se va a guardar.
                   */
                  setServiceAreaIds(
                    normalizeServiceAreas([...serviceAreaIds, id]),
                  );
                }}
                addMode
              />

              {duplicateArea ? (
                <p role="alert" className="text-[13px] font-medium text-[#B42318]">
                  Ya agregaste {locationLabelById(duplicateArea)}.
                </p>
              ) : null}
            </div>
          </Field>
        </Panel>

        <Panel active={step === "contacto"} editing={editing} title="Contacto">
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

          {/*
            BR-004: ocultar el teléfono lo saca del perfil y también de
            WhatsApp. Tiene que quedar algún canal público, y de eso avisa el
            servidor si no queda ninguno.
          */}
          <label className="flex items-center gap-2.5 text-[14px] text-ink-muted">
            <input
              type="checkbox"
              name="phonePublic"
              checked={phonePublic}
              onChange={(event) => setPhonePublic(event.target.checked)}
              className="h-4 w-4 accent-brand-800"
            />
            Mostrar mi teléfono en el perfil público
          </label>

          <Field
            label="Correo de contacto"
            error={errors.contactEmail}
            hint="Puede ser distinto del correo con el que entrás. Opcional si mostrás tu teléfono."
          >
            <input
              name="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              maxLength={254}
              autoComplete="email"
              className={inputClass(errors.contactEmail)}
              placeholder="contacto@ejemplo.uy"
            />
          </Field>

          {/*
            BR-024: hasta diez líneas de texto libre. El formato por día no
            servía para "Atención solo con agenda previa" ni para un horario
            cortado, que es como se escribe de verdad.
          */}
          <Field
            label="Horarios"
            error={errors.scheduleEntries}
            hint="Una línea por horario. Elegí de la lista o escribí el tuyo."
            counter={`${scheduleEntries.length}/${MAX_SCHEDULE_ENTRIES}`}
            group
          >
            <SearchSelect
              label="Horarios"
              name="scheduleEntries"
              options={scheduleOptions}
              selected={scheduleEntries.map((text) => ({
                value: text,
                label: text,
              }))}
              max={MAX_SCHEDULE_ENTRIES}
              error={errors.scheduleEntries}
              placeholder="Ej.: Lunes a viernes de 08:00 a 17:00"
              onQueryChange={setScheduleQuery}
              externallyFiltered
              emptyLabel="No está en la lista. Escribilo y agregalo igual."
              allowCustom
              customHint="Podés escribir tu propio horario."
              onSelect={(option) => {
                if (scheduleEntries.includes(option.label)) return;
                setScheduleEntries([...scheduleEntries, option.label]);
              }}
              onRemove={(value) =>
                setScheduleEntries(
                  scheduleEntries.filter((text) => text !== value),
                )
              }
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
                    defaultChecked={profile?.paymentMethods.includes(method)}
                    className="h-4 w-4 accent-brand-800"
                  />
                  {PAYMENT_METHOD_LABELS[method]}
                </label>
              ))}
            </div>
          </Field>
        </Panel>


        <Panel active={step === "imagenes"} editing={editing} title="Imágenes">
          {/*
            Se dice que es opcional: es el único paso donde no se escribe sino
            que se sube algo, y sin aclararlo parece que hay que conseguir una
            foto antes de poder seguir.
          */}
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Son opcionales: podés crear el perfil sin imágenes y agregarlas
            más adelante.
          </p>

          {/*
            Se suben de a una, apenas se eligen: cada una viaja en su propia
            acción y queda guardada aunque el alta siga sin terminar. Por eso
            no hay ningún campo de archivo dentro del envío del formulario.
          */}
          <SingleImageField
            kind="avatar"
            image={avatar}
            shape="circle"
            label="Foto de perfil"
            hint="Se ve en los resultados de búsqueda y arriba de tu perfil. JPG, PNG o WebP, hasta 5 MB."
            onChange={setAvatar}
          />

          <SingleImageField
            kind="cover"
            image={cover}
            shape="wide"
            label="Imagen de portada"
            hint="La franja ancha del encabezado de tu perfil."
            onChange={setCover}
          />

          {/*
            La galería sí depende del plan: los que no la incluyen ven la vía
            para ampliarlo en vez de un campo que no podrían usar (RF-171).
          */}
          {allowsFeature(plan, "gallery") ? (
            <GalleryField
              images={gallery}
              max={limitFor(plan, "galleryImages") ?? Number.MAX_SAFE_INTEGER}
              planName={plan.name}
              onChange={setGallery}
            />
          ) : (
            <PlanHint
              planName={plan.name}
              what="imágenes de galería"
              limit={0}
            />
          )}
        </Panel>

        {allowsFeature(plan, "social") ? (
          <Panel active={step === "redes"} editing={editing} title="Redes">
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Agregá sólo las que uses. Se muestran en tu perfil público.
            </p>
            <SocialLinksEditor
              platforms={SOCIAL_FIELDS}
              value={socialLinks}
              onChange={setSocialLinks}
              error={(platform) => errors[`socialLinks.${platform}`]}
            />
          </Panel>
        ) : null}

        {/*
          El pago es del alta y del cambio de plan, no de la edición: quien
          entra a corregir un teléfono no viene a tocar la suscripción. En
          edición se muestran todos los paneles a la vez, así que sin esta
          condición el paso aparecía ahí y, peor, se pedía completarlo para
          poder guardar — dejando un perfil de plan pago sin forma de editarse.
        */}
        {plan.priceCents > 0 && !editing ? (
          <Panel active={step === "pago"} editing={editing} title="Pago">
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

            {/*
              Marcador provisional mientras no exista el cobro: deja constancia
              de que el paso se revisó y da el tilde en la barra de pasos, para
              que el recorrido pueda verse completo. No condiciona la creación
              del perfil — el botón de guardar no la mira.
            */}
            <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-relaxed text-ink-muted">
              <input
                type="checkbox"
                name="paymentAcknowledged"
                checked={paymentDone}
                onChange={(event) => setPaymentDone(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-800"
              />
              Doy por completado este paso. Cuando habilitemos los pagos te
              avisamos para completar la suscripción.
            </label>
          </Panel>
        ) : null}

        {editing ? (
          <EditFooter
            pending={pending}
            canSubmit={canSave}
            dirty={dirty}
            missing={missing.map((s) => s.label)}
            onCancel={props.onCancel}
          />
        ) : (
          <Footer
            steps={STEPS}
            step={step}
            onStep={setStep}
            pending={pending}
            canSubmit={canSubmit}
            isNew={profile === null}
            missing={missing.map((s) => s.label)}
          />
        )}
      </div>
    </form>
  );
}

/** Nombre legible de una especialidad; su id si no se encuentra. */
function subcategoryLabel(id: string): string {
  return getSpecialty(id)?.name ?? id;
}

/** Fila del editor de equipo: lo que se escribe, sin id todavía. */
/** Un servicio del formulario: siempre sabe de qué especialidad es (BR-010). */
type ServiceRow = { specialtyId: string; name: string };

/** Una ubicación física del formulario (BR-015). */
type LocationRow = {
  locationId: string;
  name: string | null;
  address: string | null;
  isPrimary: boolean;
};


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
 * Pie del modo edición: salir sin guardar, o guardar lo cambiado.
 *
 * No lleva navegación entre pasos porque no hay pasos: están todos a la
 * vista. Cancelar es un botón y no un enlace — no navega, sólo devuelve el
 * perfil a modo lectura.
 */
function EditFooter({
  pending,
  canSubmit,
  dirty,
  missing,
  onCancel,
}: {
  pending: boolean;
  canSubmit: boolean;
  /** Si hay algo distinto de lo guardado. */
  dirty: boolean;
  missing: string[];
  onCancel?: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 border-t border-line-soft bg-surface-muted px-5 py-3.5">
      {missing.length > 0 ? (
        <span className="text-[12.5px] text-ink-soft">
          Falta completar: {missing.join(", ")}
        </span>
      ) : !dirty ? (
        /*
         * Con el botón apagado hay que decir por qué: si no, parece roto.
         * Es el estado normal al abrir la edición y al terminar de guardar.
         */
        <span className="text-[12.5px] text-ink-faint">
          No hay cambios sin guardar.
        </span>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Salir del modo edición
        </Button>
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
          {pending ? "Guardando…" : "Guardar cambios"}
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
 *
 * En edición no se oculta ninguno: se ven todos, uno debajo del otro y con su
 * título, porque no hay recorrido sino un formulario largo. El título sólo
 * aparece ahí — en el asistente lo dice la barra de pasos, y repetirlo sería
 * decir dos veces dónde estás parado.
 */
function Panel({
  active,
  editing = false,
  title,
  children,
}: {
  active: boolean;
  editing?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  if (editing) {
    return (
      <section className="flex flex-col gap-4 border-b border-line-soft p-5 last:border-b-0">
        {title ? (
          <h2 className="text-[15px] font-bold tracking-[-.2px] text-ink">
            {title}
          </h2>
        ) : null}
        {children}
      </section>
    );
  }

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
      {/* Con tope 0 no hay un "hasta" que informar: el plan directamente no
          lo incluye, y decir "hasta 0" se lee como un error. */}
      {limit === 0
        ? `Tu plan ${planName} no incluye ${what}.`
        : `Tu plan ${planName} permite hasta ${limit} ${what}.`}
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
