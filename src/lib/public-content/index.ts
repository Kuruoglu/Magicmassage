import "server-only";

import { createPublicContentSupabaseClient, type PublicContentEnvSource } from "./client";
import { createPublicContentDataLayer } from "./data-layer";

export { createPublicContentSupabaseClient, resolvePublicContentSupabaseEnv } from "./client";
export type { PublicContentEnvSource, PublicContentSupabaseEnv } from "./client";
export { createPublicContentDataLayer } from "./data-layer";
export { sanitizePublicBlogHtml } from "./sanitize";
export * from "./types";

export function createConfiguredPublicContentDataLayer(
  env: PublicContentEnvSource = process.env,
) {
  return createPublicContentDataLayer(createPublicContentSupabaseClient(env));
}
