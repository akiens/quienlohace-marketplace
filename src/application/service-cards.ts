import "server-only";

import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import type { SearchFilters, ServiceCard } from "@/types";

const repository = new D1ServiceCardRepository();

export function listProfileServiceCards(profileId: string, owner = false): Promise<ServiceCard[]> {
  return repository.listForProfile(profileId, owner);
}

export function findPublicServiceCard(slug: string): Promise<ServiceCard | null> {
  return repository.findPublicBySlug(slug);
}

export function searchServiceCards(filters: SearchFilters, limit = 48): Promise<ServiceCard[]> {
  return repository.search(filters, limit);
}

export function countServiceCards(filters: SearchFilters): Promise<number> {
  return repository.count(filters);
}

export function listPublicServiceCardPaths(): Promise<{ providerSlug: string; slug: string }[]> {
  return repository.listPublicPaths();
}
