import {
  ABSOLUTE_MAX_BYTES,
  isImageField,
  policyFor,
  type ImageField,
} from "@/domain/image-policy";
import { limitFor } from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import {
  discardPendingImage,
  listImagesForUser,
  putProfileImage,
} from "@/infrastructure/d1-profile-images";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { processImage } from "@/infrastructure/image-processing";
import { getCurrentUser } from "@/lib/session";
import type { PlanId } from "@/types";

/**
 * Subida y descarte de las imágenes de un formulario.
 *
 * Es una ruta y no una Server Action a propósito. Una acción invocada como
 * función normal —no con `action={}` ni `useActionState`— serializa sus
 * argumentos con devalue, que sólo admite objetos planos: un `File` o un
 * `FormData` la hacen fallar con «Cannot stringify arbitrary non-POJOs».
 * Además las acciones tienen su propio tope de cuerpo, pensado para
 * formularios y no para archivos.
 *
 * Una ruta recibe `multipart/form-data` como lo que es, sin serializar nada
 * en el medio, que es justo lo que hace falta para subir una foto de a una
 * mientras el formulario sigue abierto.
 *
 * Lo que se sube queda **pendiente** hasta que el formulario se guarde
 * (TR-043): existe, es de quien la subió y expira sola si nadie la confirma.
 */

/** Depende de la cookie de quien sube: nunca se cachea. */
export const dynamic = "force-dynamic";

const providers = new D1ProfileRepository();
const plans = new D1PlanRepository();

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Cuántas imágenes admite el campo para este usuario.
 *
 * El cupo del plan es **sólo de la galería** (BR-007): la foto de perfil y la
 * portada las incluyen todos los planes y no consumen ese cupo (BR-021). Por
 * eso el tope de esos campos sale de su política —una cada uno— y el plan ni
 * se consulta.
 *
 * Un campo que sí depende del plan lo declara con `maxCount: null` y su cupo
 * sale del plan vigente (BR-009). Se resuelve acá y no en la UI: que el paso
 * no se muestre no es una restricción (TR-004).
 */
async function maxForField(
  field: ImageField,
  planId: PlanId,
): Promise<{ max: number | null; planName: string | null; fromPlan: boolean }> {
  const policy = policyFor(field);
  if (policy.maxCount !== null) {
    return { max: policy.maxCount, planName: null, fromPlan: false };
  }

  const plan = (await plans.findById(planId)) ?? (await plans.findById("cobre"));
  /*
   * `null` es "sin límite" y `0` es "no incluida" (TR-002): sin distinguirlos,
   * Platino —que no tiene tope— caería en la misma rama que Cobre, que no
   * tiene galería.
   */
  return {
    max: plan ? limitFor(plan, "galleryImages") : 0,
    planName: plan?.name ?? null,
    fromPlan: true,
  };
}

/** Sube una imagen del formulario propio, en estado pendiente. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para subir imágenes.", 401);

  /*
   * El tope duro se comprueba antes de leer el cuerpo: si el archivo es
   * enorme, no tiene sentido traerlo entero a memoria para después
   * rechazarlo. La cabecera puede mentir, así que el tope real se vuelve a
   * comprobar sobre los bytes ya leídos, en `processImage`.
   */
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > ABSOLUTE_MAX_BYTES) {
    return fail("La imagen es demasiado pesada.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("No pudimos leer el archivo. Probá de nuevo.");
  }

  const field = String(formData.get("field") ?? "");
  if (!isImageField(field)) return fail("Tipo de imagen no válido.");
  if (field === "service") {
    return fail("Las imágenes de servicios usan su propio formulario.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Elegí una imagen.");
  }

  const profile = await providers.findByUserId(user.id);
  const planId: PlanId = profile?.planId ?? "cobre";

  /*
   * El cupo se cuenta sobre lo que el usuario tiene vigente —confirmado más
   * pendiente—, no sobre lo que el perfil publica: durante el alta todavía no
   * hay perfil y la cuenta daría cero, dejando pasar cuantas se quisieran.
   * Contar también lo pendiente es lo que impide subir diez, guardar, y
   * pasarse del plan de una.
   */
  const { max, planName, fromPlan } = await maxForField(field, planId);

  if (max === 0) {
    /*
     * El aviso distingue de dónde sale el cero: sólo los campos que dependen
     * del plan pueden decir "tu plan no lo incluye". Uno cuya política diga
     * cero está apagado para todos, y culpar al plan mandaría a mejorarlo
     * para conseguir algo que no daría igual.
     */
    return fail(
      fromPlan
        ? "Tu plan no incluye galería de trabajos."
        : "Este campo no admite imágenes.",
    );
  }

  if (max !== null) {
    // BR-007: contar disponibles del campo, incluidas ocultas y pendientes.
    const current = (await listImagesForUser(user.id)).filter(
      (image) => image.kind === field && image.galleryState === "available",
    );

    /*
     * Los campos de una sola imagen no se frenan acá: subir una foto nueva es
     * reemplazar la que está, y el reemplazo se resuelve al guardar. Frenarlo
     * obligaría a borrar la vieja antes de poder elegir la nueva, que es
     * justo lo que TR-043 evita.
     */
    if (field === "gallery" && current.length >= max) {
      return fail(
        planName
          ? `Tu plan ${planName} permite hasta ${max} imágenes.`
          : `Podés subir hasta ${max} imágenes.`,
      );
    }
  }

  /*
   * Acá se decide si esto es una imagen: firma binaria, dimensiones
   * declaradas y decodificación. Lo que se guarda es la versión regenerada,
   * nunca el archivo original (TR-042).
   */
  const processed = await processImage(field, await file.arrayBuffer());
  if (!processed.ok) return fail(processed.error);

  try {
    const image = await putProfileImage({
      userId: user.id,
      profileId: profile?.id ?? null,
      kind: field,
      body: processed.image.body,
      contentType: processed.image.contentType,
      extension: processed.image.extension,
      width: processed.image.width,
      height: processed.image.height,
    });

    return Response.json({ ok: true, image });
  } catch (error) {
    // TR-041: el detalle al log, una frase genérica a quien sube.
    console.error("putProfileImage failed", error);
    return fail("No pudimos guardar la imagen. Probá de nuevo.", 500);
  }
}

/**
 * Descarta una imagen **pendiente** propia: la que se subió y se quitó antes
 * de guardar.
 *
 * Una confirmada no se borra por acá. Quitarla del formulario es una
 * intención que recién se aplica al guardar (TR-043), y hasta entonces el
 * archivo tiene que seguir donde está por si se cancela la edición.
 *
 * El id viaja por query y no en el cuerpo: un DELETE con cuerpo no está
 * garantizado en toda la cadena de proxies y cachés.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para borrar imágenes.", 401);

  const imageId = new URL(request.url).searchParams.get("id");
  if (!imageId) return fail("Falta el id de la imagen.");

  try {
    const removed = await discardPendingImage(imageId, user.id);
    if (!removed) return fail("No encontramos esa imagen.", 404);
  } catch (error) {
    console.error("discardPendingImage failed", error);
    return fail("No pudimos quitar la imagen. Probá de nuevo.", 500);
  }

  return Response.json({ ok: true });
}
