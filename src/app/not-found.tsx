import { NotFoundPage } from "@/components/not-found-page";

/**
 * 404 general del sitio. Comparte la página con los casos que sí pueden
 * sugerir algo (un perfil que no existe, por ejemplo); acá no hay un nombre
 * buscado del que sacar parecidos, así que va sin sugerencias.
 */
export default function NotFound() {
  return (
    <NotFoundPage
      title="No encontramos esta página"
      message="Puede que el enlace esté desactualizado o que el contenido ya no esté disponible. Probá buscando el servicio que necesitás."
    />
  );
}
