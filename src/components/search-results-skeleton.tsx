import { ProfileCardSkeleton } from "@/components/profile-card";
import { PROVIDER_GRID } from "@/components/ui";

/** La silueta de una página completa de resultados mientras busca. */
export function SearchResultsSkeleton() {
  return (
    <div className="shell flex flex-col gap-5 py-8" role="status" aria-live="polite">
      <div className="h-7 w-52 animate-pulse rounded bg-surface-muted" />
      <p className="text-[14.5px] font-semibold text-ink-soft">Buscando resultados…</p>
      <div className={PROVIDER_GRID}>
        {Array.from({ length: 12 }, (_, index) => (
          <ProfileCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
