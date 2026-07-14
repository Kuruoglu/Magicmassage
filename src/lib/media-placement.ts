import type { Locale } from "@/i18n/config";
import type { PublicMediaPlacement } from "@/lib/public-content/types";

export function resolvePublicMediaPlacement(
  placements: readonly PublicMediaPlacement[] | undefined,
  placementKey: string,
  locale: Locale,
) {
  const matches = placements?.filter((placement) => placement.placementKey === placementKey) ?? [];

  return (
    matches.find((placement) => placement.locale === locale) ??
    matches.find((placement) => placement.locale === "bg") ??
    matches.find((placement) => placement.locale === null)
  )?.media;
}
