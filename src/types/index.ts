/** Contratos de dominio compartidos por el marketplace. */

// ---------------------------------------------------------------------------
// Geografía (BR-014 a BR-016)
// ---------------------------------------------------------------------------

/**
 * Los tres niveles del catálogo: Uruguay → departamento → localidad. No hay un
 * cuarto: los barrios se eliminaron del modelo y la localidad es el nivel más
 * preciso (BR-014).
 */
export type LocationType = "country" | "department" | "locality";

/**
 * Una ubicación del catálogo. El árbol se arma con `parentId`, que es null
 * únicamente en Uruguay.
 *
 * Las filas las genera `npm run generate:locations` desde
 * `docs/data/locations.md` y son las mismas que pueblan la tabla `locations`.
 */
export type Location = {
  id: string;
  parentId: string | null;
  type: LocationType;
  name: string;
  slug: string;
};

// ---------------------------------------------------------------------------
// Taxonomía (BR-010 a BR-013)
// ---------------------------------------------------------------------------

/** Un rubro: agrupa especialidades. En persistencia, `service_sector`. */
export type ServiceSector = {
  id: string;
  name: string;
  slug: string;
  /** Nombre corto, del que se deriva el id (TR-020). */
  short: string;
  /** Material Symbols: un icono propio y constante por rubro. */
  icon: string;
  sortOrder: number;
};

/** Una especialidad dentro de un rubro. */
export type Specialty = {
  id: string;
  serviceSectorId: string;
  name: string;
  slug: string;
  /** Oficios y nombres equivalentes que permiten encontrar la especialidad. */
  aliases: string[];
  /** BR-020: exige una habilitación aprobada y vigente para publicarse. */
  requiresProfessionalCredential: boolean;
  sortOrder: number;
};

/**
 * Una sugerencia de servicio del catálogo. No es lo mismo que un servicio del
 * perfil: esto es lo que se ofrece al autocompletar, y lo que se guarda es el
 * texto que la persona confirmó (BR-011).
 */
export type ServiceSuggestion = {
  id: string;
  serviceSectorId: string;
  specialtyId: string;
  name: string;
  /** Sinónimos y términos regionales. Sólo para buscar: nunca se muestran. */
  aliases: string[];
};

/** Un servicio ya guardado en un perfil. */
export type ProfileService = {
  id: string;
  specialtyId: string;
  name: string;
  /** false cuando quedó fuera del plan contratado (BR-009). */
  isActive: boolean;
  sortOrder: number;
};

export type ServiceCardPriceKind = "quote" | "fixed" | "from" | "range";
export type ServiceCardTier = "economy" | "standard" | "premium";

/** Una oferta concreta que aparece por separado del perfil en las búsquedas. */
export type ServiceCard = {
  id: string;
  profileId: string;
  providerSlug: string;
  providerName: string;
  providerIcon: string;
  providerVerified: boolean;
  providerRating: number | null;
  providerReviewCount: number;
  providerLocationId: string;
  specialtyId: string;
  /** Servicio concreto del perfil del que nace esta oferta. */
  serviceId: string;
  serviceName: string;
  slug: string;
  title: string;
  description: string;
  priceKind: ServiceCardPriceKind;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  currency: "UYU";
  tier: ServiceCardTier;
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
  serviceMode: ServiceModeCode;
  paymentMethod: PaymentMethod | null;
  schedule: string;
  imageId: string | null;
  imageUrl: string | null;
  /** La primera es la portada de la carta; las restantes son muestras. */
  images: ProfileImage[];
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// Cuentas y perfiles
// ---------------------------------------------------------------------------

export type UserRole = "provider" | "admin" | "superadmin";

/**
 * Cuenta con acceso a la plataforma. No tiene nombre: el nombre es del perfil.
 * El registro sólo pide correo y contraseña (`docs/ui/register_form.md`).
 */
export type User = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
};

export type ProfileType = "individual" | "business";

/** BR-003: sólo `active` es visible públicamente. */
export type ProfileStatus = "draft" | "active" | "suspended" | "inactive";

/** BR-019: la insignia comercial del perfil. Sólo `verified` la muestra. */
export type VerificationStatus =
  | "not_requested"
  | "pending"
  | "verified"
  | "rejected";

/**
 * BR-017: las tres modalidades. "Híbrida" no está acá porque no es una cuarta
 * modalidad: se deriva de haber elegido más de una, y los valores derivados no
 * se persisten (TR-001).
 */
export type ServiceModeCode = "at_customer" | "at_business" | "remote";

export const SERVICE_MODE_LABELS: Record<ServiceModeCode, string> = {
  at_customer: "A domicilio",
  at_business: "En nuestro local",
  remote: "A distancia",
};

/** Códigos en inglés (TR-001); las etiquetas en español son de la UI. */
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "debit_card"
  | "credit_card"
  | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  debit_card: "Débito",
  credit_card: "Crédito",
  other: "Otros",
};

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "youtube"
  | "website";

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
  /** BR-022: en Cobre se conservan, pero inactivos. */
  isActive: boolean;
};

/** Rol visual de una imagen: perfil, portada, galería o carta de servicio. */
export type ImageKind = "avatar" | "cover" | "gallery" | "service";

/**
 * Dónde está una imagen dentro de su ciclo de vida (TR-043).
 *
 * `pending` se subió pero todavía no la confirmó ningún guardado: existe, es
 * de quien la subió, y expira sola si nadie la usa. `confirmed` es la que se
 * muestra. `discarded` está marcada para que la limpieza se la lleve.
 */
export type ImageLifecycle = "pending" | "confirmed" | "discarded";

export type ProfileImage = {
  id: string;
  storageKey: string;
  url: string;
  alt: string;
  kind: ImageKind;
  sortOrder: number;
  /** false cuando no se muestra en el perfil. El motivo, en `hiddenReason`. */
  isActive: boolean;
  /**
   * Por qué no se muestra, cuando `isActive` es false (BR-009).
   *
   * `owner` la ocultó el proveedor —un servicio que por ahora no da— y no se
   * borra nunca. `plan` no entra en el plan vigente tras una baja, y es un
   * dato excedente que puede eliminarse a los 180 días.
   *
   * La distinción existe para que una limpieza no se lleve lo que alguien
   * escondió a propósito creyendo que sólo lo escondía.
   */
  hiddenReason: "owner" | "plan" | null;
  galleryState: "available" | "semi" | "frozen";
  ownerHidden: boolean;
  hiddenAt: string | null;
  galleryRevision: string | null;
  gallerySelectionPending: boolean;
  lifecycle: ImageLifecycle;
  /** Tamaño de la versión procesada. 0 en las filas anteriores a TR-042. */
  width: number;
  height: number;
};

/**
 * Una ubicación física del perfil: local, consultorio o sucursal (BR-015). Es
 * distinta del área donde presta servicio.
 */
export type ProfileLocation = {
  id: string;
  locationId: string;
  name: string | null;
  address: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

/** Una línea de horario en texto libre (BR-024). */
export type ScheduleEntry = {
  id: string;
  text: string;
  sortOrder: number;
};

/** BR-020: habilitación profesional de una especialidad regulada. */
export type CredentialStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "revoked"
  | "expired";

export type ProfessionalCredential = {
  id: string;
  specialtyId: string;
  credentialName: string;
  credentialNumber: string;
  issuingAuthority: string;
  status: CredentialStatus;
  expiresAt: string | null;
  submittedAt: string;
  rejectionReason: string;
};

/**
 * El profesional o empresa que ofrece servicios.
 *
 * Los rubros no son un campo: se derivan de las especialidades activas
 * (BR-010). Tampoco lo son el promedio ni la modalidad híbrida, que se
 * calculan al mostrar (TR-001).
 */
export type Profile = {
  id: string;
  /**
   * Dueño del perfil. Permite saber si quien mira es quien lo creó, que es lo
   * que habilita a ver en vista previa un perfil todavía sin publicar.
   */
  userId: string;
  slug: string;
  name: string;
  type: ProfileType;
  description: string;
  icon: string;

  contactEmail: string;
  phone: string;
  phoneE164: string;
  /** null mientras no se verificó el teléfono actual (TR-010). */
  phoneVerifiedAt: string | null;
  whatsappEnabled: boolean;
  phonePublic: boolean;

  profileStatus: ProfileStatus;
  verificationStatus: VerificationStatus;

  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  /** Fin del período pago (ISO). null en Cobre, que no vence. */
  planExpiresAt: string | null;
  /** Plan al que se baja al vencer, o null si no hay baja agendada. */
  downgradePlanId: PlanId | null;
  /** Cuándo se cerró el aviso de la baja, o null si no se cerró. */
  downgradeNoticeDismissedAt: string | null;
  /** Cuándo se cerró el recordatorio de los últimos días, o null. */
  downgradeNoticeRemindedAt: string | null;

  /** null cuando el perfil todavía no tiene opiniones (BR-026). */
  rating: number | null;
  reviewCount: number;

  specialtyIds: string[];
  services: ProfileService[];
  serviceModes: ServiceModeCode[];
  serviceAreaIds: string[];
  locations: ProfileLocation[];
  paymentMethods: PaymentMethod[];
  scheduleEntries: ScheduleEntry[];
  socialLinks: SocialLink[];
  images: ProfileImage[];
};

// ---------------------------------------------------------------------------
// Planes (BR-006 a BR-009)
// ---------------------------------------------------------------------------

export type PlanId = "cobre" | "gold" | "platinum";

export type MetricsLevel = "basic" | "intermediate" | "advanced";

/**
 * Plan con sus límites y capacidades. Se lee de la base, no de condicionales
 * repartidos por el código (TR-014).
 *
 * Un tope en `null` es "sin límite comercial"; en `0`, "capacidad no incluida"
 * (TR-002). Son cosas distintas y por eso no se colapsan en un número.
 */
export type PlanLimits = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: string;
  period: "month" | "year";
  rank: number;
  maxServiceSectors: number | null;
  maxSpecialties: number | null;
  maxServices: number | null;
  maxLocations: number | null;
  maxGalleryImages: number | null;
  maxServiceCards: number;
  allowsSocialLinks: boolean;
  allowsVerificationRequest: boolean;
  allowsFeaturedPlacement: boolean;
  allowsContactForm: boolean;
  allowsCustomLanding: boolean;
  allowsSubdomain: boolean;
  metricsLevel: MetricsLevel;
};

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

// ---------------------------------------------------------------------------
// Clientes y opiniones (BR-025 a BR-027)
// ---------------------------------------------------------------------------

/**
 * Cliente que busca servicios. No tiene contraseña propia: la identidad la
 * aporta Google y sólo se pide cuando quiere opinar (BR-025).
 */
export type ConsumerUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  status: "active" | "suspended";
  createdAt: string;
};

/** BR-026: sólo `published` se muestra y suma a la calificación. */
export type ReviewStatus = "published" | "hidden";

export type Review = {
  id: string;
  profileId: string;
  authorName: string;
  /** Avatar de Google, cuando la opinión viene de un cliente identificado. */
  authorAvatarUrl?: string;
  rating: number;
  comment: string;
  /** ISO date, para poder formatear en el servidor sin desajustes. */
  createdAt: string;
  updatedAt?: string;
  /**
   * true cuando el autor es el cliente que está mirando: habilita editar su
   * propia opinión sin exponer esa acción a los demás.
   */
  isMine?: boolean;
  /** Se indica que hay identidad, no que hubo contratación. */
  identified?: boolean;
};

export type ReviewReportReason =
  | "spam"
  | "offensive"
  | "false_info"
  | "personal_info"
  | "conflict"
  | "other";

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

/** Estado de búsqueda compartido entre el buscador y el panel de filtros. */
/**
 * Qué clase de resultado se busca.
 *
 * Los dos primeros son perfiles, y se distinguen por `Profile.type`. `service`
 * es la carta de servicio —una propuesta puntual publicada por un proveedor—,
 * que se consulta como entidad independiente.
 */
export type ResultKind = "individual" | "business" | "service";

export const RESULT_KIND_LABELS: Record<ResultKind, string> = {
  individual: "Proveedor independiente",
  business: "Empresa o equipo",
  service: "Cartas de servicio",
};

export type SearchFilters = {
  query: string;
  /**
   * Qué se busca: perfiles independientes, empresas, cartas de servicio.
   * Vacío es "todos", igual que el resto de los filtros de lista.
   */
  resultKinds: ResultKind[];
  /** IDs de ubicación seleccionados. Sin tope. */
  locationIds: string[];
  /** IDs de especialidad seleccionados. Sin tope. */
  specialtyIds: string[];
  minRating: number | null;
  paymentMethods: PaymentMethod[];
  /** Modalidades de atención (BR-017). Vacío es "todas". */
  serviceModes: ServiceModeCode[];
  useMyLocation: boolean;
};

export type SearchMatchReason =
  | "provider_name"
  | "declared_service"
  | "card_title"
  | "description"
  | "specialty"
  | "discovery";

/** Interpretación serializable de la frase que usa la búsqueda pública. */
export type SearchQueryPlan = {
  original: string;
  normalized: string;
  /** Frases equivalentes comprobadas contra el catálogo, en orden de fuerza. */
  phrases: string[];
  /** Términos centrales para frases que no coinciden como bloque. */
  coreTerms: string[];
  /** Especialidades que ayudan a recuperar oficios o armar relacionados. */
  specialtyIds: string[];
  /** Servicios canónicos que representan la actividad concreta solicitada. */
  serviceIds: string[];
  /** Naturaleza de la intención reconocida; controla qué evidencia alcanza. */
  intent: "empty" | "specialty" | "service" | "text";
  /** Expresión útil, sin introducciones como «necesito un». */
  exactTerms: string[];
  /** Sólo true cuando la consulta representa un oficio/especialidad amplia. */
  allowSpecialtyMatch: boolean;
  label: string | null;
  suggestedQuery: string | null;
  inferredMode: ServiceModeCode | null;
  exclusions: string[];
};

export type SearchSuggestion = {
  label: string;
  href: string;
  detail: string;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  resultKinds: [],
  locationIds: [],
  specialtyIds: [],
  minRating: null,
  paymentMethods: [],
  serviceModes: [],
  useMyLocation: false,
};
/** 12 divide exacto por 1, 2, 3 y 4 columnas: nunca deja una fila coja. */
export const PAGE_SIZE = 12;
/**
 * Cuántos perfiles muestra cada sección de la portada.
 *
 * Cuatro: la fila entera de la grilla en `xl`, que es donde se mira la
 * portada de escritorio. La portada es un índice, no un listado —cada sección
 * lleva su "Ver todos" al listado completo—, y con ocho la página se hacía
 * larga sin agregar nada que no estuviera a un clic.
 */
export const HOME_SECTION_SIZE = 4;
