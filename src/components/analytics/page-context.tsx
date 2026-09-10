import type { AnalyticsEntity } from "@/domain/analytics";

export function AnalyticsPageContext({ pageType, surface, disabled = false, ...entity }: AnalyticsEntity & { pageType: string; surface?: string; disabled?: boolean }) {
  return <span hidden data-analytics-page-context data-analytics-disabled={disabled ? "true" : undefined} data-page-type={pageType} data-surface={surface} data-entity-type={entity.entityType} data-provider-profile-id={entity.providerProfileId} data-profile-service-id={entity.profileServiceId} data-service-card-id={entity.serviceCardId} data-specialty-id={entity.specialtyId} data-service-sector-id={entity.serviceSectorId} data-entity-snapshot-id={entity.entitySnapshotId} />;
}
