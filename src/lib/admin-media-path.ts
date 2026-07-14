export const adminMediaBucket = "admin-media";
export const adminMediaFolders = ["blog", "certificates", "gallery", "media", "services"] as const;

const adminMediaExtensions = ["avif", "jpeg", "jpg", "pdf", "png", "webp"] as const;
const adminMediaPathPattern = new RegExp(
  `^(${adminMediaFolders.join("|")})/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(${adminMediaExtensions.join("|")})$`,
  "i",
);

export function normalizeAdminMediaPath(value: string) {
  const normalized = value.trim().replaceAll("\\\\", "/");

  return adminMediaPathPattern.test(normalized) ? normalized.toLowerCase() : null;
}

export function getAdminMediaUrl(path: string) {
  return `/api/media/admin/${path}`;
}
