"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCategoryOfSubcategory } from "@/data/categories";
import { toE164, toWhatsapp } from "@/domain/phone";
import { effectivePlanId } from "@/domain/plan-changes";
import { PLAN_IDS, limitFor, limitMessage } from "@/domain/plans";
import {
  applyGalleryLimit,
  claimImagesForProvider,
} from "@/infrastructure/d1-provider-images";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { requireUser } from "@/lib/session";
import { fieldErrors, providerProfileSchema } from "@/lib/validation";
import type { DraftLimits } from "@/domain/ports";
import type { PlanId, PlanLimits, ProviderStatus } from "@/types";
import type { FormState } from "@/app/actions/auth";

/**
 * Server Actions del panel del proveedor.
 *
 * Toda acción verifica en el servidor que el perfil pertenezca a quien la
 * ejecuta. Que el botón no se muestre en la UI no es una autorización.
 */

const providers = new D1ProviderRepository();
const plans = new D1PlanRepository();

/**
 * Comprueba los topes del plan sobre lo que llega del formulario.
 *
 * Devuelve los errores por campo, o null si todo entra. RF-053 aclara que
 * bajar de plan no borra datos: acá sólo se frenan altas nuevas por encima
 * del límite, nunca se recorta lo ya guardado.
 */
/**
 * Cuántos elementos de cada lista entran en el plan.
 *
 * Ya no se rechaza lo que sobra: se guarda inactivo (RF-053). Quien baja de
 * plan no pierde lo que había cargado, y si vuelve a subir reaparece sin
 * tener que escribirlo otra vez.
 */
function planLimits(plan: PlanLimits): DraftLimits {
  return {
    services: limitFor(plan, "services"),
    serviceAreas: limitFor(plan, "serviceAreas"),
    subcategories: limitFor(plan, "subcategories"),
    teamMembers: limitFor(plan, "teamMembers"),
    galleryImages: limitFor(plan, "galleryImages"),
    social: plan.allowsSocialLinks,
  };
}

/**
 * Aviso, no error: dice qué quedó fuera del plan para que se sepa que no se
 * está publicando, sin impedir guardarlo.
 */
function overLimitNotice(
  plan: PlanLimits,
  draft: { services: string[]; serviceAreaIds: string[]; subcategoryIds: string[] },
): string | null {
  const parts: string[] = [];
  if (draft.services.length > limitFor(plan, "services")) {
    parts.push(limitMessage(plan, "services", "servicios"));
  }
  if (draft.serviceAreaIds.length > limitFor(plan, "serviceAreas")) {
    parts.push(limitMessage(plan, "serviceAreas", "zonas"));
  }
  if (draft.subcategoryIds.length > limitFor(plan, "subcategories")) {
    parts.push(limitMessage(plan, "subcategories", "subcategorías"));
  }
  if (parts.length === 0) return null;
  return `${parts.join(" ")} Lo guardamos igual: se publica si volvés a ese plan.`;
}

/**
 * Redes sociales: llegan como `social_<plataforma>` con la dirección. Las
 * vacías se descartan, que es como se borra una red.
 */
function parseSocialLinks(formData: FormData) {
  const links: Array<{ platform: string; url: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("social_")) continue;
    const url = String(value).trim();
    if (url.length > 0) links.push({ platform: key.slice(7), url });
  }
  return links;
}

/**
 * Equipo: los campos llegan como listas paralelas (`teamName`, `teamRole`…).
 * Se descartan las filas sin nombre, que son las que quedaron vacías.
 */
function parseTeamMembers(formData: FormData) {
  const names = formData.getAll("teamName").map(String);
  const roles = formData.getAll("teamRole").map(String);
  const subtitles = formData.getAll("teamSubtitle").map(String);
  const bios = formData.getAll("teamBio").map(String);

  return names
    .map((name, index) => ({
      name: name.trim(),
      role: (roles[index] ?? "").trim(),
      subtitle: (subtitles[index] ?? "").trim(),
      bio: (bios[index] ?? "").trim(),
    }))
    .filter((member) => member.name.length > 0);
}

/** Lee el formulario y lo valida. Los checkbox/multi-valor llegan como listas. */
function parseProfile(formData: FormData) {
  return providerProfileSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    subcategoryId: formData.get("subcategoryId"),
    locationId: formData.get("locationId"),
    phone: formData.get("phone") ?? "",
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    schedule: formData.get("schedule") ?? "",
    services: formData
      .getAll("services")
      .map((value) => String(value).trim())
      .filter(Boolean),
    serviceAreaIds: formData.getAll("serviceAreaIds").map(String),
    subcategoryIds: formData.getAll("subcategoryIds").map(String),
    serviceMode: formData.get("serviceMode") ?? "on_site",
    paymentMethods: formData.getAll("paymentMethods").map(String),
    socialLinks: parseSocialLinks(formData),
    teamMembers: parseTeamMembers(formData),
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

  /*
   * `whatsapp` y `phoneE164` no se piden: se derivan del único teléfono que
   * se escribió (RF-013/169). Si la casilla de WhatsApp está desmarcada, el
   * número de wa.me queda vacío y el perfil no ofrece ese canal.
   */
  const draft = {
    ...parsed.data,
    categoryId: category.id,
    whatsapp: parsed.data.whatsappEnabled ? toWhatsapp(parsed.data.phone) : "",
    phoneE164: toE164(parsed.data.phone),
  };

  const existing = await providers.findByUserId(user.id);

  /*
   * Plan con el que se guarda. En un perfil que ya existe manda el suyo: el
   * cambio de plan es otra acción. En uno nuevo vale el que se eligió en el
   * registro, que llega en el formulario.
   *
   * En el que existe se toma el plan que rige hoy y no la columna: con una
   * baja agendada y el período todavía corriendo sigue valiendo el plan pago,
   * y aplicar ya los topes del plan nuevo desactivaría datos que se están
   * pagando.
   */
  const requestedPlan = formData.get("planId");
  const planId: PlanId = existing
    ? effectivePlanId({
        planId: existing.planId ?? "cobre",
        downgradePlanId: existing.downgradePlanId,
        planExpiresAt: existing.planExpiresAt,
      })
    : PLAN_IDS.includes(requestedPlan as PlanId)
      ? (requestedPlan as PlanId)
      : "cobre";

  /*
   * Los topes se aplican en el servidor: que la UI esconda un paso no es una
   * restricción, sólo una ayuda (RF-163). Lo que excede no se rechaza — se
   * guarda inactivo y se avisa (RF-053).
   */
  const plan =
    (await plans.findById(planId)) ?? (await plans.findById("cobre"));

  /*
   * En un plan pago no se crea el perfil sin resolver el pago.
   *
   * Se comprueba también acá y no sólo en el formulario: que el botón esté
   * deshabilitado no impide mandar el envío a mano (RF-163). Sólo aplica al
   * alta — un perfil que ya existe se sigue editando sin volver a pasar por
   * esto.
   *
   * Hoy alcanza con la casilla del asistente, que es un marcador provisional.
   * Cuando exista el cobro, lo que se mire acá será la suscripción.
   */
  const paymentTicked = formData.get("paymentAcknowledged") === "on";

  if (!existing && plan && plan.priceCents > 0 && !paymentTicked) {
    return {
      errors: {
        form: `Para crear tu perfil con el plan ${plan.name} tenés que completar el paso de pago.`,
      },
    };
  }

  /*
   * Subida a medio resolver: el plan ya está activo pero el cobro quedaba
   * pendiente (`past_due`), que es lo que mantiene abierto el asistente.
   * Marcarlo pago lo cierra y devuelve al perfil.
   */
  const settlingUpgrade =
    existing?.subscriptionStatus === "past_due" &&
    plan !== null &&
    plan.priceCents > 0 &&
    paymentTicked;

  const limits = plan ? planLimits(plan) : undefined;
  const notice = plan ? overLimitNotice(plan, draft) : null;

  // Al crear, se manda al perfil; al editar, se responde en la misma página.
  let isNew = false;

  if (existing) {
    await providers.update(existing.id, draft, limits);
    if (settlingUpgrade) await providers.markPlanPaid(existing.id);
    revalidatePath(`/profesionales/${existing.slug}`);
  } else {
    const created = await providers.create(user.id, draft, planId, limits);
    /*
     * Las imágenes que se subieron durante el alta todavía no tenían perfil
     * al que colgarse: recién ahora existe el id. Sin esto la foto y la
     * portada quedarían guardadas pero sin aparecer en el perfil.
     */
    await claimImagesForProvider(user.id, created.id);
    isNew = true;
  }

  /*
   * La galería se recorta al plan igual que el resto de las listas: lo que
   * excede queda inactivo, no borrado (RF-053). Se hace acá y no al subir
   * porque el plan puede cambiar después, y el guardado es el momento donde
   * se recalcula todo contra el plan vigente.
   */
  if (plan) await applyGalleryLimit(user.id, limitFor(plan, "galleryImages"));

  revalidatePath("/dashboard");
  revalidatePath(`/categorias/${category.slug}`);

  /*
   * Recién creado, el asistente ya cumplió y se sigue en el perfil: es donde
   * se publica y se edita. Se redirige desde el servidor y no desde el
   * formulario para que el paso ocurra una sola vez, en la misma respuesta
   * que creó la fila.
   *
   * `redirect` corta por excepción, así que nada de lo que sigue se ejecuta:
   * va al final, después de revalidar.
   */
  // Recién creado, o recién resuelto el pago de una subida: en los dos casos
  // el asistente cumplió y se sigue en el perfil.
  if (isNew || settlingUpgrade) redirect("/dashboard");

  return { message: notice ? `Perfil guardado. ${notice}` : "Perfil guardado." };
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
