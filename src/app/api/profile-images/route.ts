import { limitFor } from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import {
  deleteProviderImage,
  listImagesForUser,
  putProviderImage,
} from "@/infrastructure/d1-provider-images";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { getCurrentUser } from "@/lib/session";
import type { ImageKind, PlanId } from "@/types";

/**
 * Subida y borrado de las imágenes del perfil.
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
 * mientras el asistente sigue abierto.
 */

/** Depende de la cookie de quien sube: nunca se cachea. */
export const dynamic = "force-dynamic";

const providers = new D1ProviderRepository();
const plans = new D1PlanRepository();

/**
 * Formatos aceptados y su extensión.
 *
 * Lista cerrada y no un `image/*`: conviene guardar sólo lo que después se
 * sabe servir. SVG queda afuera a propósito — puede traer scripts, y se
 * serviría desde el mismo dominio que el sitio.
 */
const ACCEPTED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Tope por archivo. Una foto de cámara entra holgada. */
const MAX_BYTES = 5 * 1024 * 1024;

const KINDS: ImageKind[] = ["avatar", "cover", "gallery"];

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Sube una imagen del perfil propio.
 *
 * La foto de perfil y la portada las incluyen todos los planes (RF-167); la
 * galería depende del tope del plan, que se verifica acá y no sólo en la UI:
 * que el paso no se muestre no es una restricción (RF-163).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para subir imágenes.", 401);

  const formData = await request.formData();

  const kind = String(formData.get("kind") ?? "");
  if (!KINDS.includes(kind as ImageKind)) {
    return fail("Tipo de imagen no válido.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Elegí una imagen.");
  }

  const extension = ACCEPTED[file.type];
  if (!extension) {
    return fail("Formato no admitido. Usá JPG, PNG o WebP.");
  }

  if (file.size > MAX_BYTES) {
    return fail("La imagen no puede pesar más de 5 MB.");
  }

  const provider = await providers.findByUserId(user.id);

  /*
   * El tope de galería se cuenta sobre lo que el usuario ya subió, no sobre
   * lo que el perfil publica: durante el alta todavía no hay perfil y la
   * cuenta daría cero, dejando pasar cuantas imágenes se quisieran.
   */
  if (kind === "gallery") {
    const planId: PlanId = provider?.planId ?? "cobre";
    const plan =
      (await plans.findById(planId)) ?? (await plans.findById("cobre"));
    const max = plan ? limitFor(plan, "galleryImages") : 0;

    if (max === 0) {
      return fail("Tu plan no incluye galería de trabajos.");
    }

    const current = (await listImagesForUser(user.id)).filter(
      (image) => image.kind === "gallery",
    );

    if (current.length >= max) {
      return fail(
        plan
          ? `Tu plan ${plan.name} permite hasta ${max} imágenes.`
          : `Podés subir hasta ${max} imágenes.`,
      );
    }
  }

  const image = await putProviderImage({
    userId: user.id,
    providerId: provider?.id ?? null,
    kind: kind as ImageKind,
    body: await file.arrayBuffer(),
    contentType: file.type,
    extension,
  });

  return Response.json({ ok: true, image });
}

/**
 * Borra una imagen propia.
 *
 * El id viaja por query y no en el cuerpo: un DELETE con cuerpo no está
 * garantizado en toda la cadena de proxies y cachés.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para borrar imágenes.", 401);

  const imageId = new URL(request.url).searchParams.get("id");
  if (!imageId) return fail("Falta el id de la imagen.");

  const removed = await deleteProviderImage(imageId, user.id);
  if (!removed) return fail("No encontramos esa imagen.", 404);

  return Response.json({ ok: true });
}
