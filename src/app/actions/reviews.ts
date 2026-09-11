"use server";

import { revalidatePath } from "next/cache";

import { D1ReviewRepository } from "@/infrastructure/d1-repositories";
import {
  destroyConsumerSession,
  getCurrentConsumer,
} from "@/lib/consumer-session";
import { destroySession } from "@/lib/session";
import { fieldErrors, reviewReportSchema, reviewSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

/**
 * Server Actions de opiniones.
 *
 * Leerlas es público; escribirlas exige identidad (RF-148). La sesión se
 * resuelve siempre en el servidor: el formulario no decide quién es el autor.
 */

const reviews = new D1ReviewRepository();

/*
 * Mensajes para cuando falla la infraestructura y no los datos (TR-041). El
 * error real se registra y nunca sale al navegador.
 */
const REVIEW_FAILED =
  "No pudimos guardar tu opinión, por favor intentá de nuevo en unos minutos.";
const DELETE_FAILED =
  "No pudimos borrar tu opinión, por favor intentá de nuevo en unos minutos.";
const REPORT_FAILED =
  "No pudimos registrar el reporte, por favor intentá de nuevo en unos minutos.";

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

  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) {
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

  let existing;
  try {
    existing = await reviews.findByConsumer(profileId, consumer.id);

    if (existing) {
      await reviews.updateOwn({
        reviewId: existing.id,
        consumerId: consumer.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      });
    } else {
      await reviews.create({
        profileId,
        authorId: null,
        consumerId: consumer.id,
        authorName: parsed.data.authorName,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      });
    }
  } catch (error) {
    console.error("submitReview failed", error);
    return { errors: { form: REVIEW_FAILED } };
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

  let deleted: boolean;
  try {
    deleted = await reviews.deleteOwn(reviewId, consumer.id);
  } catch (error) {
    console.error("deleteReview failed", error);
    return { errors: { form: DELETE_FAILED } };
  }

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

  try {
    await reviews.report({
      reviewId: parsed.data.reviewId,
      consumerId: consumer?.id ?? null,
      userId: null,
      reason: parsed.data.reason,
      detail: parsed.data.detail,
    });
  } catch (error) {
    console.error("reportReview failed", error);
    return { errors: { form: REPORT_FAILED } };
  }

  return { message: "Gracias. Vamos a revisar esta opinión." };
}

/** Cierra ambas facetas cuando pertenecen a la misma experiencia de cuenta. */
export async function consumerLogout(): Promise<void> {
  await destroyConsumerSession();
  await destroySession();
}
