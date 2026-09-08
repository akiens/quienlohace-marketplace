"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeServiceAreas } from "@/data/locations";
import { sectorOfSpecialty } from "@/data/taxonomy";
import { toE164 } from "@/domain/phone";
import { effectivePlanId } from "@/domain/plan-changes";
import { publishBlockers } from "@/domain/publishing";
import { fitToPlan } from "@/domain/plan-fit";
import { PLAN_IDS, limitFor, limitMessage } from "@/domain/plans";
import {
  applyGalleryLimit,
  claimImagesForProfile,
} from "@/infrastructure/d1-profile-images";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { requireUser } from "@/lib/session";
import { fieldErrors, profileSchema } from "@/lib/validation";
import type { DraftLimits, ProfileDraft } from "@/domain/ports";
import type { PlanId, PlanLimits, Profile, ProfileStatus } from "@/types";
import type { FormState } from "@/app/actions/auth";

/**
 * Server Actions del panel del proveedor.
 *
 * Toda acción verifica en el servidor que el perfil pertenezca a quien la
 * ejecuta. Que el botón no se muestre en la UI no es una autorización (TR-004).
 */

const profiles = new D1ProfileRepository();
const plans = new D1PlanRepository();

/**
 * Cuántos elementos de cada lista entran en el plan.
 *
 * Lo que sobra no se rechaza: se guarda inactivo (BR-009). Quien baja de plan
 * no pierde lo que había cargado, y si vuelve a subir reaparece sin tener que
 * escribirlo otra vez.
 */
function planLimits(plan: PlanLimits): DraftLimits {
  return {
    specialties: limitFor(plan, "specialties"),
    services: limitFor(plan, "services"),
    locations: limitFor(plan, "locations"),
    galleryImages: limitFor(plan, "galleryImages"),
    social: plan.allowsSocialLinks,
  };
}

/** true si `count` supera el tope. `null` es sin límite: nunca lo supera. */
function exceeds(count: number, limit: number | null): boolean {
  return limit !== null && count > limit;
}

/**
 * Aviso, no error: dice qué quedó fuera del plan para que se sepa que no se
 * está publicando, sin impedir guardarlo (BR-009).
 */
function overLimitNotice(plan: PlanLimits, draft: ProfileDraft): string | null {
  const parts: string[] = [];

  if (exceeds(draft.specialtyIds.length, limitFor(plan, "specialties"))) {
    parts.push(limitMessage(plan, "specialties", "especialidades"));
  }
  if (exceeds(draft.services.length, limitFor(plan, "services"))) {
    parts.push(limitMessage(plan, "services", "servicios"));
  }
  if (exceeds(draft.locations.length, limitFor(plan, "locations"))) {
    parts.push(limitMessage(plan, "locations", "ubicaciones"));
  }

  // Los rubros no se eligen: se derivan de las especialidades (BR-010).
  const sectors = new Set(
    draft.specialtyIds
      .map((id) => sectorOfSpecialty(id)?.id)
      .filter((id): id is string => id !== undefined),
  );
  if (exceeds(sectors.size, limitFor(plan, "serviceSectors"))) {
    parts.push(limitMessage(plan, "serviceSectors", "rubros"));
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
 * Servicios: llegan como listas paralelas `serviceName` / `serviceSpecialty`,
 * porque cada uno tiene que decir a qué especialidad pertenece (BR-010).
 */
function parseServices(formData: FormData) {
  const names = formData.getAll("serviceName").map(String);
  const specialties = formData.getAll("serviceSpecialty").map(String);

  return names
    .map((name, index) => ({
      name: name.trim(),
      specialtyId: (specialties[index] ?? "").trim(),
    }))
    .filter((service) => service.name.length > 0);
}

/**
 * Ubicaciones físicas: listas paralelas, una fila por sucursal. La principal
 * llega como el índice marcado en un grupo de radios (BR-015).
 */
function parseLocations(formData: FormData) {
  const ids = formData.getAll("locationId").map(String);
  const names = formData.getAll("locationName").map(String);
  const addresses = formData.getAll("locationAddress").map(String);
  const primary = String(formData.get("primaryLocation") ?? "0");

  return ids
    .map((locationId, index) => ({
      locationId: locationId.trim(),
      name: (names[index] ?? "").trim() || null,
      // Sin `|| null`: la dirección es obligatoria y el vacío lo rechaza el
      // esquema con su mensaje, no se convierte en "no puso ninguna".
      address: (addresses[index] ?? "").trim(),
      isPrimary: String(index) === primary,
    }))
    .filter((location) => location.locationId.length > 0);
}

/** Lee el formulario y lo valida. Los checkbox/multi-valor llegan como listas. */
function parseProfile(formData: FormData) {
  return profileSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    description: formData.get("description"),
    icon: formData.get("icon") ?? "work",
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    phonePublic: formData.get("phonePublic") !== "off",
    specialtyIds: formData.getAll("specialtyIds").map(String),
    services: parseServices(formData),
    serviceModes: formData.getAll("serviceModes").map(String),
    /*
     * TR-018: las áreas se normalizan antes de validar. Elegir Uruguay
     * reemplaza todo lo demás y un departamento absorbe sus localidades, así
     * que lo que se guarda nunca tiene dos filas diciendo lo mismo.
     */
    serviceAreaIds: normalizeServiceAreas(
      formData.getAll("serviceAreaIds").map(String),
    ),
    locations: parseLocations(formData),
    paymentMethods: formData.getAll("paymentMethods").map(String),
    scheduleEntries: formData
      .getAll("scheduleEntries")
      .map((value) => String(value).trim())
      .filter(Boolean),
    socialLinks: parseSocialLinks(formData),
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

  /*
   * `phoneE164` no se pide: se deriva del único teléfono que se escribió
   * (BR-004). De ahí salen tanto `tel:` como `wa.me`, así que no hay dos
   * números que puedan discrepar.
   */
  const draft: ProfileDraft = {
    ...parsed.data,
    phoneE164: toE164(parsed.data.phone),
  };

  const existing = await profiles.findByUserId(user.id);

  /*
   * Plan con el que se guarda. En un perfil que ya existe manda el suyo: el
   * cambio de plan es otra acción. En uno nuevo vale el que se eligió en el
   * registro, que llega en el formulario.
   *
   * En el que existe se toma el plan que rige hoy y no la columna: con una
   * baja agendada y el período todavía corriendo sigue valiendo el plan pago
   * (BR-008), y aplicar ya los topes del plan nuevo desactivaría datos que se
   * están pagando.
   */
  const requestedPlan = formData.get("planId");
  const planId: PlanId = existing
    ? effectivePlanId({
        planId: existing.planId,
        downgradePlanId: existing.downgradePlanId,
        planExpiresAt: existing.planExpiresAt,
      })
    : PLAN_IDS.includes(requestedPlan as PlanId)
      ? (requestedPlan as PlanId)
      : "cobre";

  /*
   * Los topes se aplican en el servidor: que la UI esconda un paso no es una
   * restricción, sólo una ayuda (TR-004). Lo que excede no se rechaza — se
   * guarda inactivo y se avisa (BR-009).
   */
  const plan = (await plans.findById(planId)) ?? (await plans.findById("cobre"));

  /*
   * En un plan pago no se crea el perfil sin resolver el pago.
   *
   * Se comprueba también acá y no sólo en el formulario: que el botón esté
   * deshabilitado no impide mandar el envío a mano (TR-004). Sólo aplica al
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

  /*
   * En el alta lo que no entra en el plan no se guarda.
   *
   * Es lo mismo que hace el asistente al bajar de plan, y se repite acá
   * porque el envío se puede armar a mano: que la UI recorte no es una
   * restricción (TR-004). No es una excepción a BR-009 —que conserva lo que
   * excede al bajar de plan— sino su otra cara: BR-009 protege lo que ya se
   * había cargado con un plan que se pagó, y en un perfil que todavía no
   * existe no hay nada de eso. Guardar de más sólo dejaría al perfil nuevo
   * naciendo con filas inactivas que nadie pidió.
   *
   * Editando no se toca: ahí sí hay un perfil con historia y manda BR-009.
   */
  const fitted =
    !existing && plan ? { ...draft, ...fitToPlan(draft, plan).fitted } : draft;

  const notice = plan && existing ? overLimitNotice(plan, draft) : null;

  // Al crear, se manda al panel; al editar, se responde en la misma página.
  let isNew = false;
  let saved: Profile;

  if (existing) {
    saved = await profiles.update(existing.id, fitted, limits);
    if (settlingUpgrade) await profiles.markPlanPaid(existing.id);
    revalidatePath(`/profesionales/${existing.slug}`);
  } else {
    saved = await profiles.create(user.id, fitted, planId, limits);
    /*
     * Las imágenes que se subieron durante el alta todavía no tenían perfil al
     * que colgarse: recién ahora existe el id. Sin esto la foto y la portada
     * quedarían guardadas pero sin aparecer en el perfil (BR-021).
     */
    await claimImagesForProfile(user.id, saved.id);
    isNew = true;
  }

  /*
   * La galería se recorta al plan igual que el resto de las listas: lo que
   * excede queda inactivo, no borrado (BR-009). Se hace acá y no al subir
   * porque el plan puede cambiar después, y el guardado es el momento donde se
   * recalcula todo contra el plan vigente.
   */
  if (plan) await applyGalleryLimit(user.id, limitFor(plan, "galleryImages"));

  /*
   * Un perfil publicado que dejó de cumplir los requisitos no puede seguir
   * público (BR-030). Editarlo hasta romperlos —quitar la última especialidad,
   * dejar de tener local atendiendo en el negocio— lo despublica en vez de
   * dejar a la vista algo que ya no califica.
   */
  if (saved.profileStatus === "active" && publishBlockers(saved).length > 0) {
    await profiles.setStatus(saved.id, "inactive");
    revalidatePath("/dashboard");
    revalidatePath(`/profesionales/${saved.slug}`);
    return {
      tone: "warning",
      message:
        "Guardamos los cambios, pero tu perfil dejó de cumplir los requisitos para estar publicado y ya no es visible.",
    };
  }

  revalidatePath("/dashboard");

  /*
   * Recién creado, o recién resuelto el pago de una subida: en los dos casos
   * el asistente cumplió y se sigue en el panel, que es donde se publica.
   *
   * `redirect` corta por excepción, así que nada de lo que sigue se ejecuta:
   * va al final, después de revalidar.
   */
  if (isNew || settlingUpgrade) redirect("/dashboard");

  return { message: notice ? `Perfil guardado. ${notice}` : "Perfil guardado." };
}

/** Publica o despublica el perfil propio. */
export async function setProfileStatus(
  status: ProfileStatus,
): Promise<FormState> {
  const user = await requireUser();

  const profile = await profiles.findByUserId(user.id);
  if (!profile) {
    return { errors: { form: "Todavía no creaste tu perfil." } };
  }

  /*
   * Desde el panel sólo se permite publicar o despublicar. `suspended` es una
   * decisión de moderación y no puede tomarla el propio dueño (BR-029).
   */
  if (status !== "active" && status !== "inactive") {
    return { errors: { form: "Estado no permitido." } };
  }

  /*
   * BR-003: publicar exige cumplir todos los requisitos, y se comprueban acá
   * contra el perfil guardado. El botón deshabilitado en la UI es una ayuda,
   * no la regla.
   */
  if (status === "active") {
    const missing = publishBlockers(profile);
    if (missing.length > 0) {
      return { errors: { form: `Para publicar te falta: ${missing.join(" ")}` } };
    }
  }

  await profiles.setStatus(profile.id, status);

  revalidatePath("/dashboard");
  revalidatePath(`/profesionales/${profile.slug}`);

  return {
    message:
      status === "active"
        ? "Tu perfil ya es público."
        : "Tu perfil dejó de ser visible.",
  };
}
