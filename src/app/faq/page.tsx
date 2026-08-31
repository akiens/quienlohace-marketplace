import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqBrowser } from "@/components/faq-browser";
import { FAQS } from "@/data/faqs";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Dudas frecuentes sobre cómo usar QuienLoHace, publicar un perfil y dejar opiniones.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Preguntas frecuentes" }]}
      />

      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink sm:text-[28px]">
          Preguntas frecuentes
        </h1>
        <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
          Todo lo que suelen preguntarnos, tanto quienes buscan un servicio como
          quienes ofrecen uno.
        </p>
      </header>

      <FaqBrowser />
    </div>
  );
}
