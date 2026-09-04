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
import { CATEGORIES } from "@/data/categories";
import {
  COUNTRY_ID,
  locationLabelById,
  locationLevelLabel,
} from "@/data/locations";
import { allowsFeature, formatPrice, limitFor } from "@/domain/plans";
import { Button, Icon } from "@/components/ui";
import {
  SearchSelect,
  type SearchOption,
} from "@/components/dashboard/search-select";
import { searchServices } from "@/data/services";
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
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type PlanLimits,
  type Provider,
  type ProviderImage,
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
  provider,
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
  provider: Provider | null;
  plan: PlanLimits;
  /**
   * Las imágenes ya subidas, del usuario y no del perfil: durante el alta
   * todavía no hay perfil al que pertenezcan.
   */
  images: ProviderImage[];
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
  const draft = provider ? null : stored;

  return (
    <ProfileFormFields
      key={draft ? "con-borrador" : "sin-borrador"}
      userId={userId}
      provider={provider}
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
  provider: Provider | null;
  plan: PlanLimits;
  draft: ProfileDraft | null;
  images: ProviderImage[];
  mode: ProfileFormMode;
  onCancel?: () => void;
}) {
  const { userId, provider, plan, mode } = props;

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
  const [services, setServices] = useState<string[]>(
    draft?.services ?? provider?.services ?? [],
  );
  /**
   * Lo tipeado en el buscador de servicios. Vive acá y no adentro del
   * selector porque el catálogo se filtra afuera: son 633 servicios y el
   * orden depende del rubro ya elegido.
   */
  const [serviceQuery, setServiceQuery] = useState("");
  const [subcategoryId, setSubcategoryId] = useState(
    draft?.subcategoryId ?? provider?.subcategoryId ?? "",
  );
  /*
   * Arranca en Uruguay y no vacío: el selector nunca devuelve nada sin
   * elegir —parar en el país es una respuesta válida— y dejarlo vacío
   * fingía que faltaba un dato que en realidad ya estaba.
   */
  const [locationId, setLocationId] = useState(
    draft?.locationId ?? provider?.locationId ?? COUNTRY_ID,
  );
  const [extraSubcategoryIds, setExtraSubcategoryIds] = useState<string[]>(
    draft?.subcategoryIds ?? provider?.subcategoryIds ?? [],
  );
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>(
    draft?.serviceAreaIds ?? provider?.serviceAreaIds ?? [],
  );
  /** La última zona repetida que se intentó agregar, para avisarlo. */
  const [duplicateArea, setDuplicateArea] = useState<string | null>(null);
  const [name, setName] = useState(draft?.name ?? provider?.name ?? "");
  const [description, setDescription] = useState(
    draft?.description ?? provider?.description ?? "",
  );
  const [phone, setPhone] = useState(draft?.phone ?? provider?.phone ?? "");
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

    return (provider?.socialLinks ?? []).map((link) => ({
      platform: link.platform,
      url: link.url,
    }));
  });
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
  /*
   * Las imágenes no salen del borrador: no viajan en el envío del formulario
   * sino en su propia acción, así que ya están guardadas en el servidor. Lo
   * que llega por `images` es la verdad, y el estado local sólo evita tener
   * que volver a pedir la página entera después de cada subida.
   */
  const [avatar, setAvatar] = useState<ProviderImage | null>(
    () => props.images.find((image) => image.kind === "avatar") ?? null,
  );
  const [cover, setCover] = useState<ProviderImage | null>(
    () => props.images.find((image) => image.kind === "cover") ?? null,
  );
  const [gallery, setGallery] = useState<ProviderImage[]>(() =>
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

    if (draft.paymentMethods?.length) {
      const chosen = new Set(draft.paymentMethods);
      for (const box of form.querySelectorAll<HTMLInputElement>(
        'input[name="paymentMethods"]',
      )) {
        box.checked = chosen.has(box.value);
      }
    }
  }, [draft]);

  /*
   * Los rubros como una sola lista. El principal va primero: para quien
   * completa el formulario "el primero" y "el principal" son lo mismo, y
   * mantener ese orden hace que quitar y volver a agregar se comporte como
   * se ve.
   */
  const allSubcategoryIds = useMemo(
    () => (subcategoryId ? [subcategoryId, ...extraSubcategoryIds] : []),
    [subcategoryId, extraSubcategoryIds],
  );

  const selectedSubcategories: SearchOption[] = useMemo(
    () =>
      allSubcategoryIds.map((id) => ({
        value: id,
        label: subcategoryLabel(id),
      })),
    [allSubcategoryIds],
  );

  /** Todos los rubros, con su categoría debajo para distinguir homónimos. */
  const subcategoryOptions: SearchOption[] = useMemo(
    () =>
      CATEGORIES.flatMap((category) =>
        category.subcategories.map((sub) => ({
          value: sub.id,
          label: sub.name,
          context: category.short,
        })),
      ),
    [],
  );

  const selectedServices: SearchOption[] = useMemo(
    () => services.map((service) => ({ value: service, label: service })),
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
      exclude: services,
      preferSubcategories: allSubcategoryIds,
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
  }, [serviceQuery, services, allSubcategoryIds]);

  const completion = useMemo(() => {
    return {
      identidad: name.trim().length >= 2 && description.trim().length >= 20,
      rubro: subcategoryId !== "" && services.length > 0,
      /*
       * Ubicación queda hecha al visitarla: sus dos campos ya vienen con un
       * valor válido —Uruguay, y las zonas que de ahí salen—, así que no hay
       * nada que la persona tenga que completar para que el paso sea válido.
       */
      zonas: visited.has("zonas"),
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
      equipo: teamMembers.length > 0,
      /*
       * Mientras no haya cobro, lo marca la persona: es un marcador de que
       * el paso se revisó, no una confirmación de que se pagó.
       */
      pago: paymentDone,
    } satisfies Record<StepId, boolean>;
  }, [
    name,
    description,
    subcategoryId,
    services,
    visited,
    phone,
    socialLinks,
    teamMembers,
    avatar,
    paymentDone,
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
    if (provider || !userId) return;

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
      paymentAcknowledged: paymentDone,
      socialLinks: Object.fromEntries(
        socialLinks.map((link) => [link.platform, link.url]),
      ),
      teamMembers,
    }, userId);
  }, [
    userId,
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
    paymentDone,
    teamMembers,
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
   * Identidad, rubro, zonas y contacto son los datos con los que un perfil
   * puede publicarse. Imágenes, redes y equipo quedan afuera: son opcionales
   * y se pueden completar después.
   *
   * El pago entra sólo al crear o al cambiar de plan, y sólo si el plan
   * cuesta: ahí no se puede seguir sin resolverlo. Editando no corresponde —
   * la suscripción ya está resuelta y exigirla otra vez dejaría el perfil sin
   * poder guardarse. En Cobre el paso ni siquiera existe.
   */
  const REQUIRED_STEPS: StepId[] = [
    "identidad",
    "rubro",
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
   * Las listas (servicios, zonas, subcategorías, equipo) viajan en campos
   * ocultos que React agrega y quita. Eso no dispara `input` ni `change` —no
   * los tocó nadie, aparecieron—, así que se recalcula cuando cambian.
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
    extraSubcategoryIds,
    teamMembers,
    subcategoryId,
    locationId,
    whatsappEnabled,
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
    identidad: Boolean(errors.name || errors.description || errors.kind),
    rubro: Boolean(errors.subcategoryId || errors.services),
    zonas: Boolean(errors.locationId || errors.serviceAreaIds),
    contacto: Boolean(
      errors.phone || errors.whatsapp || errors.schedule || errors.paymentMethods,
    ),
    imagenes: false,
    redes: Boolean(errors.socialLinks),
    equipo: Boolean(errors.teamMembers),
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

        <Panel active={step === "rubro"} editing={editing} title="Rubro">
          <Field
            label="Rubros"
            error={errors.subcategoryId ?? errors.subcategoryIds}
            hint={
              maxSubcategories > 1
                ? `En qué trabajás. El primero es el principal y define tu categoría; tu plan ${plan.name} permite hasta ${maxSubcategories}.`
                : "En qué trabajás. Define la categoría en la que aparecés."
            }
            required
            counter={`${allSubcategoryIds.length}/${maxSubcategories}`}
            group
          >
            {/*
              El principal viaja aparte porque el servidor lo espera aparte:
              `subcategoryId` decide la categoría del perfil y los demás son
              adicionales. Para quien completa son una sola lista —el primero
              que elige es el principal—, que es como se piensa el rubro.
            */}
            <input type="hidden" name="subcategoryId" value={subcategoryId} />

            <SearchSelect
              label="Rubros"
              name="subcategoryIds"
              /*
               * El principal ya viaja en `subcategoryId`: si además saliera
               * acá, el servidor lo contaría dos veces contra el tope del
               * plan y avisaría de un exceso que no existe.
               */
              omitFromSubmit={subcategoryId ? [subcategoryId] : []}
              options={subcategoryOptions}
              selected={selectedSubcategories}
              max={maxSubcategories}
              error={errors.subcategoryId ?? errors.subcategoryIds}
              placeholder="Buscá tu rubro…"
              emptyLabel="No encontramos ese rubro."
              onSelect={(option) => {
                if (subcategoryId === "") {
                  setSubcategoryId(option.value);
                  return;
                }
                setExtraSubcategoryIds([...extraSubcategoryIds, option.value]);
              }}
              onRemove={(value) => {
                if (value === subcategoryId) {
                  /*
                   * Sacar el principal asciende al siguiente: dejar el perfil
                   * sin principal teniendo otros cargados lo dejaría sin
                   * categoría, que es dato obligatorio.
                   */
                  const [next, ...rest] = extraSubcategoryIds;
                  setSubcategoryId(next ?? "");
                  setExtraSubcategoryIds(rest);
                  return;
                }
                setExtraSubcategoryIds(
                  extraSubcategoryIds.filter((id) => id !== value),
                );
              }}
            />

            {allSubcategoryIds.length >= maxSubcategories ? (
              <PlanHint
                planName={plan.name}
                what="rubros"
                limit={maxSubcategories}
              />
            ) : null}
          </Field>

          <Field
            label="Servicios"
            error={errors.services}
            hint={`Lo que ofrecés concretamente. Tu plan ${plan.name} permite hasta ${maxServices}.`}
            required
            counter={`${services.length}/${maxServices}`}
            group
          >
            <SearchSelect
              label="Servicios"
              name="services"
              options={serviceOptions}
              selected={selectedServices}
              max={maxServices}
              error={errors.services}
              placeholder="Buscá un servicio…"
              onQueryChange={setServiceQuery}
              externallyFiltered
              emptyLabel="No encontramos ese servicio. Escribilo y agregalo igual."
              allowCustom
              customHint="Si no está en la lista, escribilo y agregalo igual."
              onSelect={(option) => {
                /*
                 * Se guarda el nombre, no el id del catálogo: `services` es
                 * una lista de textos libres, y así lo elegido de la lista y
                 * lo escrito a mano son la misma clase de dato.
                 */
                if (
                  services.some(
                    (s) => s.toLowerCase() === option.label.toLowerCase(),
                  )
                ) {
                  return;
                }
                setServices([...services, option.label]);
              }}
              onRemove={(value) =>
                setServices(services.filter((s) => s !== value))
              }
            />

            {services.length >= maxServices ? (
              <PlanHint
                planName={plan.name}
                what="servicios"
                limit={maxServices}
              />
            ) : null}
          </Field>
        </Panel>

        <Panel active={step === "zonas"} editing={editing} title="Ubicación">
          <Row>
            <Field
              label="Dónde estás ubicado"
              error={errors.locationId}
              hint="Precisá hasta donde quieras: alcanza con el departamento."
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
            hint="Puede ser distinto de dónde estás ubicado. Si no agregás ninguna, se toma dónde estás ubicado."
            required={false}
            counter={`${serviceAreaIds.length}/${maxAreas}`}
            group
          >
            <div className="flex flex-col gap-2.5">
              {/*
                Sin zonas propias se manda dónde está ubicado. El servidor
                sigue exigiendo al menos una (RF-163) y tiene razón —un perfil
                sin zona no aparece en ninguna búsqueda—, pero no es algo que
                haya que pedirle a la persona: si no dijo otra cosa, trabaja
                donde está.
              */}
              {serviceAreaIds.length === 0 ? (
                <input
                  type="hidden"
                  name="serviceAreaIds"
                  value={locationId}
                />
              ) : null}

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
              max={limitFor(plan, "galleryImages")}
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

        {allowsFeature(plan, "team") ? (
          <Panel active={step === "equipo"} editing={editing} title="Equipo">
            <TeamEditor
              members={teamMembers}
              onChange={setTeamMembers}
              max={limitFor(plan, "teamMembers")}
              planName={plan.name}
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
            isNew={provider === null}
            missing={missing.map((s) => s.label)}
          />
        )}
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
