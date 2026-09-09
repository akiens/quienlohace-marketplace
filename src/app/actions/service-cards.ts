"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/actions/auth";
import { effectivePlanId } from "@/domain/plan-changes";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import {
  commitServiceCardImages,
  discardAllServiceCardImages,
  validateServiceCardImageSelection,
} from "@/infrastructure/d1-service-card-images";
import { requireUser } from "@/lib/session";
import { fieldErrors, serviceCardSchema } from "@/lib/validation";
import { serviceCardHref } from "@/lib/service-cards";

const cards = new D1ServiceCardRepository();

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

export async function saveServiceCard(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const profile = await new D1ProfileRepository().findByUserId(user.id);
  if (!profile) return { errors: { form: "Primero creá tu perfil." } };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const imageIds = formData.getAll("serviceImageId").map(String).filter(Boolean);
  const parsed = serviceCardSchema.safeParse({
    specialtyId: formData.get("specialtyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priceKind: formData.get("priceKind"),
    priceMin: nullableNumber(formData.get("priceMin")),
    priceMax: nullableNumber(formData.get("priceMax")),
    tier: formData.get("tier"),
    durationMinMinutes: nullableNumber(formData.get("durationMinMinutes")),
    durationMaxMinutes: nullableNumber(formData.get("durationMaxMinutes")),
    serviceMode: formData.get("serviceMode"),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim() || null,
    schedule: formData.get("schedule") ?? "",
    imageId: String(formData.get("imageId") ?? "").trim() || null,
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!profile.specialtyIds.includes(parsed.data.specialtyId)) {
    return { errors: { specialtyId: "Elegí una especialidad activa de tu perfil." } };
  }
  if (parsed.data.imageId && !profile.images.some((image) => image.id === parsed.data.imageId)) {
    return { errors: { imageId: "Esa imagen no pertenece a tu perfil." } };
  }
  const owned = id ? await cards.findOwned(id, user.id) : null;
  if (id && !owned) {
    return { errors: { form: "No encontramos esa carta de servicio." } };
  }
  if (!(await validateServiceCardImageSelection(imageIds, user.id, profile.id, id))) {
    return { errors: { serviceImages: "La selección de imágenes no es válida o supera el máximo de cuatro." } };
  }

  const planId = effectivePlanId({
    planId: profile.planId,
    downgradePlanId: profile.downgradePlanId,
    planExpiresAt: profile.planExpiresAt,
  });
  const plan = await new D1PlanRepository().findById(planId);
  if (!plan) return { errors: { form: "No pudimos comprobar el límite de tu plan." } };
  const activeSpecialtyIds = profile.specialtyIds.slice(0, plan.maxSpecialties ?? undefined);
  if (!activeSpecialtyIds.includes(parsed.data.specialtyId)) {
    return { errors: { specialtyId: "Esa especialidad está fuera del cupo de tu plan." } };
  }

  const existingCards = await cards.listForProfile(profile.id, true);
  if (!id && existingCards.filter((card) => card.isActive && activeSpecialtyIds.includes(card.specialtyId)).length >= plan.maxServiceCards) {
    return { errors: { form: `Tu plan permite hasta ${plan.maxServiceCards} cartas de servicio.` } };
  }

  try {
    const savedId = await cards.save(profile.id, {
      specialtyId: parsed.data.specialtyId,
      title: parsed.data.title,
      description: parsed.data.description,
      priceKind: parsed.data.priceKind,
      priceMinCents: parsed.data.priceMin === null ? null : Math.round(parsed.data.priceMin * 100),
      priceMaxCents: parsed.data.priceMax === null ? null : Math.round(parsed.data.priceMax * 100),
      tier: parsed.data.tier,
      durationMinMinutes: parsed.data.durationMinMinutes,
      durationMaxMinutes: parsed.data.durationMaxMinutes,
      serviceMode: parsed.data.serviceMode,
      paymentMethod: parsed.data.paymentMethod,
      schedule: parsed.data.schedule,
      // `image_id` queda como compatibilidad con cartas creadas antes de la
      // galería propia. Las nuevas imágenes viven en service_card_images.
      imageId: owned?.imageId ?? null,
      isPublished: parsed.data.isPublished,
    }, id);
    await commitServiceCardImages({
      ids: imageIds,
      cardId: savedId,
      userId: user.id,
      profileId: profile.id,
      title: parsed.data.title,
    });
    await cards.applyLimit(profile.id, plan.maxServiceCards);
    const saved = await cards.findOwned(savedId, user.id);
    if (saved) revalidatePath(serviceCardHref(saved));
  } catch (error) {
    console.error("saveServiceCard failed", error);
    return { errors: { form: "No pudimos guardar la carta. Intentá nuevamente." } };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/profesionales/${profile.slug}`);
  revalidatePath("/buscar");
  return { message: id ? "Carta actualizada." : "Carta creada." };
}

export async function deleteServiceCard(formData: FormData): Promise<void> {
  const user = await requireUser();
  const profile = await new D1ProfileRepository().findByUserId(user.id);
  const id = String(formData.get("id") ?? "");
  const owned = profile ? await cards.findOwned(id, user.id) : null;
  if (!profile || !owned) return;
  await discardAllServiceCardImages(id, user.id);
  await cards.delete(id, profile.id);
  const planId = effectivePlanId({
    planId: profile.planId,
    downgradePlanId: profile.downgradePlanId,
    planExpiresAt: profile.planExpiresAt,
  });
  const plan = await new D1PlanRepository().findById(planId);
  if (plan) await cards.applyLimit(profile.id, plan.maxServiceCards);
  revalidatePath("/dashboard");
  revalidatePath(serviceCardHref(owned));
  revalidatePath(`/profesionales/${profile.slug}`);
  revalidatePath("/buscar");
}
