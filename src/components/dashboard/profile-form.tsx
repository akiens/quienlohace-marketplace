"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { saveProfile } from "@/app/actions/profile";
import {
  clearProfileDraft,
  clientHydrated,
  profileDraftServerSnapshot,
  profileDraftSnapshot,
  serverHydrated,
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
import { profileFieldSchemas } from "@/lib/validation";
import { fitToPlan } from "@/domain/plan-fit";
import { allowsFeature, formatPrice, limitFor } from "@/domain/plans";
import { Button, Icon, SECONDARY_SURFACE } from "@/components/ui";
import { FormAlert } from "@/components/form-alert";
import {
  SearchSelect,
  type SearchOption,
} from "@/components/dashboard/search-select";
import { ServiceSpecialtyDialog } from "@/components/dashboard/service-specialty-dialog";
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
import { LocalityPicker } from "@/components/dashboard/locality-picker";
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

/**
 * Los códigos que persiste la base; la etiqueta en español es de la UI.
 *
 * "Otros" ya no se ofrece: como casilla no decía nada —quien busca no puede
 * filtrar por "otros"— y elegirla era una forma de no contestar. El código
 * sigue existiendo en el tipo y en la base porque hay perfiles que ya lo
 * tienen guardado, y quitarlo de ahí los rompería (TR-001); simplemente no se
 * ofrece más al cargar el perfil.
 */
const PAYMENT_OPTIONS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
];

/**
 * BR-017: las tres modalidades. No hay una opción "híbrida": quien atiende de
 * varias formas marca varias, y por eso el control es de selección múltiple y
 * no una lista de radios. Nombrar la combinación agregaba un cuarto concepto
 * para decir lo que las tres casillas ya dicen.
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
  accountEmail,
  profile,
  plan,
  images,
  mode = "alta",
  onCancel,
  onPlanRejected,
}: {
  /**
   * Dueño del borrador. `localStorage` es del navegador y no de la sesión: sin
   * esto, el alta de una cuenta rehidrataría lo que dejó otra.
   *
   * Sólo hace falta en el alta. Editando ya hay perfil, manda la base y el
   * borrador no se toca ni para leer ni para escribir.
   */
  userId?: string;
  /**
   * El correo con el que se registró. En el alta arranca el de contacto: es
   * casi siempre el mismo, y quien quiera otro lo cambia. Editando no se pasa
   * — ahí manda lo que el perfil ya tenga guardado, incluido estar vacío.
   */
  accountEmail?: string;
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
  /**
   * Se cancela una baja de plan: lo cargado no entraba en el plan nuevo y se
   * eligió no perderlo. Quien maneja el plan tiene que volver al anterior,
   * porque el formulario nunca llegó a aplicarlo.
   */
  onPlanRejected?: (planId: PlanLimits["id"]) => void;
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

  /*
   * Si el borrador ya se leyó del navegador.
   *
   * `useSyncExternalStore` da primero el snapshot del servidor —vacío, para
   * que la hidratación calce— y recién en el render siguiente el del cliente.
   * En ese primer render los campos están en blanco, y el efecto que guarda
   * corría igual: escribía un borrador vacío encima del que venía a rescatar.
   *
   * No alcanzaba con que `writeProfileDraft` ignore lo vacío, porque no todo
   * lo que arranca en blanco lo parece: la modalidad viene con "a domicilio"
   * puesta de fábrica, así que el borrador del primer render se veía "con
   * datos" y pisaba el guardado. Al recargar se perdían el paso y lo cargado.
   *
   * Se sigue rindiendo el formulario igual: el servidor ya mandó los campos y
   * devolver nada acá sería justamente el desajuste de hidratación que
   * `useSyncExternalStore` viene a evitar. Lo que se pospone es sólo guardar,
   * que es lo único que hace daño.
   */
  const hydrated = useSyncExternalStore(
    subscribeProfileDraft,
    clientHydrated,
    serverHydrated,
  );

  return (
    <ProfileFormFields
      key={draft ? "con-borrador" : "sin-borrador"}
      userId={userId}
      accountEmail={accountEmail}
      profile={profile}
      plan={plan}
      draft={draft}
      // Editando no hay borrador que esperar: la base vino con la página.
      canPersistDraft={hydrated}
      images={images}
      mode={mode}
      onCancel={onCancel}
      onPlanRejected={onPlanRejected}
    />
  );
}

function ProfileFormFields(props: {
  userId?: string;
  accountEmail?: string;
  profile: Profile | null;
  plan: PlanLimits;
  draft: ProfileDraft | null;
  /**
   * Si ya se leyó el borrador del navegador. Hasta entonces los campos están
   * en blanco por no haber llegado todavía, y guardarlos borraría lo guardado.
   */
  canPersistDraft: boolean;
  images: ProfileImage[];
  mode: ProfileFormMode;
  onCancel?: () => void;
  onPlanRejected?: (planId: PlanLimits["id"]) => void;
}) {
  const { userId, profile, mode, onPlanRejected } = props;

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

  /*
   * El local que se está componiendo, todavía sin agregar.
   *
   * Localidad y dirección se piden juntas y recién entonces se agrega: antes
   * elegir la localidad creaba la fila en el acto y la dirección se llenaba
   * dentro de una tarjeta ya existente, así que la lista mostraba locales a
   * medio hacer —y uno sin dirección es un local que no se puede publicar—.
   */
  const [newLocality, setNewLocality] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIsPrimary, setNewIsPrimary] = useState(false);

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
  /*
   * El correo de contacto arranca con el de la cuenta.
   *
   * Es el dato que se acaba de tipear en el registro y casi siempre es el
   * mismo, así que pedirlo otra vez es hacer escribir dos veces lo mismo.
   * Queda editable: el campo dice que puede ser distinto del de acceso.
   *
   * El borrador manda sobre esto —incluido uno donde se vació a propósito— y
   * con perfil creado manda la base.
   */
  const [contactEmail, setContactEmail] = useState(
    draft?.contactEmail ?? profile?.contactEmail ?? props.accountEmail ?? "",
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

  /*
   * Las formas de pago son estado y no casillas sueltas del DOM.
   *
   * Antes iban con `defaultChecked`: al volver el servidor con un error el
   * formulario se vuelve a pintar, y como `defaultChecked` sólo manda al
   * montar, las casillas se caían a lo que tuviera el perfil —en el alta,
   * nada— y se desmarcaban solas después de apretar "Crear perfil".
   */
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    draft?.paymentMethods ?? profile?.paymentMethods ?? [],
  );

  // Por defecto sí: en el rubro casi todos atienden por WhatsApp.
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    draft?.whatsappEnabled ?? profile?.whatsappEnabled ?? true,
  );

  /*
   * Bajar de plan con datos ya cargados.
   *
   * El plan lo cambia el bloque de arriba y llega acá por `props.plan`. Si el
   * nuevo no da para lo que ya está elegido, no se aplica de una: se avisa
   * qué se perdería y se espera la respuesta. Aceptar recorta; cancelar deja
   * todo como estaba y devuelve el plan al que regía.
   */
  /**
   * El plan aplicado, que es con el que se pinta el formulario.
   *
   * No es directamente `props.plan`: mientras un aviso de baja está sin
   * responder sigue rigiendo el anterior, porque todavía no se recortó nada.
   * Pintar con los topes del nuevo dejaría a la vista contadores en rojo y
   * pasos que desaparecen para un cambio que quizá se cancele.
   */
  const [applied, setApplied] = useState<PlanLimits>(props.plan);

  /** El plan pedido y todavía sin aplicar, con lo que se perdería al hacerlo. */
  const [held, setHeld] = useState<{
    to: PlanLimits;
    /** Qué se perdería, ya contado y en palabras. */
    losses: string[];
  } | null>(null);

  const incoming = props.plan;

  /*
   * Se decide durante el render y no desde un efecto: un efecto aplicaría
   * primero el plan nuevo —con el formulario ya recortado a la vista— y
   * recién después preguntaría, que es justo al revés.
   */
  if (incoming.id !== applied.id) {
    if (held?.to.id !== incoming.id) {
      /*
       * La pregunta es si lo cargado entra en el plan que llegó, no si el
       * plan bajó: uno menor que igual da para todo no tiene nada que avisar,
       * y se aplica sin molestar.
       */
      const { losses } = fitToPlan(
        { specialtyIds, services, locations, socialLinks },
        incoming,
      );

      if (losses.length === 0) {
        setApplied(incoming);
        setHeld(null);
      } else {
        setHeld({ to: incoming, losses });
      }
    }
  } else if (held) {
    // Volvió al plan que ya regía —se canceló, o se eligió de nuevo el mismo—:
    // no queda nada que preguntar.
    setHeld(null);
  }

  const plan = applied;

  /** Aceptar la baja: se recorta lo que no entra y el plan nuevo pasa a regir. */
  function applyDowngrade() {
    if (!held) return;
    const { fitted } = fitToPlan(
      { specialtyIds, services, locations, socialLinks },
      held.to,
    );
    setSpecialtyIds(fitted.specialtyIds);
    setServices(fitted.services);
    setLocations(fitted.locations);
    setSocialLinks(fitted.socialLinks);
    setApplied(held.to);
    setHeld(null);
  }

  /**
   * Cancelar la baja: no se toca nada y se avisa para que el plan vuelva al
   * que regía. Sin ese aviso el bloque de arriba seguiría mostrando el plan
   * nuevo mientras el formulario trabaja con el viejo.
   */
  function cancelDowngrade() {
    if (!held) return;
    setHeld(null);
    onPlanRejected?.(applied.id);
  }

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

  /*
   * Validación en el cliente.
   *
   * No reemplaza a la del servidor —la acción vuelve a validar todo con el
   * mismo schema (RF-163), porque el `FormData` se puede armar a mano—, pero
   * evita el viaje de ida y vuelta para lo que ya se sabe mal antes de enviar.
   *
   * Las reglas salen de `profileFieldSchemas`, que es el mismo objeto del que
   * se arma `profileSchema`: un solo lugar donde dice cuánto mide un nombre y
   * qué teléfono es marcable, así los dos lados no pueden decir cosas
   * distintas.
   */
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  /*
   * Si ya se intentó enviar. Desde ese momento los errores se muestran aunque
   * el campo no se haya tocado: apretar "Guardar" es pedir que se revise todo,
   * y dejar campos en silencio escondería justo lo que frena el envío.
   */
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Los campos que ya se dejaron: recién ahí se muestra su error. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  /*
   * Los campos editados después de la última respuesta del servidor.
   *
   * El error de "ese correo ya está en uso" habla del valor que se envió, no
   * del que hay ahora en pantalla: al primer cambio deja de aplicar y no se
   * muestra hasta el próximo envío.
   */
  const [stale, setStale] = useState<Record<string, boolean>>({});

  /** Valida un campo contra su regla del schema. Devuelve el error, o "". */
  const validateField = useCallback((field: string, value: unknown): string => {
    const schema = profileFieldSchemas[field];
    if (!schema) return "";
    const parsed = schema.safeParse(value);
    return parsed.success ? "" : (parsed.error.issues[0]?.message ?? "");
  }, []);

  /**
   * Al salir del campo: se valida y se muestra el error si lo hay.
   *
   * Mostrar mientras se escribe marcaría en rojo un teléfono a medio tipear,
   * que es justo lo que la persona está por terminar.
   */
  const blurField = useCallback(
    (field: string, value: unknown) => {
      setTouched((current) => ({ ...current, [field]: true }));
      const message = validateField(field, value);
      setClientErrors((current) => ({ ...current, [field]: message }));
    },
    [validateField],
  );

  /**
   * Mientras se escribe: sólo se **saca** el error, nunca se agrega.
   *
   * Es lo que deja ver que el campo ya va bien antes de salir de él, sin
   * ensuciar el formulario con errores de algo a medio escribir.
   */
  const editField = useCallback(
    (field: string, value: unknown) => {
      setStale((current) =>
        current[field] ? current : { ...current, [field]: true },
      );
      setClientErrors((current) => {
        if (!current[field]) return current;
        return validateField(field, value) === ""
          ? { ...current, [field]: "" }
          : current;
      });
    },
    [validateField],
  );

  const serverErrors = state.errors ?? {};

  /*
   * El error que se muestra en cada campo.
   *
   * Manda el del cliente, que es el que corresponde a lo que hay en pantalla.
   * El del servidor sólo se muestra si el campo no se tocó desde que llegó:
   * si no, hablaría de un valor que ya no está.
   */
  const errors: Record<string, string | undefined> = { ...serverErrors };
  for (const field of Object.keys(stale)) {
    if (stale[field] && field !== "form") delete errors[field];
  }
  for (const [field, message] of Object.entries(clientErrors)) {
    if (message && (touched[field] || submitAttempted)) errors[field] = message;
  }
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
   * Los rubros que se derivan de las especialidades elegidas (BR-010). Se
   * muestran para que se vea cuántos consume el plan, pero no se eligen.
   *
   * Se guarda el id además del nombre corto porque con el cupo de rubros
   * lleno hay que filtrar el catálogo por ellos, y el nombre no alcanza.
   */
  const derivedSectors = useMemo(() => {
    const sectors = new Map<string, string>();
    for (const id of specialtyIds) {
      const sector = sectorOfSpecialty(id);
      if (sector) sectors.set(sector.id, sector.short);
    }
    return [...sectors].map(([id, short]) => ({ id, short }));
  }, [specialtyIds]);

  /**
   * Todas las especialidades, con su rubro debajo para distinguir homónimas
   * ("Veterinaria" existe en Mascotas y en Servicios rurales).
   *
   * Con el cupo de rubros del plan lleno sólo se ofrecen las de esos rubros.
   * El tope de rubros no se elige ni se ve venir: elegir una especialidad de
   * un rubro nuevo lo consume sin decirlo, y la persona se enteraría recién
   * al guardar, con un error que le pide quitar algo sin decirle qué. Dejando
   * de ofrecerlas, el límite se explica solo (BR-006).
   *
   * El orden no es el del catálogo: primero van los rubros que ya se están
   * trabajando, en el orden en que se eligieron, y después todo lo demás.
   * Quien acaba de elegir "Electricista" casi siempre sigue con algo del
   * mismo rubro, y el catálogo lo tenía a veinte rubros de distancia; ahora
   * lo primero que se ofrece al abrir el selector es lo que sigue a mano.
   *
   * Con dos rubros elegidos el segundo va después del primero —no se mezclan—:
   * así el bloque de arriba sigue siendo el rubro en el que se estaba, y
   * sumar uno nuevo no reordena lo que ya se venía viendo.
   */
  const specialtyOptions: SearchOption[] = useMemo(() => {
    const sectorsFull =
      maxSectors !== null && derivedSectors.length >= maxSectors;
    const allowed = new Set(derivedSectors.map((sector) => sector.id));

    /*
     * Los rubros ya elegidos primero y en su orden; detrás, el resto del
     * catálogo en el suyo. `derivedSectors` ya viene ordenado por elección
     * —lo arma recorriendo `specialtyIds`—, así que alcanza con anteponerlo.
     */
    const chosenIds = derivedSectors.map((sector) => sector.id);
    const chosen = chosenIds
      .map((id) => SERVICE_SECTORS.find((sector) => sector.id === id))
      .filter((sector): sector is (typeof SERVICE_SECTORS)[number] =>
        Boolean(sector),
      );
    const rest = SERVICE_SECTORS.filter(
      (sector) => !chosenIds.includes(sector.id),
    );

    return [...chosen, ...rest]
      .filter((sector) => !sectorsFull || allowed.has(sector.id))
      .flatMap((sector) =>
        listSpecialties(sector.id).map((specialty) => ({
          value: specialty.id,
          label: specialty.name,
          context: sector.short,
        })),
      );
  }, [derivedSectors, maxSectors]);

  /**
   * El servicio escrito a mano que espera especialidad, o null.
   *
   * Guarda el nombre y no un objeto entero porque es lo único que falta
   * saber: la especialidad la contesta el diálogo (BR-011).
   */
  const [pendingService, setPendingService] = useState<string | null>(null);

  /**
   * Agrega un servicio bajo una especialidad, si no está repetido.
   *
   * Lo comparten los tres caminos —catálogo, especialidad única y diálogo—
   * para que la regla de no repetir viva en un solo lugar.
   */
  const addService = useCallback(
    (specialtyId: string, name: string) => {
      setServices((current) => {
        // BR-011: no se repite el mismo servicio dentro de una especialidad.
        const repeated = current.some(
          (service) =>
            service.specialtyId === specialtyId &&
            service.name.toLowerCase() === name.toLowerCase(),
        );
        return repeated ? current : [...current, { specialtyId, name }];
      });
    },
    [setServices],
  );

  /** Las especialidades del perfil, como opciones para el diálogo. */
  const specialtyChoices = useMemo(
    () =>
      specialtyIds.map((id) => ({
        id,
        name: subcategoryLabel(id),
        sector: sectorOfSpecialty(id)?.short,
      })),
    [specialtyIds],
  );

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
   * Los servicios que se sugieren, filtrados por lo tipeado.
   *
   * Con especialidades elegidas se sugiere sólo lo que cuelga de ellas; sin
   * ninguna, el catálogo entero. Lo resuelve `searchServices` a partir de
   * `preferSpecialties`.
   *
   * Es sólo la sugerencia: el servicio es texto libre y se puede agregar
   * escribiéndolo aunque no esté en el catálogo (`allowCustom`).
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

  /**
   * Las zonas que se van a guardar.
   *
   * La pregunta se le hace a todo el mundo y la respuesta es siempre suya:
   * Uruguay entero, un departamento completo o una localidad (BR-016).
   *
   * Antes el campo aparecía sólo para quien se traslada y no atiende a
   * distancia; al resto se le deducía la zona de sus locales o del país. Esa
   * deducción suponía cosas sobre el negocio de otro —quien atiende a
   * distancia puede trabajar sólo para su departamento, y quien tiene local
   * en Montevideo puede viajar a Canelones— y, peor, dejaba el campo fuera
   * del formulario: al editar el perfil no había forma de corregir la zona.
   *
   * Sin elección explícita vale todo el país: es lo más amplio y lo único que
   * no deja el perfil fuera de las búsquedas.
   */
  const effectiveServiceAreas = useMemo(
    () => (serviceAreaIds.length > 0 ? serviceAreaIds : [COUNTRY_ID]),
    [serviceAreaIds],
  );

  const completion = useMemo(() => {
    return {
      identidad: name.trim().length >= 2 && description.trim().length >= 20,
      rubro: specialtyIds.length > 0,
      servicios: services.length > 0,
      /*
       * BR-016: todo perfil activo declara al menos un área. Ya nunca falta
       * —`effectiveServiceAreas` cae en el país entero cuando no se eligió
       * nada—, así que el paso no se traba por las zonas. Lo único que puede
       * faltar acá es el local de quien atiende en el negocio (BR-015).
       *
       * En el asistente hace falta además haber pasado por el paso: como el
       * valor por omisión ya alcanza, sin eso el tilde aparecía puesto desde el
       * arranque y decía "esto ya está" sobre una pregunta que todavía no se
       * leyó. Se marca al salir del paso, sea eligiendo zonas o dejándolo como
       * venía —mirarlo y aceptar el país entero es una respuesta válida—.
       *
       * Editando no se pide: ahí no hay recorrido sino un formulario largo con
       * todos los paneles a la vista, así que `visited` nunca suma "zonas" y el
       * paso quedaba incompleto para siempre. El perfil no se podía guardar y
       * el pie decía "Falta completar: Ubicación" sobre un campo que estaba
       * lleno y a la vista.
       */
      zonas:
        (editing || visited.has("zonas")) &&
        effectiveServiceAreas.length > 0 &&
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
    serviceModes,
    effectiveServiceAreas,
    locations,
    visited,
    editing,
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
    /*
     * Todavía no se leyó lo guardado: los campos están vacíos porque el
     * borrador no llegó, no porque no haya nada. Guardarlos ahora lo pisaría
     * con un formulario en blanco, que era la pérdida al recargar.
     */
    if (!props.canPersistDraft) return;

    const form = formRef.current;
    const read = (name: string): string => {
      const field = form?.elements.namedItem(name);
      return field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
        ? field.value
        : "";
    };

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
    props.canPersistDraft,
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
    paymentMethods,
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
   * Un envío rechazado lleva al paso que lo rechazó.
   *
   * En el asistente sólo se ve un paso por vez, así que un error de otro
   * quedaba fuera de la pantalla: se apretaba "Crear perfil", el servidor
   * devolvía el error y desde afuera no pasaba nada —ni mensaje ni cambio de
   * página—, como si el botón estuviera roto.
   *
   * Se ajusta durante el render y no desde un efecto, igual que `visited`:
   * así el paso con el error se muestra en el mismo render que trae el error,
   * sin uno intermedio mostrando todavía el paso viejo.
   *
   * `handledErrors` guarda de qué respuesta es el salto ya hecho, para que
   * moverse a otro paso después no vuelva a arrastrar al del error. Dos
   * envíos con el mismo error traen objetos `state` distintos, así que el
   * segundo intento vuelve a saltar.
   */
  const [handledErrors, setHandledErrors] = useState<FormState | null>(null);

  if (!editing && state.errors && handledErrors !== state) {
    setHandledErrors(state);

    /*
     * Qué campos mira cada paso: la misma correspondencia que pinta el error
     * en la barra de pasos.
     */
    const FIELDS_BY_STEP: Record<StepId, string[]> = {
      identidad: ["name", "description", "type"],
      rubro: ["specialtyIds"],
      servicios: ["services"],
      zonas: ["serviceModes", "locations", "serviceAreaIds"],
      contacto: ["phone", "contactEmail", "scheduleEntries", "paymentMethods"],
      imagenes: [],
      redes: ["socialLinks"],
      pago: [],
    };

    const errored = state.errors;
    const failed = STEPS.find((s) =>
      FIELDS_BY_STEP[s.id].some((field) => errored[field]),
    );
    if (failed) setRequestedStep(failed.id);
  }

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
   * Los campos de texto que hoy no pasan su regla.
   *
   * Se recalcula sobre el valor actual y no sobre `clientErrors`, que sólo
   * tiene lo que ya se mostró: un campo que nunca se tocó puede estar mal
   * —viene así de la base, o se pegó algo— y el botón no puede ignorarlo.
   */
  const invalidFields = ([
    ["name", name],
    ["description", description],
    ["phone", phone],
    ["contactEmail", contactEmail],
  ] as const).filter(([field, value]) => validateField(field, value) !== "");

  /*
   * En edición el botón pide además que haya algo para guardar: apretarlo sin
   * cambios mandaría el mismo perfil al servidor y respondería «guardado» sin
   * haber guardado nada, que es peor que no poder apretarlo.
   *
   * Y no se habilita con un campo inválido: el `onSubmit` corta el envío igual,
   * pero un botón encendido que al apretarlo no hace nada se lee como roto. Si
   * hay algo mal escrito, el botón lo dice estando apagado.
   */
  const canSave =
    canSubmit && invalidFields.length === 0 && (!editing || dirty);

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
    <>
      {held ? (
        <DowngradeDialog
          planName={held.to.name}
          losses={held.losses}
          onAccept={applyDowngrade}
          onCancel={cancelDowngrade}
        />
      ) : null}

    <form
      ref={formRef}
      action={action}
      /*
       * Sin validación nativa: en el asistente los pasos que no están a la
       * vista se ocultan con `display:none`, y un `required` vacío dentro de
       * uno de ellos aborta el envío sin decir nada —el navegador no puede
       * enfocar ni mostrar el mensaje de un campo oculto—. Así "Crear perfil"
       * no hacía nada y la página se quedaba donde estaba.
       *
       * Lo obligatorio se sigue exigiendo: `missing` deshabilita el envío
       * hasta que esté completo, y el servidor revalida todo con Zod (TR-004),
       * que es lo que pinta los errores por campo.
       */
      noValidate
      className="flex flex-col gap-4 sm:gap-5"
      /*
       * Se escucha en el formulario y no en cada campo: `input` y `change`
       * burbujean, así que un solo par de manejadores alcanza para los
       * cincuenta y pico de campos, incluidos los que se agregan después.
       */
      onInput={checkDirty}
      onChange={checkDirty}
      /*
       * Última red antes de salir: se revalidan los campos de texto y, si algo
       * está mal, no se envía.
       *
       * Ahorra el viaje para lo que ya se sabe mal —el servidor contestaría lo
       * mismo, más tarde— y deja los errores marcados de una vez en lugar de
       * de a uno. El servidor revalida igual (RF-163): esto es comodidad, no
       * seguridad, porque el `FormData` se puede armar sin pasar por acá.
       */
      onSubmit={(event) => {
        setSubmitAttempted(true);

        const found: Record<string, string> = {};
        for (const [field, value] of [
          ["name", name],
          ["description", description],
          ["phone", phone],
          ["contactEmail", contactEmail],
        ] as const) {
          const message = validateField(field, value);
          if (message) found[field] = message;
        }

        if (Object.keys(found).length > 0) {
          event.preventDefault();
          setClientErrors((current) => ({ ...current, ...found }));
        }
      }}
    >
      {/*
        El plan con el que se crea el perfil. Sólo cuenta la primera vez: si
        el perfil ya existe, el servidor usa el suyo y descarta este valor.
      */}
      <input type="hidden" name="planId" value={plan.id} />

      {/*
        Cómo salió el envío. Va pegado al encabezado del sitio y se va solo a
        los quince segundos; el `-mx` lo saca del padding lateral que le pone
        quien monta el formulario, porque es una banda del sitio y no una
        tarjeta del contenido.
      */}
      <FormAlert
        /*
         * Un rechazo por validación vuelve con los errores repartidos por
         * campo y sin `form`: sin este respaldo el aviso no diría nada
         * justo cuando hay algo que decir. Los mensajes por campo se siguen
         * viendo en su campo; acá va la señal de que el envío no pasó.
         */
        message={
          state.message ??
          state.errors?.form ??
          (state.errors
            ? "Revisá los campos marcados: hay datos que faltan o no son válidos."
            : undefined)
        }
        tone={state.tone ?? (state.errors ? "error" : "success")}
        /*
         * La respuesta del servidor, sea cual sea: dos guardados seguidos
         * traen el mismo texto, y sin algo que cambie el segundo no se vería.
         */
        resetKey={state}
        /*
         * En edición el formulario va dentro de un bloque con `px-5` y la
         * banda tiene que salirse de él para tocar los dos bordes. En el alta
         * no hay tal padding —la página lo pone en `px-0` en el teléfono— y
         * restarlo la mandaría fuera de la pantalla.
         */
        className={editing ? "-mx-5 sm:mx-0" : ""}
      />

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
      {/*
        En el asistente la caja va a todo el ancho del teléfono: con el borde
        redondeado y su margen se perdían casi 50px de los 360 que hay, justo
        donde se escribe. En edición no, porque ahí el formulario vive dentro
        del `shell`, que ya pone su propio margen: sin borde redondeado quedaba
        una caja cuadrada flotando en el medio de una página con aire.
      */}
      <div
        className={`border-line bg-white shadow-panel ${
          editing
            ? "rounded-card border"
            : "border-y sm:rounded-card sm:border"
        }`}
      >
        {/* Cada panel se oculta con `hidden`, no se desmonta: los valores
            siguen en el formulario aunque el paso no esté a la vista. */}
        <Panel active={step === "identidad"} editing={editing} title="Identidad">
          <Row>
            <Field label="Nombre del perfil" error={errors.name}
              errorId="error-name" required half>
              <input
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  editField("name", event.target.value);
                }}
                onBlur={(event) => blurField("name", event.target.value)}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "error-name" : undefined}
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
            errorId="error-description"
            counter={`${description.trim().length}/600 · mínimo 20 caracteres`}
            hint="Contá qué hacés y cómo trabajás. Es lo primero que lee quien te busca."
            required
          >
            <textarea
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                editField("description", event.target.value);
              }}
              onBlur={(event) => blurField("description", event.target.value)}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={
                errors.description ? "error-description" : undefined
              }
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
            hint="En qué trabajás. La primera es la principal."
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
              /*
                La etiqueta lleva el rubro debajo: hay especialidades
                homónimas en rubros distintos y, una vez elegidas, la lista ya
                no está para desempatarlas.
              */
              showContext
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
                Rubros:{" "}
                {derivedSectors.map((sector) => sector.short).join(" · ")}
                {maxSectors !== null
                  ? ` (${derivedSectors.length}/${maxSectors})`
                  : ""}
              </p>
            ) : null}

            {/*
              Con el cupo de rubros lleno el catálogo deja de ofrecer los
              demás. Se dice, porque si no una especialidad que existe
              parecería no existir.
            */}
            {maxSectors !== null && derivedSectors.length >= maxSectors ? (
              <PlanHint planName={plan.name} what="rubros" limit={maxSectors} />
            ) : null}
          </Field>
        </Panel>

        <Panel active={step === "servicios"} editing={editing} title="Servicios">
          <Field
            label="Servicios"
            error={errors.services}
            /*
              El texto dice de dónde salen las sugerencias, porque la lista
              cambia de tamaño según el paso anterior y si no parecería que
              faltan opciones (o que sobran).
            */
            /*
              Sin especialidades el campo está bloqueado y el texto lo dice: no
              es una sugerencia, es lo que falta para poder cargar servicios.

              Antes se podía escribir igual y no pasaba nada — el servicio se
              descartaba en silencio porque no había especialidad de la cual
              colgarlo (BR-010).
            */
            hint={
              specialtyIds.length === 0
                ? "Primero elegí al menos una especialidad: cada servicio tiene que pertenecer a una."
                : "Lo que ofrecés concretamente. Te sugerimos las de tus especialidades."
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
              // Cada servicio cuelga de una especialidad: sin ninguna elegida
              // no hay dónde ponerlo (BR-010).
              disabled={specialtyIds.length === 0}
              /*
               * Viaja el nombre, no el valor: el valor de un servicio elegido
               * es `especialidad|nombre`, una clave interna para distinguir
               * homónimos. Mandándola, el perfil guardaba esa clave como
               * nombre del servicio y después la mostraba tal cual.
               *
               * La especialidad no se pierde: va en paralelo por
               * `serviceSpecialty`, en el mismo orden.
               */
              submitLabel
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
                 * Del catálogo se sabe la especialidad: es la suya. Se consulta
                 * el catálogo en vez de adivinar por la forma del valor —antes
                 * se miraba si tenía un guión, y un servicio escrito a mano que
                 * lo llevara ("Aire acondicionado - instalación") se tomaba por
                 * id de catálogo y se quedaba sin especialidad.
                 */
                const fromCatalog = SERVICE_SUGGESTION_SPECIALTY.get(
                  option.value,
                );
                if (fromCatalog) {
                  addService(fromCatalog, option.label);
                  return;
                }

                /*
                 * Escrito a mano: la especialidad la elige la persona (BR-011).
                 * Con una sola no hay nada que preguntar, y con ninguna el
                 * campo está bloqueado, así que acá siempre hay más de una.
                 */
                if (specialtyIds.length === 1) {
                  addService(specialtyIds[0]!, option.label);
                  return;
                }
                setPendingService(option.label);
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

            {/*
              Un servicio escrito a mano con varias especialidades elegidas:
              se pregunta a cuál pertenece (BR-011). Cancelar no lo agrega —
              queda como si no se hubiera escrito.
            */}
            {pendingService ? (
              <ServiceSpecialtyDialog
                serviceName={pendingService}
                specialties={specialtyChoices}
                onChoose={(specialtyId) => {
                  addService(specialtyId, pendingService);
                  setPendingService(null);
                }}
                onCancel={() => setPendingService(null)}
              />
            ) : null}

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
            hint="Podés marcar más de una."
            required
            group
          >
            {/*
              Cada modalidad es una fila entera y no una casilla suelta: en el
              teléfono se toca el renglón completo, que es un blanco de 48px
              en vez de los 16 de la casilla.
            */}
            <div className="flex flex-col gap-2">
              {SERVICE_MODES.map((mode) => (
                <CheckRow
                  key={mode}
                  name="serviceModes"
                  value={mode}
                  checked={serviceModes.includes(mode)}
                  onChange={(checked) => {
                    setServiceModes(
                      checked
                        ? [...serviceModes, mode]
                        : serviceModes.filter((item) => item !== mode),
                    );
                  }}
                  label={SERVICE_MODE_LABELS[mode]}
                />
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
              hint="La localidad y la dirección de tu local o consultorio. Tiene que decir dónde estás: ni el país ni un departamento entero alcanzan."
              required
              counter={`${locations.length}/${maxLocations ?? "∞"}`}
              group
            >
              <div className="flex flex-col gap-2.5">
                {/*
                  Lo ya agregado. Cada local es una fila: arriba dónde queda
                  —localidad y departamento— y debajo la dirección, que es el
                  dato con el que se llega. La cruz para quitarlo va a la
                  derecha, como en el resto de las listas del formulario.
                */}
                {locations.map((item, index) => (
                  <div
                    key={`${item.locationId}-${index}`}
                    className="flex items-start gap-2 rounded-input border border-line bg-surface-muted p-3"
                  >
                    <input type="hidden" name="locationId" value={item.locationId} />
                    <input
                      type="hidden"
                      name="locationName"
                      value={item.name ?? ""}
                    />
                    <input
                      type="hidden"
                      name="locationAddress"
                      value={item.address ?? ""}
                    />

                    <Icon
                      name="storefront"
                      className="mt-0.5 flex-none text-[19px] text-brand-800"
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-ink">
                        {locationLabelById(item.locationId)}
                      </span>
                      <span className="text-[13px] text-ink-soft">
                        {item.address}
                      </span>

                      {/*
                        BR-015: una sola principal. Con un solo local no se
                        pregunta —es la principal por descarte— y el radio
                        suelto sólo invitaba a un clic que no cambia nada.
                      */}
                      {locations.length > 1 ? (
                        <label className="mt-1 flex min-h-[36px] cursor-pointer items-center gap-2 text-[13px] text-ink-muted sm:min-h-0">
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
                            className="h-4 w-4 flex-none accent-brand-800"
                          />
                          Es mi ubicación principal
                        </label>
                      ) : (
                        <input
                          type="hidden"
                          name="primaryLocation"
                          value={index}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const rest = locations.filter((_, i) => i !== index);
                        /*
                         * Si se quitó la principal, la primera que queda toma
                         * el lugar: sin esto el perfil se quedaba sin ninguna
                         * y no se podía guardar sin volver a elegirla.
                         */
                        setLocations(
                          rest.some((row) => row.isPrimary)
                            ? rest
                            : rest.map((row, i) => ({
                                ...row,
                                isPrimary: i === 0,
                              })),
                        );
                      }}
                      aria-label={`Quitar ${locationLabelById(item.locationId)}`}
                      className="-mr-1 flex h-10 w-10 flex-none items-center justify-center rounded hover:bg-white sm:mr-0 sm:h-8 sm:w-8"
                    >
                      <Icon name="close" className="text-[19px] sm:text-[17px]" />
                    </button>
                  </div>
                ))}

                {/*
                  El local que se está armando: localidad, dirección y —cuando
                  ya hay otro— si es la principal. Los tres campos están a la
                  vista desde el principio y nada se agrega hasta confirmar,
                  así la lista de arriba sólo tiene locales completos.
                */}
                {maxLocations === null || locations.length < maxLocations ? (
                  <div className="flex flex-col gap-2 rounded-input border border-dashed border-line-strong p-3">
                    <LocalityPicker
                      value={newLocality}
                      onChange={setNewLocality}
                    />

                    <input
                      value={newAddress}
                      onChange={(event) => setNewAddress(event.target.value)}
                      maxLength={160}
                      placeholder="Calle y número"
                      aria-label="Dirección exacta"
                      className={inputClass()}
                    />

                    {/*
                      Marcarlo como principal sólo tiene sentido si ya hay otro
                      con el que competir: el primero lo es siempre.
                    */}
                    {locations.length > 0 ? (
                      <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[13px] text-ink-muted sm:min-h-0">
                        <input
                          type="checkbox"
                          checked={newIsPrimary}
                          onChange={(event) =>
                            setNewIsPrimary(event.target.checked)
                          }
                          className="h-4 w-4 flex-none accent-brand-800"
                        />
                        Es mi ubicación principal
                      </label>
                    ) : null}

                    <button
                      type="button"
                      /*
                       * Sin localidad o sin dirección no hay local que agregar:
                       * el botón lo dice apagándose, en vez de aceptar y
                       * fallar después contra el esquema (BR-015).
                       */
                      disabled={!newLocality || !newAddress.trim()}
                      onClick={() => {
                        if (!newLocality || !newAddress.trim()) return;
                        if (
                          locations.some(
                            (item) => item.locationId === newLocality,
                          )
                        ) {
                          return;
                        }

                        // El primero es principal sí o sí; después, lo que se pida.
                        const primary = locations.length === 0 || newIsPrimary;
                        setLocations([
                          ...locations.map((row) => ({
                            ...row,
                            isPrimary: primary ? false : row.isPrimary,
                          })),
                          {
                            locationId: newLocality,
                            name: null,
                            address: newAddress.trim(),
                            isPrimary: primary,
                          },
                        ]);

                        setNewLocality("");
                        setNewAddress("");
                        setNewIsPrimary(false);
                      }}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-input px-3.5 text-[14px] font-semibold disabled:opacity-45 sm:h-9 sm:self-start sm:text-[13.5px] ${SECONDARY_SURFACE}`}
                    >
                      <Icon name="add" className="text-[18px]" />
                      Agregar dirección de local
                    </button>
                  </div>
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

          {/*
            Las zonas son "hasta dónde vas", así que sólo se preguntan a quien
            va a algún lado. Quien atiende únicamente en su local o a distancia
            no recorre ninguna zona, y pedírselas lo obligaba a contestar una
            pregunta que no era sobre su trabajo.
          */}
          <Field
              label="Zonas donde trabajás"
              error={errors.serviceAreaIds}
              hint="Dónde llegás con tu servicio, que puede ser distinto de dónde estás. Si no elegís ninguna, vale todo el país."
              counter={`${serviceAreaIds.length}`}
              group
            >
              <div className="flex flex-col gap-2.5">
                {/*
                  Las zonas que se van a guardar, incluida la cobertura
                  nacional cuando no se eligió ninguna.

                  El país se muestra como un chip más y no como un input
                  oculto: era invisible, así que la lista se veía vacía cuando
                  en realidad el perfil cubría todo el país. Y como no se veía,
                  tampoco se entendía por qué agregar una zona no parecía
                  cambiar nada.

                  Su cruz va apagada a propósito. Quitarlo no puede hacer nada
                  —el vacío vuelve a significar "todo el país" (BR-016)—, así
                  que ofrecer la acción era prometer un cambio que no ocurría y
                  dejaba el botón de guardar apagado sin explicación. Para
                  acotar se agrega una zona concreta, que es lo que lo
                  reemplaza.
                */}
                <div className="flex flex-wrap gap-1.5">
                  {effectiveServiceAreas.map((id) => (
                    <ItemChip
                      key={id}
                      name="serviceAreaIds"
                      value={id}
                      label={locationLabelById(id)}
                      detail={locationTypeLabel(id)}
                      /*
                       * El país no se puede quitar, esté guardado o puesto por
                       * omisión: sacarlo deja la lista vacía, y vacía vuelve a
                       * significar todo el país (BR-016). La cruz no cambiaba
                       * nada y el botón de guardar se quedaba apagado sin que
                       * se entendiera por qué. Para acotar la cobertura se
                       * agrega una zona concreta, que es lo que lo reemplaza.
                       */
                      onRemove={
                        id === COUNTRY_ID
                          ? undefined
                          : () => {
                              setServiceAreaIds(
                                serviceAreaIds.filter((x) => x !== id),
                              );
                              if (duplicateArea === id) setDuplicateArea(null);
                            }
                      }
                    />
                  ))}
                </div>

                {/*
                  El mismo desplegable del local, pero acá cualquier nivel es
                  una respuesta (`granularity="any"`): una zona de trabajo
                  puede ser todo el país o un departamento entero, y no hay por
                  qué bajar hasta una localidad para decirlo (BR-016).
                */}
                <LocalityPicker
                  value=""
                  granularity="any"
                  placeholder="Agregá una zona"
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
                     *
                     * Con cobertura nacional puesta, elegir una zona concreta
                     * la reemplaza en vez de sumarse: normalizar las dos juntas
                     * devolvería Uruguay —que se come todo— y el clic no haría
                     * nada. Es el caso de quien abre a editar un perfil que
                     * quedó en "todo el país" por omisión y quiere acotarlo:
                     * sin esto, agregar zonas no cambiaba nada y el botón de
                     * guardar seguía apagado.
                     */
                    const base = serviceAreaIds.filter(
                      (area) => area !== COUNTRY_ID,
                    );
                    setServiceAreaIds(
                      id === COUNTRY_ID
                        ? [COUNTRY_ID]
                        : normalizeServiceAreas([...base, id]),
                    );
                  }}
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
            errorId="error-phone"
            hint="Con característica. Ej: 099 123 456"
          >
            <input
              name="phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                editField("phone", event.target.value);
              }}
              onBlur={(event) => blurField("phone", event.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "error-phone" : undefined}
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              className={inputClass(errors.phone)}
              placeholder="099 123 456"
            />
          </Field>

          <CheckRow
            name="whatsappEnabled"
            checked={whatsappEnabled}
            onChange={setWhatsappEnabled}
            label="Este número recibe WhatsApp"
          />

          {/*
            BR-004: ocultar el teléfono lo saca del perfil y también de
            WhatsApp. Tiene que quedar algún canal público, y de eso avisa el
            servidor si no queda ninguno.
          */}
          <CheckRow
            name="phonePublic"
            checked={phonePublic}
            onChange={setPhonePublic}
            label="Mostrar mi teléfono en el perfil público"
          />

          <Field
            label="Correo de contacto"
            error={errors.contactEmail}
            errorId="error-contactEmail"
            hint="Puede ser distinto del correo con el que entrás. Opcional si mostrás tu teléfono."
          >
            <input
              name="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => {
                setContactEmail(event.target.value);
                editField("contactEmail", event.target.value);
              }}
              onBlur={(event) => blurField("contactEmail", event.target.value)}
              aria-invalid={errors.contactEmail ? true : undefined}
              aria-describedby={
                errors.contactEmail ? "error-contactEmail" : undefined
              }
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
            {/*
              "Acepto todas" es un atajo, no un valor: marca las cuatro y se
              desmarca solo en cuanto se destilda cualquiera. Se guarda la
              lista completa y no una bandera, así que quien busca por
              "efectivo" encuentra igual a este perfil (TR-001).
            */}
            <CheckRow
              name="paymentMethodsAll"
              value="all"
              checked={PAYMENT_OPTIONS.every((method) =>
                paymentMethods.includes(method),
              )}
              onChange={(on) =>
                setPaymentMethods(on ? [...PAYMENT_OPTIONS] : [])
              }
              label="Acepto todas"
            />

            {/*
              Dos columnas en el teléfono: las etiquetas son cortas ("Efectivo",
              "Débito") y en una sola columna el paso se estiraba media pantalla
              de más por cinco palabras.
            */}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
              {PAYMENT_OPTIONS.map((method) => (
                <CheckRow
                  key={method}
                  name="paymentMethods"
                  value={method}
                  checked={paymentMethods.includes(method)}
                  onChange={(on) =>
                    setPaymentMethods((current) =>
                      on
                        ? [...current, method]
                        : current.filter((m) => m !== method),
                    )
                  }
                  label={PAYMENT_METHOD_LABELS[method]}
                  compact
                />
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
            <CheckRow
              name="paymentAcknowledged"
              checked={paymentDone}
              onChange={setPaymentDone}
              label="Doy por completado este paso. Cuando habilitemos los pagos te avisamos para completar la suscripción."
              align="start"
            />
          </Panel>
        ) : null}

        {editing ? (
          <EditFooter
            pending={pending}
            canSubmit={canSave}
            dirty={dirty}
            missing={missing.map((s) => s.label)}
            invalid={invalidFields.length}
            onCancel={props.onCancel}
            error={errors.form}
          />
        ) : (
          <Footer
            steps={STEPS}
            step={step}
            onStep={setStep}
            pending={pending}
            canSubmit={canSubmit && invalidFields.length === 0}
            isNew={profile === null}
            missing={missing.map((s) => s.label)}
            invalid={invalidFields.length}
          />
        )}
      </div>
    </form>
    </>
  );
}

/**
 * Aviso previo a bajar de plan.
 *
 * Se pregunta antes y no se avisa después porque lo que sigue no tiene vuelta
 * atrás: en el alta no hay nada guardado en el servidor a lo que recurrir, y
 * lo recortado del borrador no se recupera. Se dice qué se pierde —contado,
 * no en general— para que la respuesta sea informada.
 */
function DowngradeDialog({
  planName,
  losses,
  onAccept,
  onCancel,
}: {
  planName: string;
  losses: string[];
  onAccept: () => void;
  onCancel: () => void;
}) {
  // Escape cancela, como en cualquier diálogo: es la salida sin consecuencias.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="downgrade-title"
      /*
       * En el teléfono se apoya abajo, como el diálogo de planes: un recuadro
       * centrado obliga a estirar el pulgar hasta arriba para responderlo.
       */
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      /*
       * Tocar afuera cancela y no acepta: perder datos tiene que ser algo que
       * se elige a propósito, nunca el resultado de un toque al costado.
       */
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-card bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-card sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FEF3F2]">
            <Icon name="warning" filled className="text-[22px] text-[#B42318]" />
          </span>

          <h2
            id="downgrade-title"
            className="text-[18px] font-bold text-ink sm:text-[19px]"
          >
            Vas a perder datos ya cargados
          </h2>

          <p className="text-[14px] leading-relaxed text-ink-soft">
            El plan {planName} no da para todo lo que cargaste. Si seguís, se
            quita lo último que agregaste hasta que entre en el plan:
          </p>

          {/*
            Qué se pierde, contado. "Vas a perder datos" sin decir cuáles
            obliga a aceptar a ciegas o a cancelar por las dudas.
          */}
          <ul className="flex flex-col gap-1 rounded-input bg-surface-muted px-3.5 py-2.5 text-[13.5px] font-medium text-ink">
            {losses.map((loss) => (
              <li key={loss} className="flex items-center gap-2">
                <Icon name="close" className="text-[15px] text-[#B42318]" />
                {loss}
              </li>
            ))}
          </ul>

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            {/*
              La acción que destruye no es la destacada: el botón sólido
              invita a apretarlo sin leer, y acá lo que se pierde no vuelve.
            */}
            <Button variant="danger" onClick={onAccept}>
              Cambiar y quitar
            </Button>
          </div>
        </div>
      </div>
    </div>
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


/**
 * Barra de pasos: dice dónde estás, qué falta y dónde hay un error.
 *
 * Son dos presentaciones del mismo recorrido, no dos componentes: en el
 * teléfono ocho nodos con su etiqueta no entran ni de lejos —quedaban en un
 * carrusel horizontal donde el paso activo podía estar fuera de la vista— y
 * en escritorio el camino completo se lee de un golpe y vale la pena.
 *
 * La versión de teléfono dice en palabras dónde estás ("Paso 3 de 8") y
 * dibuja el avance en una fila de segmentos, que sí entran: son tocables para
 * volver a un paso ya visto, sin pedir precisión de un píxel porque el área
 * sensible es más alta que la línea que se ve.
 */
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
  const index = steps.findIndex((s) => s.id === current);
  const step = steps[index];

  return (
    <>
      {/* Teléfono: título del paso, cuenta y segmentos de avance. */}
      <div className="flex flex-col gap-2 px-4 sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Icon
              name={hasError[current] ? "error" : (step?.icon ?? "badge")}
              className={`text-[20px] ${
                hasError[current] ? "text-[#B42318]" : "text-brand-800"
              }`}
            />
            <span className="truncate text-[17px] font-bold tracking-[-.2px] text-ink">
              {step?.label}
            </span>
          </span>
          <span className="flex-none text-[12.5px] font-semibold tabular-nums text-ink-soft">
            Paso {index + 1} de {steps.length}
          </span>
        </div>

        {/*
         * Un segmento por paso. El área tocable ocupa toda la altura de la
         * fila aunque la barra sea de 4px: apuntarle a una línea fina con el
         * pulgar es lo que hace que un control así se sienta roto.
         */}
        <div className="flex gap-1">
          {steps.map((item, position) => {
            const failed = hasError[item.id];
            const done = completion[item.id];
            const active = item.id === current;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-label={`Ir al paso ${position + 1}: ${item.label}`}
                aria-current={active ? "step" : undefined}
                className="group flex h-6 flex-1 items-center"
              >
                <span
                  className={`h-1 w-full rounded-full transition-colors ${
                    failed
                      ? "bg-[#D92D20]"
                      : active
                        ? "bg-brand-800"
                        : done
                          ? "bg-[#7CC9A3]"
                          : "bg-line-strong"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/*
       * Escritorio: el recorrido entero. Los pasos van unidos por una línea
       * para que se lean como un camino y no como pestañas sueltas. La línea
       * vive detrás de los nodos (`-z-10`) y se recorta a la altura del
       * círculo.
       */}
      <ol className="hidden items-start sm:flex">
        {steps.map((item, position) => {
          const active = item.id === current;
          const done = completion[item.id];
          const failed = hasError[item.id];
          const previousDone =
            position > 0 && completion[steps[position - 1]!.id];

          return (
            <li
              key={item.id}
              className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5"
            >
              {/* Tramo que llega desde el paso anterior. */}
              {position > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-[18px] -z-10 h-0.5 w-full ${
                    previousDone ? "bg-[#7CC9A3]" : "bg-line-strong"
                  }`}
                />
              ) : null}

              <button
                type="button"
                onClick={() => onSelect(item.id)}
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
                  name={failed ? "error" : done && !active ? "check" : item.icon}
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
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Pie con navegación entre pasos y el guardado.
 *
 * En el teléfono queda pegado abajo: los pasos largos —servicios, zonas,
 * imágenes— pasan de una pantalla, y con el pie al final del contenido había
 * que hacer scroll hasta el fondo cada vez para seguir. Pegado, la acción
 * principal está siempre bajo el pulgar.
 *
 * Ahí la jerarquía se invierte respecto de escritorio: "Siguiente" ocupa el
 * ancho y "Atrás" es un botón chico al lado, porque avanzar es lo que se hace
 * en cada paso y volver es la excepción. En el último paso el que ocupa el
 * ancho es el de crear el perfil.
 */
function Footer({
  steps,
  step,
  onStep,
  pending,
  canSubmit,
  isNew,
  missing,
  invalid,
}: {
  steps: ReadonlyArray<(typeof ALL_STEPS)[number]>;
  step: StepId;
  onStep: (id: StepId) => void;
  pending: boolean;
  canSubmit: boolean;
  isNew: boolean;
  missing: string[];
  /** Cuántos campos tienen algo mal escrito. */
  invalid: number;
}) {
  const index = steps.findIndex((s) => s.id === step);
  const previous = steps[index - 1];
  const next = steps[index + 1];

  const submitLabel = pending
    ? "Guardando…"
    : isNew
      ? "Crear perfil"
      : "Guardar cambios";

  return (
    /*
     * `sticky bottom-0` y no `fixed`: así el pie pertenece a la caja del
     * formulario y no tapa el pie del sitio ni se superpone con nada cuando
     * se llega al final de la página. El `safe-area` es por la barra de
     * gestos del teléfono, que si no se come el botón.
     */
    <div className="sticky bottom-0 z-30 flex flex-col gap-2 border-t border-line-soft bg-surface-muted px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 sm:rounded-b-card sm:px-5 sm:py-3.5">
      {/*
        El estado va arriba de los botones en el teléfono y no al lado: una
        lista de pasos que faltan al lado de un botón lo dejaba de dos
        palabras de ancho.
      */}
      <div className="flex items-center justify-between gap-3 sm:order-2 sm:ml-auto sm:justify-end">
        {invalid > 0 ? (
          /*
            Lo mal escrito se dice antes que lo que falta, y antes que
            "Listo para publicar": con un campo inválido el perfil no está
            listo, y el botón está apagado por eso.
          */
          <span className="text-[12.5px] leading-tight text-[#B42318]">
            {invalid === 1
              ? "Hay un campo con datos inválidos."
              : `Hay ${invalid} campos con datos inválidos.`}
          </span>
        ) : missing.length > 0 ? (
          <span className="text-[12.5px] leading-tight text-ink-soft">
            Falta completar: {missing.join(", ")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1E8C56]">
            <Icon name="check_circle" filled className="text-[15px]" />
            Listo para publicar
          </span>
        )}

        {/* En escritorio el envío va acá, junto al estado. */}
        <Button
          type="submit"
          size="sm"
          disabled={pending || !canSubmit}
          className="hidden sm:inline-flex"
        >
          {submitLabel}
        </Button>
      </div>

      <div className="flex items-center gap-2 sm:order-1 sm:gap-2.5">
        {previous ? (
          <>
            {/* Teléfono: sólo la flecha, para dejarle el ancho a "Siguiente". */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onStep(previous.id)}
              aria-label={`Volver a ${previous.label}`}
              className="h-11 w-11 flex-none px-0 sm:hidden"
            >
              <Icon name="arrow_back" className="text-[20px]" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onStep(previous.id)}
              className="hidden sm:inline-flex"
            >
              <Icon name="arrow_back" className="text-[17px]" />
              {previous.label}
            </Button>
          </>
        ) : null}

        {next ? (
          <>
            {/*
              Teléfono: la acción del paso, a todo el ancho que sobra.

              Dice "Siguiente" y nada más. Nombrar el destino —"Siguiente:
              Servicios"— repetía lo que la barra de pasos ya muestra arriba, y
              con nombres largos el botón se truncaba justo en la parte que
              venía a informar. La flecha de al lado sigue nombrándolo en su
              `aria-label`, para quien no ve la barra.

              Con todo lo obligatorio completo el principal pasa a ser crear el
              perfil, aunque queden pasos por delante: los que faltan son
              opcionales, y obligar a caminarlos hasta el final para encontrar
              el botón sería pedir trabajo por nada. Seguir avanzando se puede
              igual, con el botón que queda al lado.
            */}
            {canSubmit ? (
              <>
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-11 min-w-0 flex-1 text-[15px] sm:hidden"
                >
                  {submitLabel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onStep(next.id)}
                  aria-label={`Seguir a ${next.label}`}
                  className="h-11 w-11 flex-none px-0 sm:hidden"
                >
                  <Icon name="arrow_forward" className="text-[20px]" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => onStep(next.id)}
                className="h-11 min-w-0 flex-1 text-[15px] sm:hidden"
              >
                Siguiente
                <Icon name="arrow_forward" className="flex-none text-[19px]" />
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onStep(next.id)}
              className="hidden sm:inline-flex"
            >
              {next.label}
              <Icon name="arrow_forward" className="text-[17px]" />
            </Button>
          </>
        ) : (
          /* Último paso: el envío es la acción principal del teléfono. */
          <Button
            type="submit"
            disabled={pending || !canSubmit}
            className="h-11 min-w-0 flex-1 text-[15px] sm:hidden"
          >
            {submitLabel}
          </Button>
        )}
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
  invalid,
  error,
  onCancel,
}: {
  pending: boolean;
  canSubmit: boolean;
  /** Si hay algo distinto de lo guardado. */
  dirty: boolean;
  missing: string[];
  /** Cuántos campos tienen algo mal escrito. */
  invalid: number;
  /** El error que no es de ningún campo (clave `form`). */
  error?: string;
  onCancel?: () => void;
}) {
  return (
    /*
     * El `safe-area` es por la barra de gestos del teléfono: pegado abajo sin
     * eso, el botón de guardar queda debajo de ella y se toca la mitad.
     */
    <div className="sticky bottom-0 z-30 flex flex-col gap-2 rounded-b-card border-t border-line-soft bg-surface-muted px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 sm:px-5 sm:py-3.5">
      {/*
        El error que no es de ningún campo va acá y no arriba del formulario:
        este pie está pegado abajo y siempre a la vista, así que es donde queda
        la mirada al apretar "Guardar". Arriba, en un formulario largo, el
        mensaje aparecía fuera de pantalla y el botón parecía no hacer nada.
      */}
      {error ? (
        <p
          role="alert"
          className="flex w-full items-start gap-1.5 text-[13px] font-medium text-[#B42318] sm:order-last"
        >
          <Icon name="error" className="mt-px flex-none text-[15px]" />
          {error}
        </p>
      ) : null}

      {invalid > 0 ? (
        /*
          Con un campo mal escrito el botón está apagado, y hay que decir por
          qué: si no, se lee como que guardar dejó de funcionar. El detalle de
          qué tiene cada campo ya está debajo del campo mismo.
        */
        <span className="text-[12.5px] leading-tight text-[#B42318]">
          {invalid === 1
            ? "Hay un campo con datos inválidos."
            : `Hay ${invalid} campos con datos inválidos.`}
        </span>
      ) : missing.length > 0 ? (
        <span className="text-[12.5px] leading-tight text-ink-soft">
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

      {/*
        Guardar ocupa el ancho en el teléfono y salir queda a su lado: es la
        acción por la que se entró al modo edición.
      */}
      <div className="flex items-center gap-2 sm:ml-auto sm:flex-wrap sm:gap-2.5">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="h-12 flex-none px-3 text-[14px] sm:h-9 sm:px-4 sm:text-[13.5px]"
        >
          <span className="sm:hidden">Salir</span>
          <span className="hidden sm:inline">Salir del modo edición</span>
        </Button>
        <Button
          type="submit"
          disabled={pending || !canSubmit}
          className="h-12 min-w-0 flex-1 text-[15px] sm:h-9 sm:flex-none sm:text-[13.5px]"
        >
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
      <section className="flex flex-col gap-4 border-b border-line-soft p-4 last:border-b-0 sm:p-5">
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
    /*
      El aire entre campos es menor en el teléfono, no mayor: es donde menos
      pantalla hay y cada campo que entra es uno que no hay que ir a buscar
      con el pulgar. Antes iba al revés —20px contra los 16 de escritorio— y
      un paso de tres campos ya obligaba a desplazarse.
    */
    <div
      className={`${active ? "flex" : "hidden"} flex-col gap-3.5 px-4 py-4 sm:gap-4 sm:p-5`}
    >
      {children}
    </div>
  );
}

/**
 * Una casilla con su etiqueta, tocable en todo el renglón.
 *
 * Una casilla nativa mide 16px. Con el dedo eso no se acierta, y el que llena
 * este formulario lo hace casi siempre desde el teléfono, muchas veces parado
 * en una obra. La fila entera es el blanco: 44px de alto —el mínimo cómodo
 * para el pulgar— con borde para que se vea que es algo que se toca y no un
 * texto suelto.
 *
 * Sirve controlada (`checked` + `onChange`) y sin controlar
 * (`defaultChecked`): las formas de pago viven en el DOM y no en React, y
 * pasarles `checked` las dejaría congeladas.
 *
 * `compact` es para las que van de a dos por fila, donde no hay lugar para el
 * mismo alto ni el mismo espaciado.
 */
function CheckRow({
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  label,
  align = "center",
  compact = false,
}: {
  name: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  /** `start` para etiquetas de varias líneas: la casilla se alinea arriba. */
  align?: "center" | "start";
  compact?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-input border border-line bg-white text-ink-muted transition-colors hover:border-line-strong ${
        align === "start" ? "items-start" : "items-center"
      } ${
        compact
          ? "min-h-[44px] px-2.5 py-2 text-[13.5px] sm:min-h-0 sm:border-0 sm:bg-transparent sm:p-0 sm:text-[14px]"
          : "min-h-[44px] px-3 py-2 text-[14.5px] leading-snug sm:min-h-0 sm:border-0 sm:bg-transparent sm:p-0 sm:text-[14px]"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        {...(checked === undefined
          ? { defaultChecked }
          : { checked, onChange: (e) => onChange?.(e.target.checked) })}
        className={`h-5 w-5 flex-none accent-brand-800 sm:h-4 sm:w-4 ${
          align === "start" ? "mt-0.5" : ""
        }`}
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

/** Dos campos por fila en pantallas anchas; apilados en móvil. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">{children}</div>;
}

function Field({
  label,
  error,
  errorId,
  hint,
  required = false,
  half = false,
  counter,
  group = false,
  children,
}: {
  label: string;
  error?: string;
  /**
   * El `id` del mensaje de error, para que el input lo apunte con
   * `aria-describedby`. Va sólo en los campos que validan en el cliente.
   */
  errorId?: string;
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
      <span className="text-[14px] font-semibold text-ink-muted sm:text-[13.5px]">
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

  /*
   * El error se anuncia y se ata al campo.
   *
   * `role="alert"` hace que un lector de pantalla lo lea al aparecer, y el
   * `id` es el que apunta el `aria-describedby` del input: sin él, quien no ve
   * el borde rojo no tiene forma de saber que ese campo tiene un problema, ni
   * cuál.
   */
  const footer = error ? (
    <span
      id={errorId}
      role="alert"
      className="flex items-start gap-1.5 text-[13px] font-medium text-[#B42318] sm:text-[12.5px]"
    >
      <Icon name="error" className="mt-px flex-none text-[15px]" />
      {error}
    </span>
  ) : hint ? (
    /*
     * La nota se lee como nota y no como un tercer gris más del formulario.
     *
     * Antes era `text-ink-faint` suelto debajo del campo: entre el label
     * (`ink-muted`), el texto tipeado (`ink`) y esto, la pantalla tenía tres
     * grises sin jerarquía y no se entendía cuál era ayuda. Un rótulo
     * "Nota", el icono y la barra lateral en azul de marca la separan del
     * resto sin agregar otro tono de gris, y el texto sube a `ink-soft` para
     * que se pueda leer.
     */
    <span className="flex items-start gap-2 rounded-r-[8px] border-l-2 border-brand-600/35 bg-brand-100/60 py-1.5 pl-2.5 pr-3 text-[13px] leading-snug text-ink-soft sm:text-[12.5px]">
      <Icon
        name="lightbulb"
        className="mt-px flex-none text-[15px] text-brand-600"
      />
      <span className="min-w-0">
        <span className="font-semibold text-brand-800">Nota: </span>
        {hint}
      </span>
    </span>
  ) : null;

  const className = `flex flex-col gap-1 sm:gap-1.5 ${half ? "" : "w-full"}`;

  if (group) {
    return (
      <fieldset className={className}>
        {/* `legend` en flujo normal: no se quiere el corte del borde. */}
        <legend className="mb-1 flex w-full items-baseline justify-between gap-2 sm:mb-1.5">
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
  /**
   * Sin esto el elemento no se puede quitar: la cruz se ve apagada.
   *
   * Es para lo que está puesto por omisión y no por elección —la cobertura
   * nacional de quien no eligió zonas—: no hay nada que sacar, porque sacarlo
   * lo dejaría igual.
   */
  onRemove?: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-brand-100 py-1.5 pl-3.5 pr-1.5 text-[13.5px] font-semibold text-brand-800 sm:gap-1.5 sm:py-1 sm:pl-3 sm:text-[13px]">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {label}
      {detail ? (
        <span className="font-medium text-[#5B6B87]">{detail}</span>
      ) : null}
      {/* Igual que en `SearchSelect`: con el dedo, 20px de cruz no se acierta. */}
      <button
        type="button"
        aria-label={`Quitar ${label}`}
        onClick={onRemove}
        disabled={!onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors enabled:hover:bg-brand-800 enabled:hover:text-white disabled:cursor-default disabled:opacity-40 sm:h-5 sm:w-5"
      >
        <Icon name="close" className="text-[16px] text-[#5B6B87] sm:text-[15px]" />
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
  /*
   * Tono de advertencia y no el gris de antes: esto no es un dato de color
   * sino un tope ya alcanzado que frena lo que se está haciendo. En gris se
   * leía como una nota al pie y se seguía intentando agregar.
   */
  return (
    <p className="flex flex-wrap items-center gap-1.5 rounded-input border border-warning-line bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
      <Icon name="warning" className="text-[15px] text-warning" />
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

/*
 * `text-[16px]` en el teléfono no es una decisión de tipografía: iOS hace zoom
 * automático al enfocar un campo de menos de 16px, y de ahí la página queda
 * corrida y hay que pellizcar para volver. Desde `sm` vale el tamaño del
 * sistema visual.
 *
 * 44px de alto en todas las pantallas: es el mínimo que se toca cómodo con el
 * pulgar y no hace falta más. Los 48 que llevaba el teléfono no se tocaban
 * mejor y sumaban media pantalla cada seis campos.
 */
function inputClass(error?: string): string {
  return `h-11 w-full rounded-input border bg-white px-3.5 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-800 sm:text-[14.5px] ${
    error ? "border-[#FDA29B]" : "border-line-strong"
  }`;
}
