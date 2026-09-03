/** Contratos de dominio compartidos por el marketplace. */

/**
 * Ubicación como Master Data: colección plana, IDs estables y slugs
 * predefinidos. La jerarquía se deriva en la UI, no en los datos.
 */
/**
 * Una ubicación seleccionable, en cualquiera de sus cuatro niveles: país,
 * departamento, localidad o barrio. Cada nivel existe como fila propia con su
 * id, así quien se registra elige hasta donde quiera precisar y no se le
 * obliga a bajar a un barrio que no le corresponde (RF-117).
 *
 * Los campos se van llenando de lo general a lo particular: el país siempre,
 * el resto según el nivel. `level` dice cuál es el último con valor.
 */
export type LocationLevel = "country" | "department" | "locality" | "area";

export type Location = {
  id: string;
  level: LocationLevel;
  department?: string;
  departmentSlug?: string;
  locality?: string;
  localitySlug?: string;
  area?: string;
  areaSlug?: string;
};

export type Category = {
  id: string;
  slug: string;
  /** Nombre completo, para títulos y SEO. */
  name: string;
  /** Nombre corto, para navegación y menús. */
  short: string;
  /** Material Symbols: un icono propio y constante por categoría. */
  icon: string;
  providerCount: number;
  subcategories: Subcategory[];
};

export type Subcategory = {
  id: string;
  slug: string;
  name: string;
};

export type ProviderKind = "individual" | "business";

export type ProviderStatus =
  | "draft"
  | "active"
  | "pending_verification"
  | "suspended"
  | "inactive";

export type UserRole = "provider" | "admin" | "superadmin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
};

/** Rol de una imagen del perfil: foto, portada o galería. */
export type ImageKind = "avatar" | "cover" | "gallery";

export type ProviderImage = {
  id: string;
  storageKey: string;
  url: string;
  alt: string;
  kind: ImageKind;
  /** false cuando quedó fuera del plan contratado (RF-053). */
  active: boolean;
};

export type PaymentMethod =
  | "Efectivo"
  | "Transferencia"
  | "Débito"
  | "Crédito"
  | "Otros";

export type Provider = {
  id: string;
  /**
   * Dueño del perfil. Permite saber si quien mira es quien lo creó, que es lo
   * que habilita a ver en vista previa un perfil todavía sin publicar.
   */
  userId: string;
  slug: string;
  name: string;
  kind: ProviderKind;
  icon: string;
  /** null cuando el proveedor todavía no tiene opiniones. */
  rating: number | null;
  reviewCount: number;
  categoryId: string;
  subcategoryId: string;
  /** Dónde está ubicado el proveedor. */
  locationId: string;
  /** Dónde presta servicio: distinto de su ubicación física. */
  serviceAreaIds: string[];
  services: string[];
  description: string;
  featured: boolean;
  verified: boolean;
  phone: string;
  whatsapp: string;
  schedule: string;
  paymentMethods: PaymentMethod[];
  /** Presentes cuando el proveedor viene de la base; opcionales en datos de ejemplo. */
  status?: ProviderStatus;
  images?: ProviderImage[];

  /** Plan contratado. Los datos de ejemplo no lo traen. */
  planId?: PlanId;
  /** Plan al que se baja al vencer el período, o null si no hay baja. */
  downgradePlanId?: PlanId | null;
  /** Fin del período pago (ISO). NULL en Cobre, que no vence. */
  planExpiresAt?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  verificationStatus?: VerificationStatus;

  /** RF-013: el teléfono normalizado; de acá salen tel: y wa.me. */
  phoneE164?: string;
  whatsappEnabled?: boolean;
  phonePublic?: boolean;
  publicEmail?: string;
  serviceMode?: ServiceMode;

  /** RF-011: subcategorías adicionales; `subcategoryId` sigue siendo la principal. */
  subcategoryIds?: string[];
  /** RF-170: horarios por día. `schedule` queda como resumen legible. */
  hours?: DayHours[];
  socialLinks?: SocialLink[];
  teamMembers?: TeamMember[];
};

/** Estado de moderación de una opinión (RF-176). */
export type ReviewStatus = "pending" | "published" | "hidden" | "reported";

export type Review = {
  id: string;
  providerId: string;
  authorName: string;
  /** Avatar de Google, cuando la opinión viene de un cliente identificado. */
  authorAvatarUrl?: string;
  rating: number;
  comment: string;
  /** ISO date, para poder formatear en el servidor sin desajustes. */
  createdAt: string;
  updatedAt?: string;
  /**
   * true cuando el autor es el cliente que está mirando: habilita editar y
   * borrar su propia opinión (RF-151) sin exponer esa acción a los demás.
   */
  isMine?: boolean;
  /** RF-178: se indica que hay identidad, no que hubo contratación. */
  identified?: boolean;
};

/** Motivos de reporte de una opinión (RF-154). */
export type ReviewReportReason =
  | "spam"
  | "offensive"
  | "false_info"
  | "personal_info"
  | "conflict"
  | "other";

// ---------------------------------------------------------------------------
// Planes (RF-050 a RF-053)
// ---------------------------------------------------------------------------

export type PlanId = "cobre" | "gold" | "platinum";

export type MetricsLevel = "basic" | "intermediate" | "full";

/**
 * Plan con sus límites. Se lee de la base: RF-096 pide que precios y topes
 * sean configurables sin desplegar código.
 */
export type PlanLimits = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: string;
  period: "month" | "year";
  rank: number;
  maxServices: number;
  maxSubcategories: number;
  maxServiceAreas: number;
  maxGalleryImages: number;
  maxTeamMembers: number;
  allowsSocialLinks: boolean;
  allowsLanding: boolean;
  allowsFeatured: boolean;
  allowsContactForm: boolean;
  allowsVerificationRequest: boolean;
  metricsLevel: MetricsLevel;
};

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

/** RF-084: la verificación se otorga tras validar, no por pagar. */
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

/** RF-029: dónde presta el servicio. */
export type ServiceMode = "on_site" | "at_business" | "remote" | "hybrid";

export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  on_site: "A domicilio",
  at_business: "En mi local",
  remote: "Remoto",
  hybrid: "Combinado",
};

/** RF-170: horario de un día. `null` en las horas cuando cierra o es 24h. */
export type DayHours = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
  open24h: boolean;
};

export const WEEKDAY_LABELS = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "youtube"
  | "website";

export type SocialLink = { platform: SocialPlatform; url: string };

export type TeamMember = {
  id: string;
  name: string;
  /** Cargo. En el formulario se muestra como «Título». */
  role: string;
  subtitle: string;
  bio: string;
  photoKey: string;
  position: number;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Clientes (RF-123, RF-125, RF-175)
// ---------------------------------------------------------------------------

/**
 * Cliente que busca servicios. No tiene contraseña propia: la identidad la
 * aporta Google y sólo se pide cuando quiere participar (RF-124).
 */
export type ConsumerUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  status: "active" | "suspended";
  createdAt: string;
};

/** Estado de búsqueda compartido entre el buscador y el panel de filtros. */
export type SearchFilters = {
  query: string;
  /** IDs de ubicación seleccionados. Máximo 5. */
  locationIds: string[];
  /** IDs de subcategoría seleccionados. Máximo 5. */
  subcategoryIds: string[];
  minRating: number | null;
  paymentMethods: PaymentMethod[];
  useMyLocation: boolean;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  locationIds: [],
  subcategoryIds: [],
  minRating: null,
  paymentMethods: [],
  useMyLocation: false,
};

/** Reglas de producto expresadas como constantes. */
export const MAX_LOCATIONS = 5;
export const MAX_SUBCATEGORIES = 5;
/** 12 divide exacto por 1, 2, 3 y 4 columnas: nunca deja una fila coja. */
export const PAGE_SIZE = 12;
/** 8 completa dos filas de 4 y cuatro de 2, sin huecos en ningún ancho. */
export const HOME_SECTION_SIZE = 8;
