import "server-only";

import type {
  NewUser,
  ReviewRepository,
  SessionRepository,
  UserRepository,
} from "@/domain/ports";
import type { Review, User, UserRole } from "@/types";
import { getDb } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";

/** Adapters D1 para usuarios, sesiones y opiniones. */

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified: number;
  created_at: string;
  password_hash: string | null;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at,
  };
}

export class D1UserRepository implements UserRepository {
  async findByEmail(
    email: string,
  ): Promise<(User & { passwordHash: string | null }) | null> {
    const row = await getDb()
      .prepare(
        `SELECT id, email, name, role, email_verified, created_at, password_hash
         FROM users WHERE email = ?`,
      )
      .bind(email.trim().toLowerCase())
      .first<UserRow>();

    if (!row) return null;
    return { ...toUser(row), passwordHash: row.password_hash };
  }

  async findById(id: string): Promise<User | null> {
    const row = await getDb()
      .prepare(
        `SELECT id, email, name, role, email_verified, created_at, password_hash
         FROM users WHERE id = ?`,
      )
      .bind(id)
      .first<UserRow>();

    return row ? toUser(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    const id = newId();
    const now = new Date().toISOString();
    const email = input.email.trim().toLowerCase();

    await getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, email, input.passwordHash, input.name, input.role ?? "provider", now, now)
      .run();

    return {
      id,
      email,
      name: input.name,
      role: input.role ?? "provider",
      emailVerified: false,
      createdAt: now,
    };
  }
}

export class D1SessionRepository implements SessionRepository {
  async create(input: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await getDb()
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.userId,
        input.expiresAt.toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  async findValid(id: string, now: Date): Promise<{ userId: string } | null> {
    const row = await getDb()
      .prepare(`SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?`)
      .bind(id, now.toISOString())
      .first<{ user_id: string }>();

    return row ? { userId: row.user_id } : null;
  }

  async delete(id: string): Promise<void> {
    await getDb().prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
  }

  async deleteExpired(now: Date): Promise<void> {
    await getDb()
      .prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
      .bind(now.toISOString())
      .run();
  }
}

export class D1ReviewRepository implements ReviewRepository {
  async listForProvider(providerId: string): Promise<Review[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT id, provider_id, author_name, rating, comment, created_at
         FROM reviews
         WHERE provider_id = ? AND status = 'published'
         ORDER BY created_at DESC`,
      )
      .bind(providerId)
      .all<{
        id: string;
        provider_id: string;
        author_name: string;
        rating: number;
        comment: string;
        created_at: string;
      }>();

    return results.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      authorName: row.author_name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
    }));
  }

  async create(input: {
    providerId: string;
    authorId: string | null;
    authorName: string;
    rating: number;
    comment: string;
  }): Promise<Review> {
    const db = getDb();
    const id = newId();
    const createdAt = new Date().toISOString();

    // La opinión y el contador del proveedor se escriben juntos: si una
    // sentencia falla, no queda una calificación desincronizada.
    await db.batch([
      db
        .prepare(
          `INSERT INTO reviews (id, provider_id, author_id, author_name, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.providerId,
          input.authorId,
          input.authorName,
          input.rating,
          input.comment,
          createdAt,
        ),
      db
        .prepare(
          `UPDATE providers
           SET rating_sum = rating_sum + ?, review_count = review_count + 1
           WHERE id = ?`,
        )
        .bind(input.rating, input.providerId),
    ]);

    return {
      id,
      providerId: input.providerId,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      createdAt,
    };
  }
}
