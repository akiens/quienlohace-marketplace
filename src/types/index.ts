/** Contratos de dominio compartidos por el marketplace. */

/**
 * Ubicación como Master Data: colección plana, IDs estables y slugs
 * predefinidos. La jerarquía se deriva en la UI, no en los datos.
 */
export type Location = {
  id: string;
  department: string;
  departmentSlug: string;
  locality: string;
  localitySlug: string;
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

export type ProviderImage = {
  id: string;
  storageKey: string;
  url: string;
  alt: string;
};

export type PaymentMethod =
  | "Efectivo"
  | "Transferencia"
  | "Débito"
  | "Crédito"
  | "Otros";

export type Provider = {
  id: string;
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
};

export type Review = {
  id: string;
  providerId: string;
  authorName: string;
  rating: number;
  comment: string;
  /** ISO date, para poder formatear en el servidor sin desajustes. */
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
