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

/** Rol de una imagen del perfil: foto, portada o galería. */
export type ImageKind = "avatar" | "cover" | "gallery";

export type ProfileImage = {
  id: string;
  storageKey: string;
  url: string;
  alt: string;
  kind: ImageKind;
  sortOrder: number;
  /** false cuando excede el cupo del plan (BR-009). */
  isActive: boolean;
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
export type SearchFilters = {
  query: string;
  /** IDs de ubicación seleccionados. Máximo 5. */
  locationIds: string[];
  /** IDs de especialidad seleccionados. Máximo 5. */
  specialtyIds: string[];
  minRating: number | null;
  paymentMethods: PaymentMethod[];
  useMyLocation: boolean;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  locationIds: [],
  specialtyIds: [],
  minRating: null,
  paymentMethods: [],
  useMyLocation: false,
};

/** Reglas de producto expresadas como constantes. */
export const MAX_LOCATIONS = 5;
export const MAX_SPECIALTIES = 5;
/** 12 divide exacto por 1, 2, 3 y 4 columnas: nunca deja una fila coja. */
export const PAGE_SIZE = 12;
/** 8 completa dos filas de 4 y cuatro de 2, sin huecos en ningún ancho. */
export const HOME_SECTION_SIZE = 8;
