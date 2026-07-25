import type { MediaStatus } from "./domain";

export function normalizeMediaStatus(status: MediaStatus, altText: string): MediaStatus {
  if (status === "Черновик") return status;

  return altText.trim() ? "Готово" : "Требует alt";
}
