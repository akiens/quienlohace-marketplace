"use client";

import { useMemo, useState } from "react";

import { FAQS, FAQ_CATEGORIES } from "@/data/faqs";
import { EmptyState, Icon } from "@/components/ui";
import { slugify } from "@/lib/slug";

/** Buscador y filtro por tema sobre las preguntas frecuentes. */
export function FaqBrowser() {
  const [category, setCategory] = useState<string>("Todas");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const term = slugify(query);
    return FAQS.filter((faq) => {
      const matchesCategory = category === "Todas" || faq.category === category;
      const matchesQuery =
        term.length === 0 ||
        slugify(`${faq.question} ${faq.answer}`).includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-12 items-center gap-2.5 rounded-input border border-line bg-white px-3.5">
        <Icon name="search" className="text-[20px] text-ink-soft" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en las preguntas..."
          aria-label="Buscar en las preguntas frecuentes"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {["Todas", ...FAQ_CATEGORIES].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
            className={`rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
              category === item
                ? "border-brand-800 bg-brand-100 text-brand-800"
                : "border-line-strong bg-white text-ink-muted hover:bg-surface-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState icon="help_outline" title="No encontramos esa pregunta">
          Probá con otras palabras o escribinos: respondemos todas las consultas.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {results.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-card border border-line bg-white px-5 open:shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[15.5px] font-semibold text-ink">
                {faq.question}
                <Icon
                  name="expand_more"
                  className="ml-auto text-[22px] text-ink-faint transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-line-soft py-4 text-[14.5px] leading-relaxed text-ink-muted">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
