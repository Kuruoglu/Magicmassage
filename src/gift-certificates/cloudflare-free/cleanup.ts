export type GiftCleanupResult = {
  cancelled: number;
  claimed: number;
  failed: number;
  fulfilled: number;
  redacted: number;
};

const disabledCleanupResult: GiftCleanupResult = {
  cancelled: 0,
  claimed: 0,
  failed: 0,
  fulfilled: 0,
  redacted: 0,
};

export async function cleanupAbandonedGiftCertificateOrders(
  _options: unknown = {},
): Promise<GiftCleanupResult> {
  void _options;
  return disabledCleanupResult;
}
