import { ABSOLUTE_MAX_BYTES } from "@/domain/image-policy";
import {
  MAX_SERVICE_CARD_IMAGES,
  countPendingServiceCardImages,
  discardPendingServiceCardImage,
  putServiceCardImage,
} from "@/infrastructure/d1-service-card-images";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import { processImage } from "@/infrastructure/image-processing";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para subir imágenes.", 401);
  if (Number(request.headers.get("content-length") ?? 0) > ABSOLUTE_MAX_BYTES) {
    return fail("La imagen es demasiado pesada.", 413);
  }
  const profile = await new D1ProfileRepository().findByUserId(user.id);
  if (!profile) return fail("Primero creá tu perfil.");
  const cardId = new URL(request.url).searchParams.get("cardId");
  if (cardId && !(await new D1ServiceCardRepository().findOwned(cardId, user.id))) {
    return fail("No encontramos esa carta.", 404);
  }
  if (await countPendingServiceCardImages(user.id, cardId) >= MAX_SERVICE_CARD_IMAGES) {
    return fail(`Podés agregar hasta ${MAX_SERVICE_CARD_IMAGES} imágenes por carta.`);
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("No pudimos leer el archivo.");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Elegí una imagen.");
  const processed = await processImage("service", await file.arrayBuffer());
  if (!processed.ok) return fail(processed.error);
  try {
    const image = await putServiceCardImage({
      userId: user.id,
      profileId: profile.id,
      cardId,
      body: processed.image.body,
      contentType: processed.image.contentType,
      extension: processed.image.extension,
      width: processed.image.width,
      height: processed.image.height,
    });
    return Response.json({ ok: true, image });
  } catch (error) {
    console.error("putServiceCardImage failed", error);
    return fail("No pudimos guardar la imagen. Probá nuevamente.", 500);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para quitar imágenes.", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Falta el id de la imagen.");
  return (await discardPendingServiceCardImage(id, user.id))
    ? Response.json({ ok: true })
    : fail("No encontramos esa imagen pendiente.", 404);
}
