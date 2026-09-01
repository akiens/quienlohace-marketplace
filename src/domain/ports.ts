import type {
  PaymentMethod,
  Provider,
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
  schedule: string;
  services: string[];
  serviceAreaIds: string[];
  paymentMethods: PaymentMethod[];
};

export interface ProviderRepository {
  findBySlug(slug: string): Promise<Provider | null>;
  findByUserId(userId: string): Promise<Provider | null>;
  search(filters: SearchFilters, limit: number, offset: number): Promise<Provider[]>;
  countForSearch(filters: SearchFilters): Promise<number>;
  listByCategory(categoryId: string): Promise<Provider[]>;
  listBySubcategory(subcategoryId: string): Promise<Provider[]>;
  listFeatured(): Promise<Provider[]>;
  listPublishedSlugs(): Promise<string[]>;
  create(userId: string, draft: ProviderDraft): Promise<Provider>;
  update(providerId: string, draft: ProviderDraft): Promise<Provider>;
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
