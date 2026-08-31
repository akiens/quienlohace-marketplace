import Link from "next/link";

import { Icon } from "@/components/ui";

type Crumb = { label: string; href?: string };

/** Migas de pan: orientan al usuario y refuerzan el enlazado interno. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-ink-soft">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-brand-800 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "font-semibold text-ink" : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? (
                <Icon name="chevron_right" className="text-[16px] text-ink-faint" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
