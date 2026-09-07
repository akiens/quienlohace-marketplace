import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Banner } from "@/components/banner";
import { DowngradeNotice } from "@/components/dashboard/downgrade-notice";
import { PlanSwitcher } from "@/components/dashboard/plan-switcher";
import { ProfileView } from "@/components/dashboard/profile-view";
import { Icon } from "@/components/ui";
import {
  downgradeIsDue,
  downgradeNoticeStage,
  effectivePlanId,
} from "@/domain/plan-changes";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { listImagesForUser } from "@/infrastructure/d1-profile-images";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { getCurrentUser } from "@/lib/session";
import type { PlanId } from "@/types";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false },
};

// El panel depende de la sesión: nunca se pregenera ni se cachea.
export const dynamic = "force-dynamic";

/**
 * El perfil del proveedor: mirarlo, publicarlo y editarlo.
 *
 * El alta vive en `/dashboard/crear` y se recorre una sola vez. Desde que el
 * perfil existe, todo pasa por acá: el modo edición muestra los campos que
 * habilita el plan vigente, así que subir de plan hace aparecer los nuevos
 * sin tener que volver al asistente.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  if (!hasCloudflareRuntime()) return <SetupNotice />;

  /*
   * El modo edición se lee acá además de en `ProfileView` porque su aviso es
   * un `Banner`, y los avisos van pegados al encabezado: montado dentro de
   * `ProfileView` quedaba debajo del título de la página. La página no se
   * vuelve dinámica por esto — ya lo era (`force-dynamic`).
   */
  const editing = (await searchParams).editar === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const profile = await new D1ProfileRepository().findByUserId(user.id);

  // Sin perfil todavía no hay nada que mirar: se va al alta.
  if (!profile) redirect("/dashboard/crear");

  /*
   * Las imágenes se piden por usuario y no por perfil: es la misma consulta
   * que usa el alta, donde el perfil todavía no existe, y así las dos
   * pantallas ven exactamente lo mismo.
   */
  const images = await listImagesForUser(user.id);

  const allPlans = await new D1PlanRepository().list();

  /*
   * El plan que rige hoy, no el de la columna: con una baja agendada y el
   * período todavía corriendo sigue mandando el plan pago. Si acá se tomara
   * la columna a secas, bajar de plan apagaría las funciones en el acto —
   * cobrando un período que ya no se puede usar.
   */
  const planState = {
    planId: profile.planId ?? "cobre",
    downgradePlanId: profile.downgradePlanId,
    planExpiresAt: profile.planExpiresAt,
    // Lo que ya se cerró del aviso, para no repetirlo.
    dismissedAt: profile.downgradeNoticeDismissedAt,
    remindedAt: profile.downgradeNoticeRemindedAt,
  };
  const planId: PlanId = effectivePlanId(planState);

  /*
   * Cada vez que se abre el perfil se evalúa la baja agendada: si ya venció,
   * se consolida en la fila —el plan bajado pasa a ser el contratado y
   * `downgrade_plan_id` vuelve a NULL—.
   *
   * Lo que se ve no depende de esto: `effectivePlanId` ya devuelve el plan
   * menor desde el instante del vencimiento. Esto deja la fila coherente con
   * lo que se muestra, que es lo que después leerá el cobro, y evita que la
   * baja quede colgada para siempre esperando una tarea que todavía no
   * existe.
   */
  if (downgradeIsDue(planState)) {
    await new D1ProfileRepository().applyDueDowngrade(profile.id, planId);
  }
  const plan =
    allPlans.find((p) => p.id === planId) ??
    allPlans.find((p) => p.id === "cobre");

  if (!plan) return <SetupNotice />;

  /*
   * El aviso de la baja agendada, si corresponde mostrarlo.
   *
   * `downgradeNoticeStage` decide las dos cosas juntas: que haya una baja sin
   * aplicar, y que el aviso que toca no esté cerrado. Devuelve además cuál de
   * los dos es —el normal o el recordatorio de los últimos días—, que es lo
   * que necesita el componente para marcar la columna correcta al cerrarlo.
   */
  const noticeStage = downgradeNoticeStage(planState);
  const downgrade = noticeStage
    ? allPlans.find((p) => p.id === profile.downgradePlanId)
    : undefined;

  return (
    <>
      {/*
       * Los avisos van primero, pegados al encabezado del sitio y a ancho
       * completo: son novedades de la cuenta o del estado de la pantalla, no
       * contenido de "Mi perfil".
       *
       * Editando se muestra sólo el de edición: apilar dos bandas empuja el
       * formulario fuera de la pantalla, y el de la baja ya se leyó al entrar.
       */}
      {editing ? (
        <Banner icon="edit">
          Estás editando tu perfil. Los cambios se guardan al confirmar.
        </Banner>
      ) : null}

      {!editing && downgrade && noticeStage ? (
        <DowngradeNotice
          planName={plan.name}
          downgradePlanName={downgrade.name}
          effectiveOn={
            profile.planExpiresAt ? formatDate(profile.planExpiresAt) : null
          }
          stage={noticeStage}
        />
      ) : null}

      {/*
       * En el teléfono el panel no lleva margen lateral: la franja del plan
       * tiene que tocar los dos bordes, y con el `px` del `shell` quedaba
       * flotando con 20px a cada lado. El margen se lo pone cada bloque que sí
       * lo necesita, y vuelve entero desde `sm`.
       */}
      <div className="mx-auto flex w-full max-w-shell flex-col gap-5 px-0 py-6 sm:gap-7 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-1.5 px-5 sm:px-0">
          <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
            Mi perfil
          </h1>
          <p className="text-[15px] text-ink-soft">
            Revisá cómo quedó, publicalo cuando esté listo y editá lo que
            necesites.
          </p>
        </header>

        <PlanSwitcher plan={plan} plans={allPlans} persist />

        {/*
          El padding lateral lo pone `ProfileView` en sus propios bloques y no
          este contenedor: en modo edición el aviso de "estás editando" es un
          `Banner`, que va a ancho completo, y envuelto acá quedaba con 20px a
          cada lado como cualquier tarjeta.
        */}
        <ProfileView profile={profile} plan={plan} images={images} />
      </div>
    </>
  );
}

/**
 * Fecha corta y legible: "12 de marzo de 2027". `null` si no se puede leer.
 *
 * Devolver `null` y no la cadena vacía es lo que deja al aviso omitir la fecha
 * entera en vez de anunciar "el " y quedarse a la mitad.
 */
function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Sin bindings de Cloudflare el panel no puede leer ni escribir en D1. */
function SetupNotice() {
  return (
    <div className="shell flex flex-col items-start gap-4 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
        <Icon name="database" className="text-[24px] text-brand-800" />
      </span>
      <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink">
        Falta conectar la base de datos
      </h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">
        El panel del proveedor necesita el runtime de Cloudflare con el binding
        D1. Para trabajar sobre el panel usá{" "}
        <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-[13.5px]">
          npm run preview
        </code>
        , que levanta el sitio sobre Workers con la base local. Los pasos están
        en el README.
      </p>
      <Link
        href="/"
        className="flex h-10 items-center rounded-input bg-brand-800 px-4 text-[14px] font-semibold text-white hover:bg-brand-900"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
