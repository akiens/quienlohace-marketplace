import type { DowngradeNoticeStage } from "@/domain/plan-changes";
import type {
  PaymentMethod,
  PlanId,
  Profile,
  ProfileStatus,
  ProfileType,
  Review,
  ReviewReportReason,
  SearchFilters,
  ServiceModeCode,
  SocialLink,
  User,
  UserRole,
} from "@/types";

/**
 * Puertos del dominio. La lógica de aplicación depende de estas interfaces,
 * nunca de D1 ni de `env.DB`. Los adapters concretos viven en
 * `src/infrastructure/`, de modo que cambiar D1 por Postgres no obliga a
 * reescribir casos de uso.
 */

/**
 * Lo que el formulario de perfil manda para crear o actualizar.
 *
 * No trae rubros: se derivan de las especialidades (BR-010). Tampoco trae
 * estado ni plan, que no se cambian desde el formulario.
 */
export type ProfileDraft = {
  name: string;
  type: ProfileType;
  description: string;
  icon: string;
  contactEmail: string;
  phone: string;
  /** Derivado de `phone`; lo usan `tel:` y `wa.me`. */
  phoneE164: string;
  whatsappEnabled: boolean;
  phonePublic: boolean;
  /** Las especialidades elegidas del catálogo, en orden de prioridad. */
  specialtyIds: string[];
  services: ServiceDraft[];
  /** BR-017: una o varias. Con más de una, la ficha muestra atención híbrida. */
  serviceModes: ServiceModeCode[];
  /** Ya normalizadas según TR-018 antes de llegar acá. */
  serviceAreaIds: string[];
  locations: ProfileLocationDraft[];
  paymentMethods: PaymentMethod[];
  /** Hasta 10 líneas de texto libre (BR-024). */
  scheduleEntries: string[];
  /*
   * Sin `isActive`: si la red se muestra o no lo decide el plan (BR-022) y lo
   * aplica el repositorio, no el formulario.
   */
  socialLinks: Array<Omit<SocialLink, "isActive">>;
};

/** Un servicio todavía sin id: lo asigna el repositorio. */
export type ServiceDraft = {
  /** La especialidad a la que pertenece. Debe estar en `specialtyIds`. */
  specialtyId: string;
  name: string;
};

/** Una ubicación física todavía sin id: lo asigna el repositorio. */
export type ProfileLocationDraft = {
  locationId: string;
  name: string | null;
  address: string | null;
  isPrimary: boolean;
};

/**
 * Cuántos elementos de cada tipo quedan activos según el plan (BR-009). El
 * resto se guarda inactivo. `null` es "sin límite": entran todos.
 *
 * La acción los calcula; el repositorio sólo obedece.
 */
export type DraftLimits = {
  specialties: number | null;
  services: number | null;
  locations: number | null;
  galleryImages: number | null;
  /** Las redes son todo o nada: el plan las permite o no. */
  social: boolean;
};

export interface ProfileRepository {
  findBySlug(slug: string): Promise<Profile | null>;
  /** Perfiles publicados con nombre parecido, para sugerir ante un 404. */
  findSimilarByName(slug: string, limit: number): Promise<Profile[]>;
  findByUserId(userId: string): Promise<Profile | null>;
  search(filters: SearchFilters, limit: number, offset: number): Promise<Profile[]>;
  countForSearch(filters: SearchFilters): Promise<number>;
  /** Perfiles de un rubro, resuelto a través de sus especialidades. */
  listByServiceSector(serviceSectorId: string): Promise<Profile[]>;
  listBySpecialty(specialtyId: string): Promise<Profile[]>;
  listFeatured(): Promise<Profile[]>;
  listPublishedSlugs(): Promise<string[]>;
  create(
    userId: string,
    draft: ProfileDraft,
    planId?: PlanId,
    limits?: DraftLimits,
  ): Promise<Profile>;
  update(
    profileId: string,
    draft: ProfileDraft,
    limits?: DraftLimits,
  ): Promise<Profile>;
  /** Activa un plan de inmediato y corre el vencimiento (subir de plan). */
  setPlan(
    profileId: string,
    planId: PlanId,
    expiresAt?: string | null,
    subscriptionStatus?: "active" | "past_due",
  ): Promise<void>;
  /** Marca el plan como pago: cierra el paso pendiente del asistente. */
  markPlanPaid(profileId: string): Promise<void>;
  /** Agenda una baja para el fin del período pago (no toca el plan vigente). */
  scheduleDowngrade(input: {
    profileId: string;
    downgradePlanId: PlanId;
    expiresAt: string | null;
    purgeAfter: string;
  }): Promise<void>;
  /** Deja sin efecto una baja agendada. */
  cancelDowngrade(profileId: string): Promise<void>;
  /** Consolida una baja ya vencida en la fila. */
  applyDueDowngrade(profileId: string, planId: PlanId): Promise<void>;
  /**
   * Marca como cerrado uno de los dos avisos de la baja: el normal o el
   * recordatorio de los últimos días. Cada uno se cierra por su cuenta.
   */
  dismissDowngradeNotice(
    profileId: string,
    stage: DowngradeNoticeStage,
  ): Promise<void>;
  setStatus(profileId: string, status: ProfileStatus): Promise<void>;
}

export interface ReviewRepository {
  /** `viewerConsumerId` marca la opinión propia de quien mira. */
  listForProfile(
    profileId: string,
    viewerConsumerId?: string | null,
  ): Promise<Review[]>;
  findByConsumer(profileId: string, consumerId: string): Promise<Review | null>;
  create(input: {
    profileId: string;
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

/**
 * Alta de cuenta. No lleva nombre: el nombre es del perfil, no de la cuenta, y
 * el registro sólo pide correo y contraseña (`docs/ui/register_form.md`).
 */
export type NewUser = {
  email: string;
  passwordHash: string;
  role?: UserRole;
};

export interface UserRepository {
  findByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
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
