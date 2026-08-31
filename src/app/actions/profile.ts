"use server";

import { revalidatePath } from "next/cache";

import { getCategoryOfSubcategory } from "@/data/categories";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { requireUser } from "@/lib/session";
import { fieldErrors, providerProfileSchema } from "@/lib/validation";
import type { ProviderStatus } from "@/types";
import type { FormState } from "@/app/actions/auth";

/**
 * Server Actions del panel del proveedor.
 *
 * Toda acción verifica en el servidor que el perfil pertenezca a quien la
 * ejecuta. Que el botón no se muestre en la UI no es una autorización.
 */

const providers = new D1ProviderRepository();

/** Lee el formulario y lo valida. Los checkbox/multi-valor llegan como listas. */
function parseProfile(formData: FormData) {
  return providerProfileSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    subcategoryId: formData.get("subcategoryId"),
    locationId: formData.get("locationId"),
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    schedule: formData.get("schedule") ?? "",
    services: formData
      .getAll("services")
      .map((value) => String(value).trim())
      .filter(Boolean),
    serviceAreaIds: formData.getAll("serviceAreaIds").map(String),
    paymentMethods: formData.getAll("paymentMethods").map(String),
  });
}

export async function saveProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = parseProfile(formData);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  // La categoría se deriva de la subcategoría: no se acepta del formulario,
  // así no pueden llegar combinaciones incoherentes.
  const category = getCategoryOfSubcategory(parsed.data.subcategoryId);
  if (!category) {
    return { errors: { subcategoryId: "Elegí una subcategoría válida." } };
  }

  const draft = {
    ...parsed.data,
    categoryId: category.id,
  };

  const existing = await providers.findByUserId(user.id);

  if (existing) {
    await providers.update(existing.id, draft);
    revalidatePath(`/profesionales/${existing.slug}`);
  } else {
    await providers.create(user.id, draft);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/categorias/${category.slug}`);

  return { message: "Perfil guardado." };
}

/** Publica o despublica el perfil propio. */
export async function setProfileStatus(status: ProviderStatus): Promise<FormState> {
  const user = await requireUser();

  const provider = await providers.findByUserId(user.id);
  if (!provider) {
    return { errors: { form: "Todavía no creaste tu perfil." } };
  }

  // Desde el panel sólo se permite publicar o despublicar. Los estados de
  // moderación (suspended, pending_verification) los fija la administración.
  if (status !== "active" && status !== "inactive") {
    return { errors: { form: "Estado no permitido." } };
  }

  await providers.setStatus(provider.id, status);

  revalidatePath("/dashboard");
  revalidatePath(`/profesionales/${provider.slug}`);

  return {
    message: status === "active" ? "Tu perfil ya es público." : "Tu perfil dejó de ser visible.",
  };
}
