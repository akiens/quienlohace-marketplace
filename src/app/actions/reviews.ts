"use server";

import { revalidatePath } from "next/cache";

import { D1ReviewRepository } from "@/infrastructure/d1-repositories";
import {
  destroyConsumerSession,
  getCurrentConsumer,
} from "@/lib/consumer-session";
import { fieldErrors, reviewReportSchema, reviewSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

/**
 * Server Actions de opiniones.
 *
 * Leerlas es público; escribirlas exige identidad (RF-148). La sesión se
 * resuelve siempre en el servidor: el formulario no decide quién es el autor.
 */

const reviews = new D1ReviewRepository();

/**
 * El slug viaja en el formulario junto al id. Es sólo para revalidar la
 * página; la autorización nunca depende de él, así que un valor manipulado
 * no da acceso a nada, apenas refresca una ruta equivocada.
 */
function revalidateProvider(slug: string): void {
  if (slug) revalidatePath(`/profesionales/${slug}`);
}

/**
 * Publica o actualiza la opinión propia.
 *
 * RF-150/177: una persona mantiene una sola opinión por proveedor. Si ya
 * existe se edita, en vez de rechazar el envío con un error que no aporta.
 */
export async function submitReview(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const consumer = await getCurrentConsumer();
  if (!consumer) {
    return { errors: { form: "Iniciá sesión con Google para opinar." } };
  }

  const providerId = String(formData.get("providerId") ?? "");
  if (!providerId) {
    return { errors: { form: "No pudimos identificar el perfil." } };
  }

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    comment: formData.get("comment"),
    // El nombre sale de la sesión de Google, no del formulario: nadie puede
    // publicar bajo otra identidad.
    authorName: consumer.displayName || "Usuario de Google",
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const existing = await reviews.findByConsumer(providerId, consumer.id);

  if (existing) {
    await reviews.updateOwn({
      reviewId: existing.id,
      consumerId: consumer.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
  } else {
    await reviews.create({
      providerId,
      authorId: null,
      consumerId: consumer.id,
      authorName: parsed.data.authorName,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
  }

  revalidateProvider(String(formData.get("slug") ?? ""));

  return {
    message: existing ? "Actualizamos tu opinión." : "Publicamos tu opinión.",
  };
}

/** Borra la opinión propia (RF-151). */
export async function deleteReview(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const consumer = await getCurrentConsumer();
  if (!consumer) {
    return { errors: { form: "Iniciá sesión para borrar tu opinión." } };
  }

  const reviewId = String(formData.get("reviewId") ?? "");
  const deleted = await reviews.deleteOwn(reviewId, consumer.id);
  if (!deleted) {
    return { errors: { form: "No encontramos esa opinión." } };
  }

  revalidateProvider(String(formData.get("slug") ?? ""));

  return { message: "Borramos tu opinión." };
}

/** Reporta una opinión: abre revisión, no borra (RF-154). */
export async function reportReview(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const consumer = await getCurrentConsumer();

  const parsed = reviewReportSchema.safeParse({
    reviewId: formData.get("reviewId"),
    reason: formData.get("reason"),
    detail: formData.get("detail") ?? "",
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  await reviews.report({
    reviewId: parsed.data.reviewId,
    consumerId: consumer?.id ?? null,
    userId: null,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });

  return { message: "Gracias. Vamos a revisar esta opinión." };
}

/** Cierra la sesión de cliente sin tocar la de proveedor. */
export async function consumerLogout(): Promise<void> {
  await destroyConsumerSession();
}
