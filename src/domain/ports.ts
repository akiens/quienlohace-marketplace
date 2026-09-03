import type {
  PaymentMethod,
  PlanId,
  Provider,
  ServiceMode,
  SocialLink,
  ProviderKind,
  ProviderStatus,
  Review,
  ReviewReportReason,
  SearchFilters,
  User,
  UserRole,
} from "@/types";

/**
 * Puertos del dominio. La lógica de aplicación depende de estas interfaces,
 * nunca de D1 ni de `env.DB`. Los adapters concretos viven en
 * `src/infrastructure/`, de modo que cambiar D1 por Postgres no obliga a
 * reescribir casos de uso.
 */

export type ProviderDraft = {
  name: string;
  kind: ProviderKind;
  description: string;
  categoryId: string;
  subcategoryId: string;
  locationId: string;
  phone: string;
  whatsapp: string;
  /** Derivado de `phone`; lo usan `tel:` y el orden de búsqueda. */
  phoneE164: string;
  whatsappEnabled: boolean;
  schedule: string;
  serviceMode: ServiceMode;
  services: string[];
  serviceAreaIds: string[];
  /** Subcategorías adicionales; `subcategoryId` es la principal. */
  subcategoryIds: string[];
  paymentMethods: PaymentMethod[];
  socialLinks: SocialLink[];
  teamMembers: TeamMemberDraft[];
};

/** Un integrante todavía sin id: lo asigna el repositorio. */
export type TeamMemberDraft = {
  name: string;
  role: string;
  subtitle: string;
  bio: string;
};

/**
 * Elementos que exceden el plan y quedan guardados pero inactivos (RF-053).
 * La acción los calcula; el repositorio sólo obedece.
 */
export type DraftLimits = {
  services: number;
  serviceAreas: number;
  subcategories: number;
  teamMembers: number;
  galleryImages: number;
  /** Las redes son todo o nada: el plan las permite o no. */
  social: boolean;
};

export interface ProviderRepository {
  findBySlug(slug: string): Promise<Provider | null>;
  /** Perfiles publicados con nombre parecido, para sugerir ante un 404. */
  findSimilarByName(slug: string, limit: number): Promise<Provider[]>;
  findByUserId(userId: string): Promise<Provider | null>;
  search(filters: SearchFilters, limit: number, offset: number): Promise<Provider[]>;
  countForSearch(filters: SearchFilters): Promise<number>;
  listByCategory(categoryId: string): Promise<Provider[]>;
  listBySubcategory(subcategoryId: string): Promise<Provider[]>;
  listFeatured(): Promise<Provider[]>;
  listPublishedSlugs(): Promise<string[]>;
  create(
    userId: string,
    draft: ProviderDraft,
    planId?: PlanId,
    limits?: DraftLimits,
  ): Promise<Provider>;
  update(
    providerId: string,
    draft: ProviderDraft,
    limits?: DraftLimits,
  ): Promise<Provider>;
  /** Activa un plan de inmediato y corre el vencimiento (subir de plan). */
  setPlan(
    providerId: string,
    planId: PlanId,
    expiresAt?: string | null,
    subscriptionStatus?: "active" | "past_due",
  ): Promise<void>;
  /** Marca el plan como pago: cierra el paso pendiente del asistente. */
  markPlanPaid(providerId: string): Promise<void>;
  /** Agenda una baja para el fin del período pago (no toca el plan vigente). */
  scheduleDowngrade(input: {
    providerId: string;
    downgradePlanId: PlanId;
    expiresAt: string | null;
    purgeAfter: string;
  }): Promise<void>;
  /** Deja sin efecto una baja agendada. */
  cancelDowngrade(providerId: string): Promise<void>;
  /** Consolida una baja ya vencida en la fila. */
  applyDueDowngrade(providerId: string, planId: PlanId): Promise<void>;
  setStatus(providerId: string, status: ProviderStatus): Promise<void>;
}

export interface ReviewRepository {
  /** `viewerConsumerId` marca la opinión propia de quien mira (RF-151). */
  listForProvider(
    providerId: string,
    viewerConsumerId?: string | null,
  ): Promise<Review[]>;
  findByConsumer(providerId: string, consumerId: string): Promise<Review | null>;
  create(input: {
    providerId: string;
    authorId: string | null;
    consumerId?: string | null;
    authorName: string;
    rating: number;
    comment: string;
  }): Promise<Review>;
  updateOwn(input: {
    reviewId: string;
    consumerId: string;
    rating: number;
    comment: string;
  }): Promise<boolean>;
  deleteOwn(reviewId: string, consumerId: string): Promise<boolean>;
  report(input: {
    reviewId: string;
    consumerId: string | null;
    userId: string | null;
    reason: ReviewReportReason;
    detail: string;
  }): Promise<void>;
}

export type NewUser = {
  email: string;
  name: string;
  passwordHash: string | null;
  role?: UserRole;
};

export interface UserRepository {
  findByEmail(email: string): Promise<(User & { passwordHash: string | null }) | null>;
  findById(id: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
}

export interface SessionRepository {
  /** `id` es el hash del token, nunca el token en claro. */
  create(input: { id: string; userId: string; expiresAt: Date }): Promise<void>;
  findValid(id: string, now: Date): Promise<{ userId: string } | null>;
  delete(id: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}

export type StoredFile = { key: string; url: string };

export interface FileStorage {
  put(input: {
    key: string;
    body: ArrayBuffer;
    contentType: string;
  }): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
