import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileWorkspace } from "@/components/dashboard/profile-workspace";
import { WizardReset } from "@/components/dashboard/wizard-reset";
import { Icon } from "@/components/ui";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { listImagesForUser } from "@/infrastructure/d1-profile-images";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Creá tu perfil",
  robots: { index: false },
};

// Depende de la sesión: nunca se pregenera ni se cachea.
export const dynamic = "force-dynamic";

/**
 * Alta del perfil, separada del perfil en sí.
 *
 * El asistente es un recorrido de una sola vez: se completa, se crea el
 * perfil y no se vuelve. A partir de ahí todo se corrige en `/dashboard`, en
 * modo edición, que muestra los campos que el plan habilita —incluidos los
 * que habilite un plan nuevo—. Con eso el asistente no tiene nada que
 * agregar: volver a ofrecer ocho pasos para tocar un campo es trabajo, no
 * ayuda.
 */
export default async function CreateProfilePage() {
  if (!hasCloudflareRuntime()) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const profile = await new D1ProfileRepository().findByUserId(user.id);

  const allPlans = await new D1PlanRepository().list();

  /*
   * Plan de partida. En el alta el que vale es el que se eligió en el
   * registro, que vive en el navegador y lo aplica `ProfileWorkspace`: el
   * servidor no puede leerlo, así que manda el más restrictivo como piso.
   * Si el navegador trae otro, el formulario se reordena solo.
   */
  /*
   * Plan de partida. Subiendo, el del perfil, que ya está activado y define
   * qué pasos mostrar. En el alta manda el que se eligió en el registro, que
   * vive en el navegador y aplica `ProfileWorkspace`: el servidor no puede
   * leerlo, así que pone el más restrictivo como piso.
   */
  const plan =
    (profile ? allPlans.find((p) => p.id === profile.planId) : undefined) ??
    allPlans.find((p) => p.id === "cobre");
  if (!plan) return <SetupNotice />;

  /*
   * Con el perfil ya creado el asistente cumplió: se manda al perfil, que es
   * donde se edita. El redirect vive en el servidor y no en un botón para que
   * también cubra a quien llegue por un enlace viejo o escribiendo la
   * dirección a mano.
   *
   * La excepción es subir de plan. El plan nuevo se activa en el acto, pero
   * queda el cobro sin resolver (`past_due`) y los pasos que ese plan recién
   * habilita sin completar: el asistente vuelve a abrirse para eso, y se
   * cierra solo al confirmar el pago. Lo decide el estado del perfil y no un
   * parámetro de la URL, así un enlace guardado no lo reabre.
   */
  const settlingUpgrade =
    profile !== null && profile.subscriptionStatus === "past_due";

  if (profile && !settlingUpgrade) redirect("/dashboard");

  /*
   * Las imágenes se piden por usuario y no por perfil: durante el alta se
   * suben antes de que el perfil exista, y pedirlas por perfil no devolvería
   * las recién cargadas.
   */
  const images = await listImagesForUser(user.id);

  return (
    /*
     * En el teléfono el asistente ocupa el ancho completo: el margen del
     * `shell` acá no protege nada —adentro no hay más que campos— y se lleva
     * 40px de los 360 que suele haber. Vuelve desde `sm`, donde ya sobra.
     */
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-0 pb-8 pt-4 sm:gap-7 sm:px-6 sm:py-8">
      {/*
       * Antes que nada: si el navegador trae el plan de otra cuenta —una
       * máquina compartida, o una segunda cuenta propia— se descarta, para
       * que el alta no arranque con elecciones ajenas.
       */}
      <WizardReset userId={user.id} />

      <ProfileWorkspace
        userId={user.id}
        accountEmail={user.email}
        profile={profile}
        plan={plan}
        plans={allPlans}
        images={images}
      />
    </div>
  );
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
