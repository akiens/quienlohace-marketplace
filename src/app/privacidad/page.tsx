import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo QuienLoHace trata los datos de uso del marketplace.",
};

export default function PrivacyPage() {
  return (
    <div className="shell py-8 sm:py-12">
      <article className="mx-auto flex max-w-3xl flex-col gap-7 rounded-card border border-line bg-white p-5 shadow-card sm:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-[27px] font-extrabold tracking-[-.5px] text-ink sm:text-[34px]">Privacidad</h1>
          <p className="text-[14px] text-ink-soft">Última actualización: 10 de setiembre de 2026.</p>
        </header>
        <section className="flex flex-col gap-3">
          <h2 className="text-[19px] font-bold text-ink">Datos de uso</h2>
          <p className="text-[15px] leading-7 text-ink-muted">Registramos observaciones seudónimas de las páginas públicas visitadas, búsquedas aplicadas, resultados que llegan a verse y activaciones de canales de contacto. Las usamos para mejorar la búsqueda, entender la demanda y elaborar estadísticas agregadas del marketplace.</p>
          <p className="text-[15px] leading-7 text-ink-muted">No guardamos la dirección IP, coordenadas precisas, huellas del dispositivo, contenido escrito en formularios, números o direcciones de contacto ni mensajes enviados a proveedores. Un clic en un canal sólo indica que se abrió ese canal.</p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-[19px] font-bold text-ink">Búsquedas y conservación</h2>
          <p className="text-[15px] leading-7 text-ink-muted">Las frases de búsqueda pasan por filtros que eliminan consultas con patrones de email, teléfono, documento o URL. Las consultas restantes se restringen a personal autorizado y se eliminan a los siete días. Los recorridos se conservan hasta 90 días; sólo tendencias suficientemente agrupadas pueden mantenerse por más tiempo.</p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-[19px] font-bold text-ink">Consultas y derechos</h2>
          <p className="text-[15px] leading-7 text-ink-muted">Podés consultar sobre el tratamiento de datos o ejercer los derechos que correspondan escribiendo a <a className="font-semibold text-brand-800 underline" href="mailto:hola@quienlohace.uy">hola@quienlohace.uy</a>. Evaluamos las solicitudes con la información mínima necesaria y sin crear una identidad persistente para medir visitas.</p>
        </section>
      </article>
    </div>
  );
}
