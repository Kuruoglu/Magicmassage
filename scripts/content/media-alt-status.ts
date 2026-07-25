export function mediaStorageStatus(altText: string): "ready" | "needs_alt" {
  return altText.trim() ? "ready" : "needs_alt";
}
